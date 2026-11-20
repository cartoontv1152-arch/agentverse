import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const INK = "#161a2c";
const S = 3.5; // logo units (32) -> pixels
const O = 34; // centres the 112px mark in the 180px tile

/** Home screen icon: the person circle and agent square on navy ink. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: INK }}>
        <div style={{ position: "absolute", left: O + (10 - 7.5) * S, top: O + (19 - 7.5) * S, width: 15 * S, height: 15 * S, borderRadius: 999, background: "#f6f7f9" }} />
        <div style={{ position: "absolute", left: O + 12 * S, top: O + 3 * S, width: 19 * S, height: 19 * S, borderRadius: 6 * S, background: INK }} />
        <div style={{ position: "absolute", left: O + 14 * S, top: O + 5 * S, width: 15 * S, height: 15 * S, borderRadius: 4.25 * S, background: "#3554e0" }} />
      </div>
    ),
    size,
  );
}
