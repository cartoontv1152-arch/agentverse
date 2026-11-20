/**
 * Applies pending SQL migrations from drizzle/ over Neon's HTTP driver (no websocket needed).
 * Same bookkeeping table as drizzle-kit migrate. Run: npm run db:migrate
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
await migrate(drizzle(neon(url)), { migrationsFolder: "drizzle" });
console.log("migrations applied");
