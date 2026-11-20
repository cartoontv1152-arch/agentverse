import "server-only";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Cryptographically random alphanumeric string (no modulo bias). */
export function randomAlnum(length: number): string {
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < 248) out += ALPHABET[byte % 62];
      if (out.length === length) break;
    }
  }
  return out;
}

/**
 * Nexconn ids are shared across apps on one App Key, so every id carries the app prefix plus a
 * kind letter: u = person, a = agent, g = group channel. Letters and digits only, never sequential.
 */
export function newNexconnId(kind: "u" | "a" | "g"): string {
  return `${env.nexconnIdPrefix}${kind}${randomAlnum(20)}`;
}
