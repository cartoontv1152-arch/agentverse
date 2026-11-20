/* eslint-disable @next/next/no-img-element */
import { agentVisual } from "@/lib/agent-visual";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const sizes: Record<Size, { box: string; icon: string }> = {
  xs: { box: "size-5 text-[0.6rem]", icon: "size-3" },
  sm: { box: "size-7 text-[0.7rem]", icon: "size-3.5" },
  md: { box: "size-9 text-xs", icon: "size-[1.1rem]" },
  lg: { box: "size-12 text-base", icon: "size-6" },
  xl: { box: "size-20 text-2xl", icon: "size-9" },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Identity mark. People are circles; agents are squares in their own hue (built-in agents also
 * show their icon). The shape difference is the product's core visual rule.
 */
export function Avatar({
  name,
  src,
  kind = "user",
  size = "md",
  handle,
  seed,
  className = "",
}: {
  name: string;
  src?: string | null;
  kind?: "user" | "agent";
  size?: Size;
  /** Agents: mention handle, used to pick the built-in hue and icon. */
  handle?: string | null;
  /** Agents: stable id for custom agent hues. */
  seed?: string | null;
  className?: string;
}) {
  const s = sizes[size];
  if (kind === "agent") {
    const visual = agentVisual(handle, seed ?? name);
    const Icon = visual.icon;
    return (
      <span
        aria-hidden
        style={src ? undefined : { backgroundColor: visual.colors.bg, color: visual.colors.fg }}
        className={`relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-[26%] font-semibold ${s.box} ${className}`}
      >
        {src ? (
          <img src={src} alt="" className="size-full object-cover" />
        ) : Icon ? (
          <Icon className={s.icon} strokeWidth={2.25} />
        ) : (
          <span>{name.trim()[0]?.toUpperCase() ?? "A"}</span>
        )}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-[#e3e6ee] font-semibold text-ink/75 ${s.box} ${className}`}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : <span>{initials(name)}</span>}
    </span>
  );
}
