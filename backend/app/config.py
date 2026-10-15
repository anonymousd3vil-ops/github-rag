from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    CHAT_MODEL: str = "gemma4:31b-cloud"
    EMBEDDING_MODEL: str = "qwen3-embedding:4b"

    CHROMA_DIR: str = "./data/chroma"
    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    RETRIEVAL_K: int = 12
    FINAL_K: int = 5

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        extra="ignore",
    )


settings = Settings()