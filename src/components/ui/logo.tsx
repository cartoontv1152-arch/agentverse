import { useId } from "react";

/**
 * The AgentVerse mark: a person (circle) and an agent (square) in one conversation. The square
 * sits in front with a clear gap, so the mark reads on any background.
 */
export function LogoMark({ className = "size-7", tone = "default" }: { className?: string; tone?: "default" | "inverse" }) {
  const id = useId().replace(/:/g, "");
  const person = tone === "inverse" ? "#f6f7f9" : "#161a2c";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <defs>
        <mask id={`gap-${id}`} maskUnits="userSpaceOnUse">
          <rect width="32" height="32" fill="#fff" />
          <rect x="11" y="4" width="20" height="20" rx="6.5" fill="#000" />
        </mask>
      </defs>
      <circle cx="11" cy="17" r="8" fill={person} mask={`url(#gap-${id})`} />
      <rect x="13" y="6" width="16" height="16" rx="4.5" fill="#3554e0" />
    </svg>
  );
}

export function Logo({ className = "", tone = "default", size = "md" }: { className?: string; tone?: "default" | "inverse"; size?: "md" | "lg" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={size === "lg" ? "size-8" : "size-7"} tone={tone} />
      <span className={`font-display font-semibold tracking-[-0.02em] ${size === "lg" ? "text-xl" : "text-[1.05rem]"} ${tone === "inverse" ? "text-paper" : "text-ink"}`}>
        AgentVerse
      </span>
    </span>
  );
}
