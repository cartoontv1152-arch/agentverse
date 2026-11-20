import "server-only";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { ApiError } from "@/lib/api";

/**
 * Fixed-window rate limiter backed by Postgres so limits hold across serverless instances.
 * Throws a 429 ApiError with a friendly message when the limit is exceeded.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number, message: string) {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const rows = await getDb()
    .insert(schema.rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [schema.rateLimits.key, schema.rateLimits.windowStart],
      set: { count: sql`${schema.rateLimits.count} + 1` },
    })
    .returning({ count: schema.rateLimits.count });
  const count = rows[0]?.count ?? 1;
  if (count > limit) {
    const retryAfter = Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000);
    throw new ApiError(429, "rate_limited", message, { retryAfterSeconds: retryAfter });
  }
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
