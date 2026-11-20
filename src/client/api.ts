"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ClientApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** JSON fetch helper for our own API. Redirects to log in when the session has ended. */
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "same-origin",
    });
  } catch {
    throw new ClientApiError(0, "network", "You appear to be offline. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: undefined })
    | { error: { code: string; message: string; details?: Record<string, unknown> } }
    | null;
  if (!res.ok) {
    const err = data && "error" in data && data.error ? data.error : null;
    if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      // Full navigation on purpose: the session is gone, so reset all client state.
      window.location.href = `/login?next=${next}`;
    }
    throw new ClientApiError(res.status, err?.code ?? "error", err?.message ?? "Something went wrong. Try again.", err?.details);
  }
  return data as T;
}

/** Formats a 429 retry hint ("Try again at 14:05"). */
export function limitHint(err: unknown): string | null {
  if (!(err instanceof ClientApiError) || err.status !== 429) return null;
  const resetsAt = err.details?.resetsAt;
  if (typeof resetsAt === "string") {
    const t = new Date(resetsAt);
    return `Available again at ${t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`;
  }
  return null;
}

/** Minimal data hook: loads JSON, exposes reload and local mutate. */
export function useResource<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ClientApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!url) return;
    const id = ++seq.current;
    setLoading(true);
    try {
      const result = await api<T>(url);
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (id === seq.current) setError(err instanceof ClientApiError ? err : new ClientApiError(0, "error", "Could not load."));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
