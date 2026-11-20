import { describe, expect, it } from "vitest";
import { mergeMessages, messagePreview, type ChatMessage } from "@/client/chat/store";
import { formatSourcesFooter, parseStreamSummary, splitSourcesFooter } from "@/lib/message-types";
import { looksLikeOpenQuestion, resolveMentionedAgents } from "@/lib/mentions";
import { SourceRegistry, extractUrls, isPublicHttpUrl } from "@/lib/ai/research";
import { safeNext } from "@/lib/safe-next";

function msg(partial: Partial<ChatMessage>): ChatMessage {
  return {
    key: partial.messageId ?? "k",
    messageId: null,
    channelKey: "g:test",
    senderId: "u1",
    type: "RC:TxtMsg",
    content: { text: "hi" },
    sentTime: 1,
    status: "sent",
    metadata: {},
    isPrivate: false,
    edited: false,
    mentionedIds: [],
    needReceipt: false,
    receiptSent: false,
    ...partial,
  };
}

describe("mergeMessages", () => {
  it("dedupes by message id and keeps server-time order", () => {
    const a = msg({ messageId: "A", key: "A", sentTime: 20 });
    const b = msg({ messageId: "B", key: "B", sentTime: 10 });
    const merged = mergeMessages([a], [b, { ...a, content: { text: "edited" } }]);
    expect(merged.map((m) => m.messageId)).toEqual(["B", "A"]);
    expect(merged[1].content.text).toBe("edited");
  });

  it("keeps the local key when the server copy replaces an optimistic message", () => {
    const local = msg({ key: "local-1", messageId: "X", sentTime: 5 });
    const merged = mergeMessages([local], [msg({ key: "X", messageId: "X", sentTime: 6 })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].key).toBe("local-1");
  });

  it("merges metadata and never moves streamed text backwards", () => {
    const streaming = msg({ messageId: "S", type: "RC:StreamMsg", streamText: "Hello world", metadata: { a: "1" } });
    const stale = msg({ messageId: "S", type: "RC:StreamMsg", streamText: "Hello", metadata: { b: "2" } });
    const [m] = mergeMessages([streaming], [stale]);
    expect(m.streamText).toBe("Hello world");
    expect(m.metadata).toEqual({ a: "1", b: "2" });
  });
});

describe("message previews", () => {
  it("describes cards and streams", () => {
    expect(messagePreview({ type: "AGV:Tasks", content: { title: "Trip" } })).toBe("Checklist: Trip");
    expect(messagePreview({ type: "RC:StreamMsg", content: { content: "x" }, streamText: "full" })).toBe("full");
  });
});

describe("sources footer", () => {
  it("round-trips cited sources", () => {
    const footer = formatSourcesFooter([
      { n: 1, source: { title: "Trams in Lisbon (Wikipedia)", url: "https://en.wikipedia.org/wiki/Trams_in_Lisbon" } },
      { n: 3, source: { title: "Carris [operator]", url: "https://en.wikipedia.org/wiki/Carris" } },
    ]);
    const { body, sources } = splitSourcesFooter(`Answer [1][3].${footer}`);
    expect(body).toBe("Answer [1][3].");
    expect(sources).toEqual([
      { n: 1, title: "Trams in Lisbon (Wikipedia)", url: "https://en.wikipedia.org/wiki/Trams_in_Lisbon" },
      { n: 3, title: "Carris operator", url: "https://en.wikipedia.org/wiki/Carris" },
    ]);
  });

  it("leaves text without a footer untouched", () => {
    expect(splitSourcesFooter("plain text")).toEqual({ body: "plain text", sources: [] });
  });

  it("parses the stream summary metadata Nexconn keeps", () => {
    expect(parseStreamSummary('{"complete":true,"summary":"done"}')).toEqual({ complete: true, text: "done" });
    expect(parseStreamSummary("not json")).toBeNull();
    expect(parseStreamSummary(undefined)).toBeNull();
  });
});

describe("SourceRegistry", () => {
  it("numbers sources, dedupes by URL and finds citations including grouped ones", () => {
    const r = new SourceRegistry();
    expect(r.add({ title: "A", url: "https://a.test" })).toBe(1);
    expect(r.add({ title: "B", url: "https://b.test" })).toBe(2);
    expect(r.add({ title: "A again", url: "https://a.test" })).toBe(1);
    r.add({ title: "C", url: "https://c.test" });
    expect(r.cited("See [3] and [1, 2]. Not [9].").map((c) => c.n)).toEqual([1, 2, 3]);
    expect(r.cited("no citations")).toEqual([]);
  });
});

describe("URL safety", () => {
  it("only allows public http(s) links", () => {
    expect(isPublicHttpUrl("https://example.com/page")).toBe(true);
    expect(isPublicHttpUrl("http://localhost:3000")).toBe(false);
    expect(isPublicHttpUrl("http://192.168.1.4/admin")).toBe(false);
    expect(isPublicHttpUrl("file:///etc/passwd")).toBe(false);
    expect(extractUrls("read https://a.test/x and http://10.0.0.1 now")).toEqual(["https://a.test/x"]);
  });

  it("keeps post-login redirects on this site", () => {
    expect(safeNext("/app/s/1")).toBe("/app/s/1");
    expect(safeNext("//evil.test")).toBe("/app");
    expect(safeNext("https://evil.test")).toBe("/app");
    expect(safeNext(null)).toBe("/app");
  });
});

describe("mention resolution", () => {
  const agents = [
    { handle: "Researcher", nexconnId: "agvaR" },
    { handle: "Planner", nexconnId: "agvaP" },
    { handle: "Pollster", nexconnId: "agvaO" },
  ];

  it("returns agents in the order they are mentioned", () => {
    const found = resolveMentionedAgents("@researcher find options, then @Planner make a plan", [], agents);
    expect(found.map((a) => a.handle)).toEqual(["Researcher", "Planner"]);
  });

  it("uses Nexconn mentionedInfo ids and ignores partial handles", () => {
    expect(resolveMentionedAgents("hey", ["agvaO"], agents).map((a) => a.handle)).toEqual(["Pollster"]);
    expect(resolveMentionedAgents("@PlannerX and email@Researcher.com", [], agents)).toEqual([]);
  });

  it("detects open questions for auto replies", () => {
    expect(looksLikeOpenQuestion("What time does the museum open?")).toBe(true);
    expect(looksLikeOpenQuestion("ok?")).toBe(false);
    expect(looksLikeOpenQuestion("@Ben are you coming tonight?")).toBe(false);
  });
});
