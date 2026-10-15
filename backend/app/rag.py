
import re
from functools import lru_cache

from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama import ChatOllama
from sentence_transformers import CrossEncoder

from app.config import settings
from app.vectorstore import get_vectorstore
from app.observability import langchain_config, langfuse

llm = ChatOllama(
    model=settings.CHAT_MODEL,
    base_url=settings.OLLAMA_BASE_URL,
    temperature=0,
)


@lru_cache(maxsize=1)
def get_reranker():
    return CrossEncoder(settings.RERANKER_MODEL)


def rewrite_query(question: str) -> list[str]:
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """You generate search queries for a software repository.

Produce exactly 3 concise alternative queries.
Include relevant technical terms, likely symbols, or file concepts.
Do not answer the question.
Return only the queries, one per line, without numbering."""
        ),
        ("human", "{question}"),
    ])

    chain = prompt | llm
    response = chain.invoke(
        {"question": question},
        config=langchain_config("query-rewrite"),  #for langfuse monitoring
    )

    alternatives = [
        line.strip(" -*\t0123456789.")
        for line in response.content.splitlines()
        if line.strip()
    ]

    queries = [question]

    for query in alternatives:
        if query and query.lower() not in {
            item.lower() for item in queries
        }:
            queries.append(query)

        if len(queries) >= 4:
            break

    return queries


def retrieve_candidates(collection: str, queries: list[str]):
    with langfuse.start_as_current_observation(
        as_type="retriever",
        name="chroma-retrieval",
        input={"queries": queries},
        metadata={
            "collection": collection,
            "retrieval_k": settings.RETRIEVAL_K,
        },
    ) as observation:

        store = get_vectorstore(collection)
        unique = {}

        for query in queries:
            results = store.similarity_search_with_score(
                query,
                k=settings.RETRIEVAL_K,
            )

            for document, distance in results:
                metadata = document.metadata
                key = (
                    metadata.get("file_path", ""),
                    metadata.get("start_line", 0),
                    metadata.get("end_line", 0),
                )

                if key not in unique:
                    unique[key] = {
                        "document": document,
                        "distance": float(distance),
                    }

        candidates =  list(unique.values())
        observation.update(
            output={
                "candidate_count": len(candidates),
                "matches": [
                    {
                        "file_path": item["document"].metadata.get("file_path"),
                        "distance": item["distance"],
                    }
                    for item in candidates
                ],
            }
        )
        return candidates


def rerank(question: str, candidates: list[dict]) -> list[dict]:
    if not candidates:
        return []

    with langfuse.start_as_current_observation(
        as_type="chain",
        name="cross-encoder-rerank",
        input={"question": question, "candidate_count": len(candidates)},
        metadata={"model": settings.RERANKER_MODEL},
    ) as observation:
        pairs = [
            (question, item["document"].page_content)
            for item in candidates
        ]
        scores = get_reranker().predict(pairs)

        for item, score in zip(candidates, scores):
            item["rerank_score"] = float(score)

        ranked = sorted(
            candidates,
            key=lambda item: item["rerank_score"],
            reverse=True,
        )[:settings.FINAL_K]

        observation.update(
            output={
                "result_count": len(ranked),
                "results": [
                    {
                        "file_path": item["document"].metadata.get("file_path"),
                        "score": item["rerank_score"],
                    }
                    for item in ranked
                ],
            }
        )
        return ranked

        


def answer_question(collection: str, question: str) -> dict:
    queries = rewrite_query(question)
    candidates = retrieve_candidates(collection, queries)
    ranked = rerank(question, candidates)

    if not ranked:
        return {
            "answer": (
                "I couldn't find relevant code in the indexed "
                "repository. Try a more specific question."
            ),
            "sources": [],
            "rewritten_queries": queries,
        }

    sources = []
    context_parts = []

    for index, item in enumerate(ranked, start=1):
        document = item["document"]
        metadata = document.metadata

        source = {
            "id": index,
            "file_path": metadata["file_path"],
            "start_line": metadata["start_line"],
            "end_line": metadata["end_line"],
            "repo_url": metadata["repo_url"],
            "score": round(item["rerank_score"], 4),
        }

        sources.append(source)

        context_parts.append(
            f"[SOURCE {index}]\n"
            f"File: {source['file_path']}\n"
            f"Lines: {source['start_line']}-"
            f"{source['end_line']}\n"
            f"Code:\n{document.page_content}"
        )

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """You are a software repository assistant.

Answer using ONLY the supplied repository context.
If the context does not establish an answer, say what is missing.
Never invent functions, files, APIs, or implementation details.

Cite every substantive repository-specific claim with source IDs
in this exact format: [1], [2], etc.
Use only IDs present in the supplied context.
Distinguish direct evidence from reasonable inference.

Repository context:
{context}"""), ("human", "{question}"),
    ])

    chain = prompt | llm
    response = chain.invoke({
        "question": question,
        "context": "\n\n".join(context_parts),
    },
    config=langchain_config("answer-generation"), #for langfuse monitoring
    )

    answer = response.content

    # Remove citation IDs that don't refer to supplied sources.
    valid_ids = {str(source["id"]) for source in sources}
    cited_ids = re.findall(r"\[(\d+)\]", answer)

    # The frontend displays the verified source list separately.
    # Missing citations should be addressed in evaluation, not
    # silently fabricated.
    return {
        "answer": answer,
        "sources": sources,
        "rewritten_queries": queries,
        "citation_ids": [
            value for value in cited_ids if value in valid_ids
        ],
    }
