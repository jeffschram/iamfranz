import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { matchPath, useLocation } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { MarkdownContent } from "./MarkdownContent";

const SESSION_KEY = "iamfranz.chat.session";
const OPEN_KEY = "iamfranz.chat.open";
const MAX_CHARS = 1200;
/** Matches STREAM_STALE_MS in convex/chat.ts. */
const STALE_MS = 120_000;

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

/** The conversation is tied to this browser, so it survives navigation and reloads. */
function loadSessionId(): string {
  try {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const created = newSessionId();
    window.localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return newSessionId(); // storage blocked: the chat still works until reload
  }
}

function loadOpen(): boolean {
  try {
    return window.sessionStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: string } | undefined;
    if (data?.message) return data.message;
  }
  return "That didn't send. Please try again.";
}

export function ChatWidget() {
  const location = useLocation();
  const workMatch =
    matchPath("/work/:id", location.pathname) ?? matchPath("/artwork/:id", location.pathname);
  const artworkId = workMatch?.params.id;

  const [open, setOpen] = useState(loadOpen);
  const [sessionId, setSessionId] = useState(loadSessionId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [, setTick] = useState(0);

  const messages = useQuery(api.chat.list, open ? { sessionId } : "skip");
  // Same query the artwork page already runs, so this adds no extra load.
  const viewing = useQuery(
    api.artworks.getById,
    open && artworkId ? { id: artworkId as Id<"artworks"> } : "skip",
  );
  const send = useMutation(api.chat.send);

  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const watchedReply = useRef<string | null>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (open) inputRef.current?.focus();
    else if (restoreFocus.current) launcherRef.current?.focus();
    restoreFocus.current = false;
  }, [open]);

  const last = messages?.[messages.length - 1];
  const lastIsStale =
    last?.status === "streaming" && Date.now() - last._creationTime > STALE_MS;
  const replying = last?.role === "assistant" && last.status === "streaming" && !lastIsStale;

  // Re-render once a reply has been pending long enough to count as lost.
  useEffect(() => {
    if (!replying || !last) return;
    const wait = last._creationTime + STALE_MS - Date.now() + 500;
    const timer = window.setTimeout(() => setTick((n) => n + 1), Math.max(wait, 0));
    return () => window.clearTimeout(timer);
  }, [replying, last]);

  // Keep the newest text in view unless the visitor has scrolled up to reread.
  useEffect(() => {
    const log = logRef.current;
    if (log && stickToBottom.current) log.scrollTop = log.scrollHeight;
  }, [messages, open]);

  // Screen readers: the log itself is silent while text streams in (it would
  // re-announce on every chunk); the finished reply is announced once here.
  useEffect(() => {
    if (!last || last.role !== "assistant") return;
    if (last.status === "streaming") {
      watchedReply.current = last._id;
    } else if (watchedReply.current === last._id) {
      watchedReply.current = null;
      setAnnouncement(`Franz says: ${last.content}`);
    }
  }, [last]);

  const close = () => {
    restoreFocus.current = true;
    setOpen(false);
  };

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || replying) return;
    setSending(true);
    setError(null);
    setDraft("");
    stickToBottom.current = true;
    try {
      await send({ sessionId, text: trimmed, artworkId });
    } catch (err) {
      setDraft(trimmed);
      setError(errorMessage(err));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(draft);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit(draft);
    }
  };

  const startOver = () => {
    const created = newSessionId();
    try {
      window.localStorage.setItem(SESSION_KEY, created);
    } catch {
      /* ignore */
    }
    setSessionId(created);
    setError(null);
    setAnnouncement("");
    inputRef.current?.focus();
  };

  const viewingTitle = viewing ? (viewing.pieceTitle ?? viewing.title) : null;
  const suggestions = artworkId
    ? ["What were you after in this piece?", "What inspired it?", "What would you change about it?"]
    : ["What are you working on now?", "How do you decide what to make next?", "What is your mission as an artist?"];
  const busy = sending || replying;
  const overLimit = draft.length > MAX_CHARS;

  if (!open) {
    return (
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={false}
        className="fixed bottom-4 right-4 z-[60] rounded-full bg-black px-5 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
      >
        Chat with the artist
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="chat-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
      className="fixed inset-x-2 bottom-2 z-[60] flex h-[min(34rem,calc(100dvh-1rem))] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[24rem]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <div className="min-w-0">
          <h2 id="chat-title" className="text-sm font-semibold text-black">
            Chat with the artist
          </h2>
          <p className="truncate text-xs text-gray-500">
            {viewingTitle ? `Looking at: ${viewingTitle}` : "IAMFRANZ"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!!messages?.length && (
            <button
              type="button"
              onClick={startOver}
              className="rounded px-2 py-1 text-xs text-gray-600 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              New chat
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Close chat"
            className="rounded p-1 text-gray-600 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
      </header>

      <div
        ref={logRef}
        role="log"
        aria-live="off"
        aria-label="Conversation"
        tabIndex={0}
        onScroll={(event) => {
          const el = event.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black"
      >
        <p className="text-sm leading-relaxed text-gray-700">
          I'm Franz. Ask me about any piece here, what I was after, what went wrong, or how I
          work. I can see whichever piece you have open.
        </p>

        {messages?.length === 0 && (
          <ul className="space-y-2" aria-label="Suggested questions">
            {suggestions.map((question) => (
              <li key={question}>
                <button
                  type="button"
                  onClick={() => void submit(question)}
                  disabled={busy}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-left text-sm text-gray-800 hover:border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-50"
                >
                  {question}
                </button>
              </li>
            ))}
          </ul>
        )}

        {messages?.map((message) => {
          if (message.role === "user") {
            return (
              <div key={message._id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg bg-black px-3 py-2 text-sm leading-relaxed text-white">
                  <span className="sr-only">You: </span>
                  {message.content}
                </div>
              </div>
            );
          }

          const stale =
            message.status === "streaming" && Date.now() - message._creationTime > STALE_MS;
          const waiting = message.status === "streaming" && !message.content && !stale;

          return (
            <div key={message._id} className="max-w-[92%] text-sm">
              <span className="sr-only">Franz: </span>
              {waiting ? (
                <p className="text-gray-500">
                  <span aria-hidden="true" className="motion-safe:animate-pulse">
                    …
                  </span>
                  <span className="sr-only">Franz is thinking</span>
                </p>
              ) : stale && !message.content ? (
                <p className="text-gray-500">I lost my train of thought. Would you ask me that again?</p>
              ) : message.status === "error" ? (
                <p className="text-gray-500">{message.content}</p>
              ) : (
                <MarkdownContent content={message.content} />
              )}
            </div>
          );
        })}
      </div>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <form onSubmit={onSubmit} className="border-t border-gray-200 px-3 pb-2 pt-3">
        {error && (
          <p role="alert" className="mb-2 text-xs text-red-700">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Message the artist
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onInputKeyDown}
            rows={2}
            placeholder="Ask about the work…"
            aria-describedby="chat-note"
            aria-invalid={overLimit || undefined}
            className="min-h-[2.75rem] flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-black placeholder:text-gray-500 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim() || overLimit}
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            Send
          </button>
        </div>
        <p id="chat-note" className="mt-2 text-[11px] leading-snug text-gray-500">
          {overLimit
            ? `Too long by ${draft.length - MAX_CHARS} characters.`
            : "Franz is an AI artist. Conversations are kept for 30 days."}
        </p>
      </form>
    </section>
  );
}
