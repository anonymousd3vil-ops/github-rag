import { FaGithub } from "react-icons/fa";
import {
  Bot,
  Send,
  LoaderCircle,
  Database,
  Sparkles,
  ExternalLink,
  FileCode2,
  Settings,
  CheckCircle,
  Layers,
  GitBranch,
  ShieldCheck,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { useEffect, useState } from "react";
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [repoUrl, setRepoUrl] = useState("");
  const [indexedRepo, setIndexedRepo] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [indexing, setIndexing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [indexInfo, setIndexInfo] = useState(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!asking) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    setElapsedSeconds(0);

    const intervalId = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    return () => clearInterval(intervalId);
  }, [asking]);

  const formatElapsedTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  };

  async function request(path, body) {
    const response = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || "Request failed");
    }

    return data;
  }

  async function indexRepository(event) {
    event.preventDefault();
    setError("");
    setIndexing(true);

    try {
      const data = await request("/api/index", {
        repo_url: repoUrl.trim(),
      });

      setIndexedRepo(repoUrl.trim());
      setIndexInfo(data);
      setMessages([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIndexing(false);
    }
  }

  async function askQuestion(event) {
    event.preventDefault();

    if (!indexedRepo || !question.trim() || asking) return;

    const text = question.trim();
    setQuestion("");
    setError("");

    setMessages((previous) => [...previous, { role: "user", content: text }]);

    setAsking(true);

    try {
      const data = await request("/api/chat", {
        repo_url: indexedRepo,
        question: text,
      });

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources || [],
          queries: data.rewritten_queries || [],
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  }

  function sourceUrl(source) {
    const base = source.repo_url.replace(/\/$/, "");
    const path = source.file_path.split("/").map(encodeURIComponent).join("/");

    return `${base}/blob/HEAD/${path}#L${source.start_line}-L${source.end_line}`;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#09090b] text-zinc-100 selection:bg-violet-500/30">
      {/* Header */}
      <header className="z-30 shrink-0 border-b border-white/[0.07] bg-[#09090b]">
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <FaGithub size={20} />
            </div>

            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight sm:text-base">
                GitHub RAG
              </h1>
              <p className="hidden text-[11px] text-zinc-500 sm:block">
                Repository intelligence
              </p>
            </div>

            <span className="ml-1 hidden rounded-md border border-white/[0.08] px-2 py-1 text-[10px] font-medium text-zinc-500 md:inline-block">
              LOCAL
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-2.5 py-1.5 sm:px-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-30" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-medium text-emerald-300">
              Local AI
            </span>
          </div>
        </div>
      </header>

      {/* Application layout */}
      <main className="mx-auto grid w-full max-w-[1600px] min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-3 sm:gap-5 sm:p-5 lg:grid-cols-[290px_minmax(0,1fr)] lg:grid-rows-1 lg:gap-6 lg:p-8">
        {/* Repository sidebar */}
        <aside className="flex min-h-0 max-h-[22dvh] flex-col overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#101012] lg:h-full lg:max-h-none">
          <div className="shrink-0 border-b border-white/[0.07] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
                <FaGithub size={17} />
              </div>
              <div>
                <h2 className="text-sm font-medium">Repository</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Connect a public codebase
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <form onSubmit={indexRepository} className="space-y-3">
              <label
                htmlFor="repository-url"
                className="block text-xs font-medium text-zinc-400"
              >
                GitHub repository URL
              </label>

              <div className="relative">
                <FaGithub
                  size={16}
                  className="pointer-events-none absolute left-3 top-3.5 text-zinc-600"
                />
                <input
                  id="repository-url"
                  type="url"
                  value={repoUrl}
                  onChange={(event) => setRepoUrl(event.target.value)}
                  placeholder="https://github.com/owner/repo"
                  required
                  autoComplete="url"
                  className="w-full rounded-xl border border-white/[0.09] bg-[#09090b] py-3 pl-9 pr-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/10"
                />
              </div>

              <button
                type="submit"
                disabled={indexing || !repoUrl.trim()}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-violet-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {indexing ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Database size={16} />
                )}
                {indexing ? "Indexing repository..." : "Index repository"}
              </button>

              <p className="text-[11px] leading-5 text-zinc-600">
                Source files are processed locally using your configured AI
                stack.
              </p>
            </form>

            {indexInfo && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                <div className="mb-3 flex items-center gap-2 text-emerald-300">
                  <CheckCircle size={16} />
                  <span className="text-xs font-medium">Indexing complete</span>
                </div>

                <p className="break-all text-sm font-medium text-zinc-200">
                  {indexInfo.owner}/{indexInfo.repo}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-black/20 p-3">
                    <p className="text-lg font-semibold tabular-nums text-zinc-100">
                      {indexInfo.chunks}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      Code chunks
                    </p>
                  </div>
                  <div className="rounded-lg bg-black/20 p-3">
                    <p className="text-lg font-semibold tabular-nums text-zinc-100">
                      {indexInfo.skipped_files ?? 0}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      Files skipped
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-white/[0.07] pt-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xs font-medium text-zinc-300">
                  Pipeline configuration
                </h3>
                <Settings size={14} className="text-zinc-600" />
              </div>

              <div className="space-y-4">
                {[
                  {
                    label: "Language model",
                    value: "Qwen3 4B",
                    detail: "Answer generation",
                  },
                  {
                    label: "Embeddings",
                    value: "Qwen3 Embedding",
                    detail: "Semantic search",
                  },
                  {
                    label: "Vector database",
                    value: "Chroma",
                    detail: "Persistent retrieval",
                  },
                  {
                    label: "Reranking",
                    value: "Cross-encoder",
                    detail: "Relevance scoring",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-300">{item.label}</p>
                      <p className="mt-1 text-[10px] text-zinc-600">
                        {item.detail}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-1 text-[10px] text-zinc-400">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Chat workspace */}
        <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e10]">
          {/* Chat header: fixed */}
          <div className="flex shrink-0 min-w-0 items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/10 bg-violet-500/[0.08] text-violet-300">
                <Bot size={19} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-medium">Codebase assistant</h2>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {indexedRepo || "Index a repository to begin"}
                </p>
              </div>
            </div>

            {indexedRepo && (
              <a
                href={indexedRepo}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-2 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-200 sm:px-3"
              >
                <FaGithub size={14} />
                <span className="hidden sm:inline">Repository</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          {/* ONLY this region scrolls */}
          <div
            className="flex min-h-0 flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-6"
            style={{ scrollbarGutter: "stable" }}
          >
            {messages.length === 0 && (
              <div className="m-auto w-full max-w-xl py-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-500/[0.08] text-violet-300">
                  <Sparkles size={22} />
                </div>

                <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-violet-300/80">
                  Repository intelligence
                </p>

                <h3 className="max-w-md text-2xl font-semibold leading-tight tracking-tight text-zinc-100 sm:text-3xl">
                  Understand the code.
                  <span className="text-zinc-500"> Skip the digging.</span>
                </h3>

                <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-500">
                  Ask about architecture, trace function calls, or find where a
                  feature is implemented. Answers include source references.
                </p>

                <div className="mt-8">
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                    Try asking
                  </p>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      {
                        title: "Understand the architecture",
                        question: "Explain the project architecture",
                        icon: <Layers size={16} />,
                      },
                      {
                        title: "Find database setup",
                        question: "Where is the database initialized?",
                        icon: <Database size={16} />,
                      },
                      {
                        title: "Trace an API request",
                        question: "Trace the API request flow",
                        icon: <GitBranch size={16} />,
                      },
                      {
                        title: "Locate authentication",
                        question: "Find the authentication logic",
                        icon: <ShieldCheck size={16} />,
                      },
                    ].map((item) => (
                      <button
                        key={item.question}
                        type="button"
                        onClick={() => setQuestion(item.question)}
                        className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.015] p-3.5 text-left transition hover:border-violet-400/30 hover:bg-violet-500/[0.04]"
                      >
                        <span className="shrink-0 text-zinc-500 transition group-hover:text-violet-300">
                          {item.icon}
                        </span>
                        <span className="text-xs leading-5 text-zinc-400 transition group-hover:text-zinc-200">
                          {item.title}
                        </span>
                        <ArrowUpRight
                          size={14}
                          className="ml-auto shrink-0 text-zinc-700 group-hover:text-violet-300"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex min-w-0 gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-violet-300">
                    <Bot size={16} />
                  </div>
                )}

                <div
                  className={`min-w-0 max-w-[95%] sm:max-w-[88%] ${
                    message.role === "user" ? "sm:max-w-[80%]" : ""
                  }`}
                >
                  <div
                    className={`min-w-0 overflow-hidden rounded-2xl px-4 py-3.5 text-sm leading-7 ${
                      message.role === "user"
                        ? "rounded-br-md whitespace-pre-wrap break-words bg-violet-600 text-white"
                        : "rounded-tl-md border border-white/[0.07] bg-[#151517] text-zinc-300"
                    }`}
                  >
                    {message.role === "user" ? (
                      <div className="whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                    ) : (
                      <div
                        className="
                        min-w-0 break-words
                        [&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:text-xl [&_h1]:font-semibold
                        [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold
                        [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold
                        [&_p]:my-3 [&_p]:leading-7
                        [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6
                        [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6
                        [&_li]:pl-1
                        [&_a]:text-violet-300 [&_a]:underline [&_a]:underline-offset-4
                        [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-violet-400/50 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-400
                        [&_table]:w-full [&_table]:border-collapse
                        [&_th]:border [&_th]:border-white/10 [&_th]:bg-white/5 [&_th]:p-2 [&_th]:text-left
                        [&_td]:border [&_td]:border-white/10 [&_td]:p-2
                        [&_hr]:my-4 [&_hr]:border-white/10
                        [&_pre]:my-4 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-[#09090b] [&_pre]:p-4
                        [&_code]:font-mono [&_code]:text-[0.85em]
                        [&_p_code]:rounded [&_p_code]:bg-black/40 [&_p_code]:px-1.5 [&_p_code]:py-0.5 [&_p_code]:text-violet-200
                      "
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                          components={{
                            a: ({ node, ...props }) => (
                              <a {...props} target="_blank" rel="noreferrer" />
                            ),
                            pre: ({ node, ...props }) => (
                              <pre
                                {...props}
                                className="max-w-full overflow-x-auto"
                              />
                            ),
                          }}
                        >
                          {message.content ?? ""}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {message.role === "assistant" &&
                    message.sources?.length > 0 && (
                      <div className="mt-4">
                        <div className="mb-2.5 flex items-center gap-2">
                          <FileCode2 size={14} className="text-violet-300" />
                          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            Source references
                          </span>
                          <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-500">
                            {message.sources.length}
                          </span>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          {message.sources.map((source) => (
                            <a
                              key={source.id}
                              href={sourceUrl(source)}
                              target="_blank"
                              rel="noreferrer"
                              className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/1.5 p-3 transition hover:border-violet-400/30 hover:bg-violet-500/[0.035]"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/6 bg-white/2.5 text-zinc-400 group-hover:text-violet-300">
                                <FileCode2 size={17} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-zinc-300 group-hover:text-white">
                                  {source.file_path}
                                </p>
                                <p className="mt-1 text-[10px] text-zinc-600">
                                  Lines {source.start_line}–{source.end_line}
                                </p>
                              </div>

                              <ExternalLink
                                size={13}
                                className="shrink-0 text-zinc-600 group-hover:text-violet-300"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            ))}

            {/* Thinking indicator and live elapsed timer */}
            {asking && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-400/15 bg-violet-500/10 text-violet-300">
                  <Bot size={16} />
                </div>

                <div
                  role="status"
                  aria-live="polite"
                  className="min-w-0 rounded-2xl rounded-tl-md border border-white/[0.07] bg-[#151517] px-4 py-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                    <LoaderCircle
                      size={15}
                      className="animate-spin text-violet-300"
                    />
                    <span>Generating answer</span>
                    <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 font-mono tabular-nums text-violet-300">
                      {formatElapsedTime(elapsedSeconds)}
                    </span>
                  </div>

                  <p className="mt-2 text-[11px] leading-5 text-zinc-500">
                    Rewriting query · Retrieving context · Reranking ·
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3.5 text-sm text-red-300"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 break-words">{error}</div>
                </div>
              </div>
            )}
          </div>

          {/* Composer: fixed at the bottom of the chat panel */}
          <div className="shrink-0 border-t border-white/[0.07] bg-[#0e0e10] p-3 sm:p-5">
            <form onSubmit={askQuestion} className="mx-auto max-w-4xl">
              <div className="rounded-2xl border border-white/[0.1] bg-[#09090b] transition focus-within:border-violet-400/40 focus-within:ring-2 focus-within:ring-violet-500/[0.06]">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  disabled={!indexedRepo || asking}
                  rows={2}
                  aria-label="Ask a question about the repository"
                  placeholder={
                    indexedRepo
                      ? "Ask about functions, files, or architecture..."
                      : "Index a repository to start asking questions"
                  }
                  className="max-h-40 min-h-[76px] w-full resize-y bg-transparent px-4 py-4 text-sm leading-6 text-zinc-200 outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
                />

                <div className="flex items-center justify-between gap-3 px-3 pb-3">
                  <p className="hidden text-[10px] text-zinc-600 sm:block">
                    Enter to send · Shift + Enter for a new line
                  </p>
                  <p className="text-[10px] text-zinc-600 sm:hidden">
                    Enter to send
                  </p>

                  <button
                    type="submit"
                    disabled={!indexedRepo || !question.trim() || asking}
                    aria-label="Send message"
                    className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-3.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {asking ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                    <span>Send</span>
                  </button>
                </div>
              </div>

              <p className="mt-2.5 text-center text-[10px] leading-5 text-zinc-600">
                AI-generated answers may be inaccurate. Verify important details
                against the cited source code.
              </p>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
