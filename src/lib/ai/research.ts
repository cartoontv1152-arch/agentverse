import "server-only";
import type { Source } from "@/lib/message-types";
import { readUrlWithGemini } from "@/lib/ai/gemini";

/**
 * Research tools for agents with the "search" capability. All are real, keyless public APIs:
 * - Wikipedia REST search + page summary (https://en.wikipedia.org/w/rest.php, /api/rest_v1)
 * - Hacker News search by Algolia (https://hn.algolia.com/api)
 * - Gemini url_context tool to read a specific web page
 * Each result carries numbered sources so the agent can cite [n] and the UI can show them.
 */

const USER_AGENT = "AgentVerse/1.0 (https://github.com/imthegoodboy/agentverse; research agent)";

export class SourceRegistry {
  private list: Source[] = [];

  /** Adds a source (deduped by URL) and returns its 1-based citation number. */
  add(source: Source): number {
    const existing = this.list.findIndex((s) => s.url === source.url);
    if (existing >= 0) return existing + 1;
    this.list.push(source);
    return this.list.length;
  }

  get all(): Source[] {
    return [...this.list];
  }

  /** Sources whose [n] marker appears in the answer, in citation order. */
  cited(text: string): { n: number; source: Source }[] {
    const used = new Set<number>();
    for (const match of text.matchAll(/\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g)) {
      for (const n of match[1].split(",")) used.add(Number(n.trim()));
    }
    return [...used]
      .filter((n) => n >= 1 && n <= this.list.length)
      .sort((a, b) => a - b)
      .map((n) => ({ n, source: this.list[n - 1] }));
  }
}

async function getJson<T>(url: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(7000),
        cache: "no-store",
      });
      if (res.status === 404) throw new Error("not_found");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.message === "not_found") break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("request failed");
}

interface WikiQueryResponse {
  query?: {
    pages?: { pageid: number; title: string; index?: number; extract?: string; fullurl?: string; touched?: string; missing?: boolean }[];
  };
}

/** One request: full-text search plus the intro extract of the top 3 articles. */
export async function wikipediaSearch(query: string, registry: SourceRegistry, lang = "en") {
  const safeLang = /^[a-z]{2,3}$/.test(lang) ? lang : "en";
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "3",
    prop: "extracts|info",
    inprop: "url",
    exintro: "1",
    explaintext: "1",
    exlimit: "3",
    redirects: "1",
  });
  const data = await getJson<WikiQueryResponse>(`https://${safeLang}.wikipedia.org/w/api.php?${params}`);
  const pages = (data.query?.pages ?? [])
    .filter((p) => !p.missing)
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  const results = pages.map((page) => {
    const url = page.fullurl ?? `https://${safeLang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
    const n = registry.add({ title: `${page.title} (Wikipedia)`, url });
    return {
      source: n,
      title: page.title,
      summary: (page.extract ?? "").slice(0, 1500),
      lastEdited: page.touched ?? null,
      url,
    };
  });
  return results.length
    ? { results, tip: "Intros only. To get specific details from an article, call read_url on its url." }
    : { results: [], note: "No Wikipedia articles matched. Try different or broader terms." };
}

interface HnResponse {
  hits: {
    objectID: string;
    title?: string | null;
    story_title?: string | null;
    url?: string | null;
    points?: number | null;
    num_comments?: number | null;
    created_at?: string;
    author?: string;
  }[];
}

export async function hackerNewsSearch(query: string, registry: SourceRegistry, recent = false) {
  const endpoint = recent ? "search_by_date" : "search";
  const data = await getJson<HnResponse>(
    `https://hn.algolia.com/api/v1/${endpoint}?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=6`,
  );
  const results = data.hits
    .filter((h) => h.title || h.story_title)
    .slice(0, 6)
    .map((h) => {
      const discussion = `https://news.ycombinator.com/item?id=${h.objectID}`;
      const title = (h.title ?? h.story_title ?? "").slice(0, 200);
      const n = registry.add({ title: `${title} (Hacker News)`, url: h.url || discussion });
      return {
        source: n,
        title,
        url: h.url || discussion,
        discussion,
        points: h.points ?? 0,
        comments: h.num_comments ?? 0,
        postedAt: h.created_at ?? null,
      };
    });
  return results.length ? { results } : { results: [], note: "No Hacker News stories matched." };
}

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|\[::1\])/i;

export function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !PRIVATE_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

export async function readUrl(url: string, question: string, registry: SourceRegistry) {
  if (!isPublicHttpUrl(url)) return { error: "Only public http(s) links can be read." };
  const result = await readUrlWithGemini(url, question);
  if (!result.ok) return { error: result.error };
  const host = new URL(url).hostname.replace(/^www\./, "");
  const n = registry.add({ title: result.title ? `${result.title} (${host})` : host, url });
  return { source: n, url, findings: result.text };
}

export function extractUrls(text: string): string[] {
  return [...new Set(text.match(/https?:\/\/[^\s<>()]+/g) ?? [])].filter(isPublicHttpUrl).slice(0, 3);
}
