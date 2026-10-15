
import hashlib
import re
import shutil
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from git import Repo
from langchain_core.documents import Document
from app.vectorstore import save_documents


ALLOWED_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx",
    ".java", ".cpp", ".c", ".h", ".hpp",
    ".go", ".rs", ".rb", ".php",
    ".html", ".css", ".scss", ".json",
    ".yaml", ".yml", ".toml", ".md",
    ".sql", ".sh", ".bat", ".ps1",
}

IGNORED_DIRS = {
    ".git", "node_modules", ".venv", "venv",
    "__pycache__", "dist", "build", ".next",
    "coverage", "vendor", "target",
}

MAX_FILE_BYTES = 500_000
MAX_FILES = 2000
CHUNK_LINES = 100
OVERLAP_LINES = 20


def parse_github_url(url: str) -> tuple[str, str]:
    parsed = urlparse(url.strip())

    if parsed.scheme != "https" or parsed.hostname != "github.com":
        raise ValueError("Use a public https://github.com/OWNER/REPO URL.")

    parts = parsed.path.strip("/").split("/")

    if len(parts) != 2:
        raise ValueError("Enter a repository URL, not a file or subdirectory URL.")

    owner, repo = parts
    repo = re.sub(r"\.git$", "", repo)

    if not re.fullmatch(r"[A-Za-z0-9_.-]+", owner):
        raise ValueError("Invalid repository owner.")

    if not re.fullmatch(r"[A-Za-z0-9_.-]+", repo):
        raise ValueError("Invalid repository name.")

    return owner, repo


def collection_name(owner: str, repo: str) -> str:
    slug = re.sub(
        r"[^a-zA-Z0-9_-]",
        "-",
        f"{owner}-{repo}".lower(),
    )[:40]

    digest = hashlib.sha1(
        f"{owner}/{repo}".lower().encode()
    ).hexdigest()[:12]

    return f"repo-{slug}-{digest}"


def index_repository(url: str) -> dict:
    owner, repo_name = parse_github_url(url)
    collection = collection_name(owner, repo_name)

    temp_dir = tempfile.mkdtemp(prefix="github-rag-")

    try:
        Repo.clone_from(
            f"https://github.com/{owner}/{repo_name}.git",
            temp_dir,
            depth=1,
            no_single_branch=True,
            multi_options=["--filter=blob:none"],
        )

        root = Path(temp_dir)
        documents = []
        skipped = 0

        for path in root.rglob("*"):
            if not path.is_file():
                continue

            relative = path.relative_to(root)

            if any(part in IGNORED_DIRS for part in relative.parts):
                continue

            if path.suffix.lower() not in ALLOWED_EXTENSIONS:
                continue

            if path.stat().st_size > MAX_FILE_BYTES:
                skipped += 1
                continue

            if len(documents) >= MAX_FILES * 100:
                break

            try:
                content = path.read_text(
                    encoding="utf-8",
                    errors="strict",
                )
            except (UnicodeDecodeError, OSError):
                skipped += 1
                continue

            lines = content.splitlines()
            step = CHUNK_LINES - OVERLAP_LINES

            for start in range(0, len(lines), step):
                chunk_lines = lines[start:start + CHUNK_LINES]

                if not chunk_lines:
                    break

                text = "\n".join(chunk_lines)

                if not text.strip():
                    continue

                documents.append(
                    Document(
                        page_content=text,
                        metadata={
                            "owner": owner,
                            "repo": repo_name,
                            "file_path": relative.as_posix(),
                            "start_line": start + 1,
                            "end_line": start + len(chunk_lines),
                            "repo_url": (f"https://github.com/{owner}/{repo_name}"),
                        },
                    )
                )

                if len(documents) >= MAX_FILES * 100:
                    break

        if not documents:
            raise ValueError(
                "No supported source files found in this repository."
            )

        save_documents(collection, documents)

        return {
            "owner": owner,
            "repo": repo_name,
            "collection": collection,
            "chunks": len(documents),
            "skipped_files": skipped,
        }

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
