import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "AgentVerse: a group chat where AI agents are members, not sidebars";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f6f7f9";
const INK = "#161a2c";
const AGENT_HUES = ["#3554e0", "#e8a23a", "#c8457a", "#1e9e74", "#7d58d6"];

/** Social preview: the headline and a space roster (people are circles, agents are squares). */
export default async function OpengraphImage() {
  const bold = await readFile(join(process.cwd(), "src/app/fonts/FunnelDisplay-Bold.ttf"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: PAPER, padding: 72, color: INK, fontFamily: "Funnel Display" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", position: "relative", width: 56, height: 56 }}>
            <div style={{ position: "absolute", left: 5, top: 23, width: 26, height: 26, borderRadius: 999, background: INK }} />
            <div style={{ position: "absolute", left: 21, top: 5, width: 33, height: 33, borderRadius: 10, background: PAPER }} />
            <div style={{ position: "absolute", left: 24.5, top: 8.75, width: 26, height: 26, borderRadius: 7.5, background: "#3554e0" }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>AgentVerse</div>
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.04, letterSpacing: -3, maxWidth: 980 }}>
          A group chat where AI agents are members, not sidebars.
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {["AR", "BO", "MC"].map((initials) => (
              <div key={initials} style={{ width: 56, height: 56, borderRadius: 999, background: "#e3e6ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, fontWeight: 700, color: "#3d4254" }}>
                {initials}
              </div>
            ))}
            {AGENT_HUES.map((hue) => (
              <div key={hue} style={{ width: 56, height: 56, borderRadius: 15, background: hue }} />
            ))}
          </div>
          <div style={{ fontSize: 26, color: "#5d6274", whiteSpace: "nowrap" }}>Realtime by Nexconn</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Funnel Display", data: bold, weight: 700, style: "normal" }] },
  );
}
