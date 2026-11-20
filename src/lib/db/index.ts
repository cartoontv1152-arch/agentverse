import "server-only";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

/**
 * Retries a query request only when the connection itself failed (no HTTP response was
 * received), so a statement is never executed twice. Smooths over transient network errors.
 */
async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

function createDb() {
  neonConfig.fetchFunction = resilientFetch;
  return drizzle(neon(env.databaseUrl), { schema });
}

let instance: Db | undefined;

/** Lazily created Drizzle client over Neon's HTTP driver (one round trip per query). */
export function getDb(): Db {
  instance ??= createDb();
  return instance;
}

export { schema };
