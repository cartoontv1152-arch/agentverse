"use client";

/** Last-resort error screen when the root layout itself fails. Plain styles: global CSS may not load. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f6f7f9", color: "#161a2c", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 460, padding: 24 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>AgentVerse didn&apos;t load</h1>
          <p style={{ color: "#5d6274", lineHeight: 1.5 }}>Something failed while starting the app. Your spaces and messages are safe. Try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 12, height: 44, padding: "0 20px", border: 0, borderRadius: 9, background: "#3554e0", color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
