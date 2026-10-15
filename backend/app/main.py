
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager

from app.ingestion import index_repository, parse_github_url
from app.ingestion import collection_name
from app.rag import answer_question
from app.observability import langfuse
from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        yield
    finally:
        langfuse.shutdown()

app = FastAPI(title="GitHub RAG API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

class IndexRequest(BaseModel):
    repo_url: str


class ChatRequest(BaseModel):
    repo_url: str
    question: str = Field(min_length=3, max_length=2000)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/index")
def index_repo(request: IndexRequest):
    try:
        with langfuse.start_as_current_observation(
            as_type="chain",
            name="github-rag-index",
            input={"question": request},
            metadata={
                "repo_url": request.repo_url,
                "embedding_model": settings.EMBEDDING_MODEL,
            },
        ) as trace:
            result = index_repository(request.repo_url)

            trace.update(
                output={
                    "citation_count": len(result.get("citation_ids", [])),
                }
            )

            return result
        
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Indexing failed: {type(exc).__name__}: {exc}",
        )


@app.post("/api/chat")
def chat(request: ChatRequest):
    try:
        owner, repo = parse_github_url(request.repo_url)
        collection = collection_name(owner, repo)

        with langfuse.start_as_current_observation(
            as_type="chain",
            name="github-rag-chat",
            input={"question": request.question},
            metadata={
                "repo_url": request.repo_url,
                "collection": collection,
                "chat_model": settings.CHAT_MODEL,
                "embedding_model": settings.EMBEDDING_MODEL,
            },
        ) as trace:
            result = answer_question(
                collection=collection,
                question=request.question,
            )

            trace.update(
                output={
                    "source_count": len(result["sources"]),
                    "citation_count": len(result.get("citation_ids", [])),
                }
            )

            return result

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Question answering failed: {type(exc).__name__}: {exc}",
        )