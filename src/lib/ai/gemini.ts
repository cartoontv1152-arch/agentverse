import "server-only";
import { GoogleGenAI, type Content, type GenerateContentConfig, type GenerateContentResponse } from "@google/genai";
import { env } from "@/lib/env";

/**
 * Gemini access with the resilience the free tier needs: per-call timeouts, exponential backoff on
 * 429/503 and a fallback model (GEMINI_FALLBACK_MODEL). Model names always come from env.
 */

let client: GoogleGenAI | null = null;

export class AiUnavailableError extends Error {
  constructor(
    message: string,
    public kind: "not_configured" | "busy" | "failed",
  ) {
    super(message);
  }
}

export function getGemini(): GoogleGenAI {
  if (!env.geminiApiKey) throw new AiUnavailableError("AI is not configured on this server.", "not_configured");
  client ??= new GoogleGenAI({ apiKey: env.geminiApiKey });
  return client;
}

export function modelChain(): string[] {
  return [...new Set([env.geminiModel, env.geminiFallbackModel].filter(Boolean))];
}

function statusOf(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const e = err as { status?: unknown; code?: unknown; message?: unknown };
    if (typeof e.status === "number") return e.status;
    if (typeof e.code === "number") return e.code;
    if (typeof e.message === "string") {
      const m = e.message.match(/\b(429|500|502|503|504)\b/);
      if (m) return Number(m[1]);
    }
  }
  return undefined;
}

export function isRetryable(err: unknown): boolean {
  const status = statusOf(err);
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return true;
  const message = err instanceof Error ? err.message : String(err);
  return /timeout|timed out|ECONNRESET|ENOTFOUND|fetch failed|network|aborted/i.test(message);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `attempt(model)` with retries: each model gets up to 2 tries with backoff on retryable
 * errors, then the next model in the chain is used.
 */
export async function withModelFallback<T>(attempt: (model: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const model of modelChain()) {
    for (let i = 0; i < 2; i++) {
      try {
        return await attempt(model);
      } catch (err) {
        lastError = err;
        if (!isRetryable(err)) throw toAiError(err);
        await sleep(700 * 2 ** i + Math.random() * 300);
      }
    }
  }
  throw toAiError(lastError);
}

export function toAiError(err: unknown): AiUnavailableError {
  if (err instanceof AiUnavailableError) return err;
  const status = statusOf(err);
  if (status === 429 || status === 503) {
    return new AiUnavailableError("The AI service is busy right now. Try again in a minute.", "busy");
  }
  console.error("[ai] request failed", err);
  return new AiUnavailableError("The AI service could not complete this request.", "failed");
}

export async function generate(contents: Content[] | string, config: GenerateContentConfig, timeoutMs = 25000) {
  const ai = getGemini();
  return withModelFallback(async (model) => {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: { ...config, abortSignal: AbortSignal.timeout(timeoutMs) },
    });
    return response;
  });
}

export async function openStream(contents: Content[], config: GenerateContentConfig, model: string, timeoutMs = 45000) {
  const ai = getGemini();
  return ai.models.generateContentStream({
    model,
    contents,
    config: { ...config, abortSignal: AbortSignal.timeout(timeoutMs) },
  });
}

export function responseText(response: GenerateContentResponse): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();
}

/** Reads a public web page with Gemini's url_context tool and extracts what matters for `question`. */
export async function readUrlWithGemini(
  url: string,
  question: string,
): Promise<{ ok: true; text: string; title: string | null } | { ok: false; error: string }> {
  try {
    const response = await generate(
      [
        {
          role: "user",
          parts: [
            {
              text: `Read this page: ${url}\n\nFirst line: the page title only, prefixed with "TITLE: ".\nThen extract the facts from the page that help answer: ${question}\nBe factual and concise (max 200 words). If the page cannot be read, reply exactly: UNREADABLE`,
            },
          ],
        },
      ],
      { tools: [{ urlContext: {} }], maxOutputTokens: 700, temperature: 0.2 },
      30000,
    );
    const meta = response.candidates?.[0]?.urlContextMetadata?.urlMetadata ?? [];
    const retrieved = meta.some((m) => String(m.urlRetrievalStatus ?? "").includes("SUCCESS"));
    const text = responseText(response);
    if (!text || text.includes("UNREADABLE") || (meta.length > 0 && !retrieved)) {
      return { ok: false, error: "That page could not be read (it may block automated access)." };
    }
    const lines = text.split("\n");
    const title = lines[0]?.startsWith("TITLE:") ? lines[0].replace("TITLE:", "").trim().slice(0, 120) : null;
    return { ok: true, title, text: (title ? lines.slice(1).join("\n") : text).trim().slice(0, 2000) };
  } catch (err) {
    const aiErr = toAiError(err);
    return { ok: false, error: aiErr.message };
  }
}
