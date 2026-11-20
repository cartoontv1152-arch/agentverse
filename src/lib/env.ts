import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

/** Server-side configuration. Values are read lazily so builds succeed without secrets. */
export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get nexconnAppKey() {
    return required("NEXCONN_APP_KEY");
  },
  get nexconnAppSecret() {
    return required("NEXCONN_APP_SECRET");
  },
  get nexconnApiBase() {
    return (process.env.NEXCONN_API_BASE ?? "https://api.sg-light-api.com").replace(/\/$/, "");
  },
  get nexconnIdPrefix() {
    const prefix = process.env.NEXCONN_ID_PREFIX ?? "agv";
    if (!/^[A-Za-z0-9]{1,12}$/.test(prefix)) throw new Error("NEXCONN_ID_PREFIX must be 1-12 letters or digits");
    return prefix;
  },
  get geminiApiKey() {
    return process.env.GEMINI_API_KEY ?? "";
  },
  get geminiModel() {
    return process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
  },
  get geminiFallbackModel() {
    return process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.1-flash-lite";
  },
  get blobToken() {
    return process.env.BLOB_READ_WRITE_TOKEN ?? "";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
