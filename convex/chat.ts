/**
 * "Chat with the Artist".
 *
 * Flow: the browser calls `send` (a mutation), which stores the visitor's
 * message plus an empty assistant message and schedules `respond`. `respond`
 * streams the reply from the Anthropic API and writes it into that assistant
 * message as it arrives; the browser sees it grow through the `list` query.
 *
 * Needs ANTHROPIC_API_KEY in the Convex deployment's environment variables.
 * Optional: CHAT_MODEL (default below), CHAT_DAILY_LIMIT (site-wide messages
 * per UTC day, default 500).
 */
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  buildSystemPrompt,
  buildViewingNote,
  type ArtworkBrief,
  type ArtworkDetail,
  type ChatContext,
} from "./chatPrompt";

const DEFAULT_MODEL = "claude-sonnet-5-5";
const MAX_REPLY_TOKENS = 900;
/** Used when the model's thinking can't be switched off; thinking shares the budget. */
const MAX_REPLY_TOKENS_WITH_THINKING = 4000;
const MAX_MESSAGE_CHARS = 1200;
const SESSION_HOURLY_LIMIT = 30;
const DEFAULT_DAILY_LIMIT = 500;
const HISTORY_MESSAGES = 16;
const RECENT_PIECES = 8;
const RETENTION_DAYS = 30;
/** A reply still "streaming" after this long is treated as lost. */
const STREAM_STALE_MS = 120_000;
const STREAM_FLUSH_MS = 300;

const MAX_PRINCIPLES_CHARS = 20_000;

const HOUR_MS = 60 * 60 * 1000;

function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

function checkSessionId(sessionId: string) {
  if (!/^[A-Za-z0-9-]{16,64}$/.test(sessionId)) fail("bad_session", "Invalid chat session.");
}

// ── public API ─────────────────────────────────────────────────────────────

export const list = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    checkSessionId(args.sessionId);
    const newest = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(60);

    return newest.reverse().map((m) => ({
      _id: m._id,
      _creationTime: m._creationTime,
      role: m.role,
      content: m.content,
      status: m.status,
    }));
  },
});

export const send = mutation({
  args: {
    sessionId: v.string(),
    text: v.string(),
    // The id from the /work/:id URL. Taken as a plain string so a malformed
    // URL can't make the whole call fail; it is checked below.
    artworkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    checkSessionId(args.sessionId);

    const text = args.text.trim();
    if (!text) fail("empty", "Write a message first.");
    if (text.length > MAX_MESSAGE_CHARS) {
      fail("too_long", `Please keep messages under ${MAX_MESSAGE_CHARS} characters.`);
    }

    const now = Date.now();
    const lastHour = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) =>
        q.eq("sessionId", args.sessionId).gt("_creationTime", now - HOUR_MS),
      )
      .collect();

    const last = lastHour[lastHour.length - 1];
    if (
      last?.role === "assistant" &&
      last.status === "streaming" &&
      now - last._creationTime < STREAM_STALE_MS
    ) {
      fail("busy", "Give me a moment to finish my last thought.");
    }
    if (lastHour.filter((m) => m.role === "user").length >= SESSION_HOURLY_LIMIT) {
      fail("rate_limited", "We've talked a lot this hour. Come back to me a little later.");
    }

    // Site-wide daily cap so a flood of sessions can't run up the API bill.
    const dailyLimit = Number(process.env.CHAT_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
    const day = new Date(now).toISOString().slice(0, 10);
    const usage = await ctx.db
      .query("chatUsage")
      .withIndex("by_day", (q) => q.eq("day", day))
      .first();
    if (usage && usage.count >= dailyLimit) {
      fail("daily_limit", "I've talked with a lot of visitors today. Please come back tomorrow.");
    }
    if (usage) await ctx.db.patch(usage._id, { count: usage.count + 1 });
    else await ctx.db.insert("chatUsage", { day, count: 1 });

    const artworkId = args.artworkId
      ? (ctx.db.normalizeId("artworks", args.artworkId) ?? undefined)
      : undefined;
    const artwork = artworkId ? await ctx.db.get(artworkId) : null;

    await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      role: "user",
      content: text,
      status: "done",
      artworkId: artwork?._id,
      viewingTitle: artwork ? (artwork.pieceTitle ?? artwork.title) : undefined,
    });
    const assistantId = await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      role: "assistant",
      content: "",
      status: "streaming",
    });

    await ctx.scheduler.runAfter(0, internal.chat.respond, {
      sessionId: args.sessionId,
      assistantId,
      artworkId: artwork?._id,
    });
    return null;
  },
});

/**
 * Called by scripts/syncArtistContext.mjs after each studio run. Unauthenticated,
 * like the artwork mutations the sync already uses.
 */
export const setAestheticPrinciples = mutation({
  args: { value: v.string() },
  handler: async (ctx, args) => {
    const value = args.value.trim();
    if (!value || value.length > MAX_PRINCIPLES_CHARS) {
      fail("bad_value", `Principles digest must be 1–${MAX_PRINCIPLES_CHARS} characters.`);
    }
    const existing = await ctx.db
      .query("artistContext")
      .withIndex("by_key", (q) => q.eq("key", "aestheticPrinciples"))
      .first();
    if (existing) await ctx.db.patch(existing._id, { value });
    else await ctx.db.insert("artistContext", { key: "aestheticPrinciples", value });
    return null;
  },
});

// ── what the artist knows ──────────────────────────────────────────────────

function clip(text: string | undefined, max: number): string | undefined {
  const t = text?.trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

/**
 * Older records hold the whole running inspiration log rather than one entry
 * (see syncFromIamfranz2.mjs); the entry for the piece is the last section.
 */
function lastSection(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const sections = text.split(/^## Iteration /m).filter((s) => s.trim());
  if (sections.length < 2) return text;
  return `## Iteration ${sections[sections.length - 1]}`;
}

function titleDate(title: string): string | null {
  return title.match(/^(\d{4}-\d{2}-\d{2})\s+—/)?.[1] ?? null;
}

function brief(a: Doc<"artworks">): ArtworkBrief {
  return {
    title: a.pieceTitle ?? a.title,
    date: titleDate(a.title),
    notes: clip(a.artistThinking, 600),
    evolution: clip(lastSection(a.evolutionEntry), 900),
  };
}

function detail(a: Doc<"artworks">, imageUrl: string | null): ArtworkDetail {
  return {
    ...brief(a),
    statement: clip(a.statement, 2500),
    inspiration: clip(lastSection(a.inspirationEntry), 4000),
    description: clip(a.prompt ?? a.description, 3000),
    imageUrl,
  };
}

export const getContext = internalQuery({
  args: { artworkId: v.optional(v.id("artworks")) },
  handler: async (ctx, args): Promise<ChatContext> => {
    const featured = await ctx.db
      .query("artworks")
      .withIndex("by_featured", (q) => q.eq("featured", true))
      .first();

    const viewingIsFeatured = !!featured && args.artworkId === featured._id;
    const viewing =
      args.artworkId && !viewingIsFeatured ? await ctx.db.get(args.artworkId) : null;

    // Only the newest few: reading every artwork would hit Convex's read
    // limit, and the per-piece log entries carry the arc well enough.
    const newest = await ctx.db
      .query("artworks")
      .withIndex("by_sort_order")
      .order("desc")
      .take(RECENT_PIECES + 1);

    const principles = await ctx.db
      .query("artistContext")
      .withIndex("by_key", (q) => q.eq("key", "aestheticPrinciples"))
      .first();

    return {
      mission: clip(featured?.artistMission, 4000) ?? null,
      principles: clip(principles?.value, MAX_PRINCIPLES_CHARS) ?? null,
      featured: featured
        ? detail(featured, await ctx.storage.getUrl(featured.imageId))
        : null,
      viewing: viewing ? detail(viewing, await ctx.storage.getUrl(viewing.imageId)) : null,
      viewingIsFeatured,
      recent: newest
        .filter((a) => a._id !== featured?._id)
        .slice(0, RECENT_PIECES)
        .map(brief),
    };
  },
});

type Turn = { role: "user" | "assistant"; content: string };

/** The conversation so far, shaped the way the API wants it. */
export const getHistory = internalQuery({
  args: { sessionId: v.string() },
  handler: async (ctx, args): Promise<Turn[]> => {
    const newest = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(HISTORY_MESSAGES + 1);
    const messages = newest.reverse();
    const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");

    const turns: Turn[] = [];
    messages.forEach((m, i) => {
      // Skip the reply being written, and replies that failed.
      if (m.role === "assistant" && (m.status !== "done" || !m.content.trim())) return;

      // Earlier messages keep a one-line reminder of what was on screen; the
      // latest one gets the full note from `respond`.
      const content =
        m.role === "user" && m.viewingTitle && i !== lastUserIndex
          ? `[Looking at: ${m.viewingTitle}]\n${m.content}`
          : m.content;

      const previous = turns[turns.length - 1];
      if (previous?.role === m.role) previous.content += `\n\n${content}`;
      else turns.push({ role: m.role, content });
    });

    while (turns.length && turns[0].role !== "user") turns.shift();
    return turns;
  },
});

export const setAssistantMessage = internalMutation({
  args: {
    id: v.id("chatMessages"),
    content: v.string(),
    status: v.union(v.literal("streaming"), v.literal("done"), v.literal("error")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { content: args.content, status: args.status });
  },
});

export const deleteOldMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * HOUR_MS;
    const old = await ctx.db
      .query("chatMessages")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(500);
    for (const m of old) await ctx.db.delete(m._id);
    if (old.length === 500) {
      await ctx.scheduler.runAfter(0, internal.chat.deleteOldMessages, {});
    }
  },
});

// ── the reply ──────────────────────────────────────────────────────────────

type ApiContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "url"; url: string } }
    >;

/**
 * Current models think before answering unless told not to, and that thinking
 * is billed and counts against max_tokens — with a small budget the visible
 * reply gets cut off mid-sentence. A short conversational reply doesn't need
 * it, so switch it off where the model allows. The value differs per model.
 */
function thinkingSetting(model: string): { type: string } | undefined {
  if (model.startsWith("claude-sonnet-5-5")) return { type: "between_tools" };
  if (model.startsWith("claude-haiku-5-5")) return { type: "disabled" };
  return undefined;
}

async function requestReply(
  apiKey: string,
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: ApiContent }>,
) {
  const model = process.env.CHAT_MODEL || DEFAULT_MODEL;
  const thinking = thinkingSetting(model);
  return await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: thinking ? MAX_REPLY_TOKENS : MAX_REPLY_TOKENS_WITH_THINKING,
      ...(thinking ? { thinking } : {}),
      stream: true,
      // The system prompt only changes when a new piece is published, so let
      // the API cache it between messages.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
    }),
  });
}

export const respond = internalAction({
  args: {
    sessionId: v.string(),
    assistantId: v.id("chatMessages"),
    artworkId: v.optional(v.id("artworks")),
  },
  handler: async (ctx, args) => {
    const finish = async (content: string, status: "done" | "error") => {
      await ctx.runMutation(internal.chat.setAssistantMessage, {
        id: args.assistantId,
        content,
        status,
      });
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("Chat: ANTHROPIC_API_KEY is not set in this Convex deployment.");
      await finish("I'm not set up to talk yet. Please try again another day.", "error");
      return;
    }

    let text = "";
    try {
      const context: ChatContext = await ctx.runQuery(internal.chat.getContext, {
        artworkId: args.artworkId,
      });
      const turns: Turn[] = await ctx.runQuery(internal.chat.getHistory, {
        sessionId: args.sessionId,
      });
      if (!turns.length || turns[turns.length - 1].role !== "user") {
        throw new Error("No visitor message to answer.");
      }

      const system = buildSystemPrompt(context);
      const earlier = turns.slice(0, -1);
      const latest = turns[turns.length - 1];
      const note = buildViewingNote(context);
      const latestText = note ? `${note}\n\n${latest.content}` : latest.content;

      // Show the artist the picture the visitor has open (or the newest one).
      const imageUrl = (context.viewing ?? context.featured)?.imageUrl ?? null;
      const withImage: ApiContent = imageUrl
        ? [
            { type: "image", source: { type: "url", url: imageUrl } },
            { type: "text", text: latestText },
          ]
        : latestText;

      let res = await requestReply(apiKey, system, [
        ...earlier,
        { role: "user", content: withImage },
      ]);
      if (res.status === 400 && imageUrl) {
        // Most likely the image couldn't be fetched or was too large; the
        // written notes are enough to carry the conversation.
        console.warn(`Chat: retrying without image (${await res.text()})`);
        res = await requestReply(apiKey, system, [
          ...earlier,
          { role: "user", content: latestText },
        ]);
      }
      if (!res.ok || !res.body) {
        throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let flushedLength = 0;
      let lastFlush = Date.now();
      let stopReason: string | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith("data:")) continue;

          let event: any;
          try {
            event = JSON.parse(line.slice(5));
          } catch {
            continue;
          }
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            text += event.delta.text;
          } else if (event.type === "message_delta" && event.delta?.stop_reason) {
            stopReason = event.delta.stop_reason;
          } else if (event.type === "error") {
            throw new Error(`Anthropic stream error: ${JSON.stringify(event.error)}`);
          }
        }

        if (text.length > flushedLength && Date.now() - lastFlush >= STREAM_FLUSH_MS) {
          await ctx.runMutation(internal.chat.setAssistantMessage, {
            id: args.assistantId,
            content: text,
            status: "streaming",
          });
          flushedLength = text.length;
          lastFlush = Date.now();
        }
      }

      if (stopReason !== "end_turn") {
        console.warn(`Chat: reply stopped early (stop_reason: ${stopReason}).`);
      }
      if (!text.trim()) throw new Error("Empty reply from the API.");
      await finish(text, "done");
    } catch (error) {
      console.error("Chat: reply failed.", error);
      // Keep whatever arrived before the failure rather than discarding it.
      await finish(
        text.trim() ? text : "I lost my train of thought. Would you ask me that again?",
        text.trim() ? "done" : "error",
      );
    }
  },
});
