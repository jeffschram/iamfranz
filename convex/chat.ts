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
import { clip, displayTitle, lastSection, refreshOverview, titleDate, upsertDigest } from "./artworkDigest";
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
  describeDetail,
  type ArtworkBrief,
  type ArtworkDetail,
  type ChatContext,
} from "./chatPrompt";

const DEFAULT_MODEL = "claude-sonnet-5-5";
/** Covers the visible reply plus any archive lookups the model makes on the way. */
const MAX_REPLY_TOKENS = 2000;
/** Used when the model's thinking can't be switched off; thinking shares the budget. */
const MAX_REPLY_TOKENS_WITH_THINKING = 5000;
/** How many times the artist may consult the archive before it must answer. */
const MAX_LOOKUP_ROUNDS = 4;
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

function brief(a: Doc<"artworks">): ArtworkBrief {
  return {
    title: displayTitle(a),
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

    const overview = await ctx.db
      .query("artistContext")
      .withIndex("by_key", (q) => q.eq("key", "catalogOverview"))
      .first();

    return {
      overview: overview?.value ?? null,
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

// ── the archive, as tools the artist can use mid-reply ────────────────────

const ARCHIVE_TOOLS = [
  {
    name: "list_works",
    description:
      "List pieces from your archive in date order: date, title and id for each. Give a date range to see what you made in a period (for example a month). With no dates it returns your earliest pieces. Use it for questions about when things were made, what came first, or what you were making at some time.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Earliest date to include, YYYY-MM-DD." },
        end_date: { type: "string", description: "Latest date to include, YYYY-MM-DD." },
      },
    },
  },
  {
    name: "search_works",
    description:
      "Search every piece you have made by words in its title, wall text, notes and inspiration. Use it to find pieces about a subject (rivers, music, grief), a technique, or a half-remembered title. Returns the best matches with date, title, id and a short excerpt.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A few plain words to search for." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_work",
    description:
      "Get everything you wrote about one piece (wall text, notes, what inspired it, your log entry, the description you gave the image generator) together with the picture itself. Identify it by the id from list_works or search_works, or by its number if the visitor says something like 'No. 254'.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The piece's id from list_works or search_works." },
        number: { type: "integer", description: "The number in the piece's title, e.g. 254." },
        include_mission: {
          type: "boolean",
          description: "Also return your mission statement as it stood when you made this piece.",
        },
      },
    },
  },
];

function digestLine(d: Doc<"artworkDigests">): string {
  // Some titles run to several hundred characters; the start identifies them.
  return `${d.date} | ${clip(d.title, 140)} | id: ${d.artworkId}`;
}

export const toolListWorks = internalQuery({
  args: { startDate: v.optional(v.string()), endDate: v.optional(v.string()) },
  handler: async (ctx, args): Promise<string> => {
    const LIMIT = 80;
    const start = args.startDate ?? "";
    const end = args.endDate ?? "9999-12-31";
    const rows = await ctx.db
      .query("artworkDigests")
      .withIndex("by_date", (q) => q.gte("date", start).lte("date", end))
      .take(LIMIT + 1);
    if (!rows.length) return "No pieces in that date range.";
    const lines = rows.slice(0, LIMIT).map(digestLine);
    if (rows.length > LIMIT) {
      lines.push(
        `(More pieces follow. Ask again with start_date ${rows[LIMIT].date} to continue.)`,
      );
    }
    return lines.join("\n");
  },
});

export const toolSearchWorks = internalQuery({
  args: { query: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const rows = await ctx.db
      .query("artworkDigests")
      .withSearchIndex("search_text", (q) => q.search("text", args.query))
      .take(8);
    if (!rows.length) return "No pieces matched. Try different or fewer words.";
    return rows
      .map((d) => `${digestLine(d)}\n   ${d.text.slice(d.title.length, d.title.length + 260).replace(/\s+/g, " ").trim()}…`)
      .join("\n");
  },
});

export const toolGetWork = internalQuery({
  args: {
    id: v.optional(v.string()),
    number: v.optional(v.number()),
    includeMission: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ text: string; imageUrl: string | null }> => {
    let artworkId = args.id ? ctx.db.normalizeId("artworks", args.id) : null;

    if (!artworkId && args.number !== undefined) {
      const matches = await ctx.db
        .query("artworkDigests")
        .withIndex("by_number", (q) => q.eq("number", args.number))
        .take(5);
      if (matches.length > 1) {
        return {
          text: `More than one piece carries No. ${args.number}. Pick one by id:\n${matches.map(digestLine).join("\n")}`,
          imageUrl: null,
        };
      }
      artworkId = matches[0]?.artworkId ?? null;
    }

    const artwork = artworkId ? await ctx.db.get(artworkId) : null;
    if (!artwork) {
      return {
        text: "No piece found for that id or number. Use search_works or list_works to find it.",
        imageUrl: null,
      };
    }

    const imageUrl = await ctx.storage.getUrl(artwork.imageId);
    let text = describeDetail(detail(artwork, imageUrl));
    if (args.includeMission) {
      text += `\nYour mission statement at the time:\n${clip(artwork.artistMission, 3500) ?? "(not recorded for this piece)"}\n`;
    }
    return { text, imageUrl };
  },
});

/**
 * Builds the searchable index for artworks that existed before it did, a few
 * at a time (artwork documents are large). Run once after deploying:
 *   npx convex run chat:backfillDigests
 * New and changed artworks are indexed automatically by artworks.ts.
 */
export const backfillDigests = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("artworks")
      .withIndex("by_sort_order")
      .paginate({ numItems: 4, cursor: args.cursor ?? null });
    for (const artwork of page.page) {
      await upsertDigest(ctx, artwork._id, { skipOverview: true });
    }

    if (page.isDone) await refreshOverview(ctx);
    else await ctx.scheduler.runAfter(0, internal.chat.backfillDigests, { cursor: page.continueCursor });
  },
});

// ── the reply ──────────────────────────────────────────────────────────────

type ContentBlock = Record<string, any>;
type ApiMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };

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
  messages: ApiMessage[],
  allowLookups: boolean,
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
      tools: ARCHIVE_TOOLS,
      // After enough lookups, make the artist answer with what it has.
      ...(allowLookups ? {} : { tool_choice: { type: "none" } }),
      // The system prompt only changes when a new piece is published, so let
      // the API cache it between messages.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
    }),
  });
}

/** Drop pictures from a conversation (used when the API can't fetch one). */
function withoutImages(messages: ApiMessage[]): ApiMessage[] {
  const strip = (blocks: ContentBlock[]): ContentBlock[] =>
    blocks
      .filter((b) => b.type !== "image")
      .map((b) =>
        b.type === "tool_result" && Array.isArray(b.content)
          ? { ...b, content: strip(b.content) }
          : b,
      );
  return messages.map((m) =>
    typeof m.content === "string" ? m : { ...m, content: strip(m.content) },
  );
}

function hasImages(messages: ApiMessage[]): boolean {
  return JSON.stringify(messages).includes('"type":"image"');
}

export const respond = internalAction({
  args: {
    sessionId: v.string(),
    assistantId: v.id("chatMessages"),
    artworkId: v.optional(v.id("artworks")),
  },
  handler: async (ctx, args) => {
    const save = async (content: string, status: "streaming" | "done" | "error") => {
      await ctx.runMutation(internal.chat.setAssistantMessage, {
        id: args.assistantId,
        content,
        status,
      });
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("Chat: ANTHROPIC_API_KEY is not set in this Convex deployment.");
      await save("I'm not set up to talk yet. Please try again another day.", "error");
      return;
    }

    const runTool = async (name: string, input: any): Promise<ContentBlock[]> => {
      if (name === "list_works") {
        const text: string = await ctx.runQuery(internal.chat.toolListWorks, {
          startDate: typeof input?.start_date === "string" ? input.start_date : undefined,
          endDate: typeof input?.end_date === "string" ? input.end_date : undefined,
        });
        return [{ type: "text", text }];
      }
      if (name === "search_works") {
        const text: string = await ctx.runQuery(internal.chat.toolSearchWorks, {
          query: String(input?.query ?? "").slice(0, 200),
        });
        return [{ type: "text", text }];
      }
      if (name === "get_work") {
        const work: { text: string; imageUrl: string | null } = await ctx.runQuery(
          internal.chat.toolGetWork,
          {
            id: typeof input?.id === "string" ? input.id : undefined,
            number: Number.isFinite(Number(input?.number)) && input?.number != null
              ? Number(input.number)
              : undefined,
            includeMission: input?.include_mission === true,
          },
        );
        return [
          { type: "text", text: work.text },
          ...(work.imageUrl
            ? [{ type: "image", source: { type: "url", url: work.imageUrl } }]
            : []),
        ];
      }
      return [{ type: "text", text: `Unknown tool: ${name}` }];
    };

    let text = "";
    let flushedLength = 0;
    let lastFlush = Date.now();

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
      const latest = turns[turns.length - 1];
      const note = buildViewingNote(context);
      const latestText = note ? `${note}\n\n${latest.content}` : latest.content;

      // Show the artist the picture the visitor has open (or the newest one).
      const imageUrl = (context.viewing ?? context.featured)?.imageUrl ?? null;
      let messages: ApiMessage[] = [
        ...turns.slice(0, -1),
        {
          role: "user",
          content: imageUrl
            ? [
                { type: "image", source: { type: "url", url: imageUrl } },
                { type: "text", text: latestText },
              ]
            : latestText,
        },
      ];

      for (let round = 0; ; round++) {
        const allowLookups = round < MAX_LOOKUP_ROUNDS;
        const textBeforeRound = text;
        let res = await requestReply(apiKey, system, messages, allowLookups);
        if (res.status === 400 && hasImages(messages)) {
          // Most likely a picture couldn't be fetched or was too large; the
          // written notes are enough to carry the conversation.
          console.warn(`Chat: retrying without images (${await res.text()})`);
          messages = withoutImages(messages);
          res = await requestReply(apiKey, system, messages, allowLookups);
        }
        if (!res.ok || !res.body) {
          throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
        }

        // Read the stream, rebuilding the reply's content blocks exactly as
        // sent: they must be passed back unchanged if the artist used a tool.
        const blocks: ContentBlock[] = [];
        const toolJson: Record<number, string> = {};
        let stopReason: string | null = null;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

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

            if (event.type === "content_block_start") {
              blocks[event.index] = { ...event.content_block };
              if (event.content_block?.type === "tool_use") toolJson[event.index] = "";
            } else if (event.type === "content_block_delta") {
              const block = blocks[event.index];
              const delta = event.delta;
              if (!block || !delta) continue;
              if (delta.type === "text_delta") {
                block.text = (block.text ?? "") + delta.text;
                text += delta.text;
              } else if (delta.type === "input_json_delta") {
                toolJson[event.index] += delta.partial_json ?? "";
              } else if (delta.type === "thinking_delta") {
                block.thinking = (block.thinking ?? "") + delta.thinking;
              } else if (delta.type === "signature_delta") {
                block.signature = (block.signature ?? "") + delta.signature;
              }
            } else if (event.type === "content_block_stop") {
              if (event.index in toolJson) {
                try {
                  blocks[event.index].input = JSON.parse(toolJson[event.index] || "{}");
                } catch {
                  blocks[event.index].input = {};
                }
              }
            } else if (event.type === "message_delta" && event.delta?.stop_reason) {
              stopReason = event.delta.stop_reason;
            } else if (event.type === "error") {
              throw new Error(`Anthropic stream error: ${JSON.stringify(event.error)}`);
            }
          }

          if (text.length > flushedLength && Date.now() - lastFlush >= STREAM_FLUSH_MS) {
            await save(text, "streaming");
            flushedLength = text.length;
            lastFlush = Date.now();
          }
        }

        const toolCalls = blocks.filter((b) => b?.type === "tool_use");
        if (stopReason !== "tool_use" || !toolCalls.length) {
          if (stopReason !== "end_turn") {
            console.warn(`Chat: reply stopped early (stop_reason: ${stopReason}).`);
          }
          break;
        }

        // The artist asked to look something up: run it and continue.
        const results: ContentBlock[] = [];
        for (const call of toolCalls) {
          let content: ContentBlock[];
          try {
            content = await runTool(call.name, call.input);
          } catch (error) {
            console.error(`Chat: tool ${call.name} failed.`, error);
            content = [{ type: "text", text: "That lookup failed. Answer without it." }];
          }
          results.push({ type: "tool_result", tool_use_id: call.id, content });
        }
        results.push({
          type: "text",
          text: "(Answer the visitor now in two to four plain sentences, about 50 words, unless they asked for more. Do not mention looking anything up.)",
        });
        messages = [
          ...messages,
          { role: "assistant", content: blocks.filter(Boolean) },
          { role: "user", content: results },
        ];
        // Anything said before a lookup is a filler line ("let me check");
        // drop it so the reply is just the answer.
        if (text !== textBeforeRound) {
          text = textBeforeRound;
          flushedLength = text.length;
          await save(text, "streaming");
        }
      }

      if (!text.trim()) throw new Error("Empty reply from the API.");
      await save(text.trim(), "done");
    } catch (error) {
      console.error("Chat: reply failed.", error);
      // Keep whatever arrived before the failure rather than discarding it.
      await save(
        text.trim() ? text.trim() : "I lost my train of thought. Would you ask me that again?",
        text.trim() ? "done" : "error",
      );
    }
  },
});
