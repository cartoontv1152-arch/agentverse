import "server-only";
import { and, count, eq, gt, min } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { ApiError } from "@/lib/api";

/** AI usage guardrails (agent runs). Generous for real use, tight enough to protect the free quota. */
export const AI_LIMITS = {
  userPerHour: 40,
  userPerMinute: 6,
  spacePerHour: 120,
};

const HOUR = 60 * 60 * 1000;

async function countRuns(column: "user" | "space", id: string, sinceMs: number) {
  const since = new Date(Date.now() - sinceMs);
  const where =
    column === "user"
      ? and(eq(schema.aiRuns.userId, id), gt(schema.aiRuns.createdAt, since))
      : and(eq(schema.aiRuns.spaceId, id), gt(schema.aiRuns.createdAt, since));
  const [row] = await getDb()
    .select({ n: count(), oldest: min(schema.aiRuns.createdAt) })
    .from(schema.aiRuns)
    .where(where);
  return { n: Number(row?.n ?? 0), oldest: row?.oldest ?? null };
}

function resetTime(oldest: Date | null, windowMs: number): string {
  const at = new Date((oldest?.getTime() ?? Date.now()) + windowMs);
  return at.toISOString();
}

/** Throws a friendly 429 if starting `runs` agent runs would exceed a limit. */
export async function checkAiLimits(userId: string, spaceId: string | null, runs = 1) {
  const [minute, hour, space] = await Promise.all([
    countRuns("user", userId, 60 * 1000),
    countRuns("user", userId, HOUR),
    spaceId ? countRuns("space", spaceId, HOUR) : Promise.resolve({ n: 0, oldest: null }),
  ]);
  if (minute.n + runs > AI_LIMITS.userPerMinute) {
    throw new ApiError(429, "ai_rate_limited", "You're asking agents faster than they can keep up. Wait a few seconds and try again.", {
      scope: "user_minute",
      resetsAt: resetTime(minute.oldest, 60 * 1000),
    });
  }
  if (hour.n + runs > AI_LIMITS.userPerHour) {
    throw new ApiError(429, "ai_rate_limited", `You've used your ${AI_LIMITS.userPerHour} agent replies for this hour.`, {
      scope: "user_hour",
      resetsAt: resetTime(hour.oldest, HOUR),
    });
  }
  if (spaceId && space.n + runs > AI_LIMITS.spacePerHour) {
    throw new ApiError(429, "ai_rate_limited", `This space has used its ${AI_LIMITS.spacePerHour} agent replies for this hour.`, {
      scope: "space_hour",
      resetsAt: resetTime(space.oldest, HOUR),
    });
  }
}

export async function aiUsage(userId: string, spaceId?: string | null) {
  const [hour, space] = await Promise.all([
    countRuns("user", userId, HOUR),
    spaceId ? countRuns("space", spaceId, HOUR) : Promise.resolve(null),
  ]);
  return {
    user: { used: hour.n, limit: AI_LIMITS.userPerHour, resetsAt: hour.n ? resetTime(hour.oldest, HOUR) : null },
    space: space ? { used: space.n, limit: AI_LIMITS.spacePerHour, resetsAt: space.n ? resetTime(space.oldest, HOUR) : null } : null,
  };
}
