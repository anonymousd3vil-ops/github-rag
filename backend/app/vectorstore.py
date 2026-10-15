
from pathlib import Path

from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings

from app.config import settings


def get_embeddings():
    return OllamaEmbeddings(
        model=settings.EMBEDDING_MODEL,
        base_url=settings.OLLAMA_BASE_URL,
    )


def get_vectorstore(collection: str) -> Chroma:
    persist_dir = Path(settings.CHROMA_DIR).resolve()
    persist_dir.mkdir(parents=True, exist_ok=True)

    return Chroma(
        collection_name=collection,
        embedding_function=get_embeddings(),
        persist_directory=str(persist_dir),
    )


def save_documents(collection: str, documents: list) -> None:
    store = get_vectorstore(collection)

    # A fresh indexing run replaces this repository's old index.
    store.delete_collection()
    store = get_vectorstore(collection)

    batch_size = 64

    for start in range(0, len(documents), batch_size):
        batch = documents[start:start + batch_size]
        ids = [
            f"{collection}-{start + i}"
            for i in range(len(batch))
        ]
        store.add_documents(documents=batch, ids=ids)
