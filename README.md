# GitHub RAG

Ask natural-language questions about a public GitHub repository and receive answers grounded in its source code. GitHub RAG clones a repository, builds a persistent vector index, retrieves and reranks relevant code, and displays source-file references alongside each answer.

## Features

- Indexes public `https://github.com/OWNER/REPO` repositories.
- Supports common source, configuration, script, SQL, and Markdown files.
- Chunks files with line-number metadata and stores embeddings in Chroma.
- Rewrites questions, retrieves candidates, reranks them with a cross-encoder, and generates cited answers through Ollama.
- Provides a React chat interface with Markdown rendering and links to the referenced GitHub files.
- Emits indexing and RAG traces through Langfuse when it is configured.

## Architecture

```text
React + Vite client
        |
        | POST /api/index, /api/chat
        v
FastAPI service
  |-- GitPython: shallow-clone public repository
  |-- Ollama embeddings + Chroma: persistent similarity search
  |-- CrossEncoder: rerank retrieved chunks
  `-- Ollama chat model: answer using retrieved context only
```

## Prerequisites

- Node.js 20+ and npm
- Python 3.10+
- [Ollama](https://ollama.com/) running locally (default: `http://localhost:11434`)
- Git, for cloning repositories

The default backend models are `gemma4:31b-cloud` for chat and `qwen3-embedding:4b` for embeddings. Pull or otherwise make available the models you choose before starting the API. If you keep the defaults, for example:

```bash
ollama pull gemma4:31b-cloud
ollama pull qwen3-embedding:4b
```

## Run locally

1. Install the backend dependencies. Langfuse is imported by the backend, so install it as well until it is added to `backend/requirements.txt`.

   ```bash
   cd backend
   python -m venv .venv
   # Windows PowerShell
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt langfuse
   ```

2. Optionally create `backend/.env` to override models or service locations:

   ```env
   OLLAMA_BASE_URL=http://localhost:11434
   CHAT_MODEL=gemma4:31b-cloud
   EMBEDDING_MODEL=qwen3-embedding:4b
   CHROMA_DIR=./data/chroma
   RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
   RETRIEVAL_K=12
   FINAL_K=5
   ```

   Langfuse configuration is optional; without its environment variables, tracing is simply not configured. Add your Langfuse credentials if you want observability.

3. Start the API from `backend`:

   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

4. In a second terminal, start the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Open the URL Vite prints (normally `http://localhost:5173`), enter a public repository URL, index it, then ask questions.

To point the frontend at another API location, create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:8000
```

## API

`GET /api/health`

Returns `{"status": "ok"}`.

`POST /api/index`

```json
{ "repo_url": "https://github.com/OWNER/REPOSITORY" }
```

Returns repository metadata, the Chroma collection name, indexed chunk count, and skipped-file count.

`POST /api/chat`

```json
{
  "repo_url": "https://github.com/OWNER/REPOSITORY",
  "question": "Where is the database initialized?"
}
```

Returns an answer, rewritten retrieval queries, citation IDs, and source metadata including file paths and line ranges.

## Indexing behavior and limits

- Only public GitHub HTTPS repository URLs are accepted.
- The indexer ignores dependency, build, virtual-environment, and VCS directories such as `node_modules`, `.git`, `dist`, and `venv`.
- Supported files are limited to known text/code extensions and files up to 500 KB.
- At most 2,000 files are considered. Files are split into 100-line chunks with a 20-line overlap.
- Re-indexing a repository replaces that repository's previous Chroma collection.

## Project layout

```text
backend/
  app/main.py          FastAPI routes and CORS configuration
  app/ingestion.py     GitHub validation, cloning, filtering, and chunking
  app/vectorstore.py   Ollama embeddings and Chroma persistence
  app/rag.py           Query rewrite, retrieval, reranking, and answering
  app/observability.py Langfuse integration
frontend/
  src/App.jsx          Repository indexing and chat UI
```

## Development

```bash
# Frontend checks
cd frontend
npm run lint
npm run build
```

The API allows the Vite development origins `http://localhost:5173` and `http://127.0.0.1:5173`. Update the CORS configuration in `backend/app/main.py` before deploying the frontend elsewhere.

## Notes

Answers are generated from retrieved chunks and may still be incomplete or inaccurate. Use the linked source references to verify important conclusions.
