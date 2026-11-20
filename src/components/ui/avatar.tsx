/* eslint-disable @next/next/no-img-element */

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const sizes: Record<Size, string> = {
  xs: "size-5 text-[0.6rem]",
  sm: "size-7 text-[0.7rem]",
  md: "size-9 text-xs",
  lg: "size-12 text-base",
  xl: "size-20 text-2xl",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Identity mark. People are circles; agents are squares with a viridian frame.
 * The shape difference is the product's core visual rule.
 */
export function Avatar({
  name,
  src,
  kind = "user",
  size = "md",
  className = "",
}: {
  name: string;
  src?: string | null;
  kind?: "user" | "agent";
  size?: Size;
  className?: string;
}) {
  const shape = kind === "agent" ? "rounded-[22%]" : "rounded-full";
  const tone =
    kind === "agent"
      ? "bg-accent text-paper ring-1 ring-accent/40 ring-offset-1 ring-offset-paper"
      : "bg-ink/10 text-ink/80";
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-semibold ${shape} ${sizes[size]} ${tone} ${className}`}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : <span>{kind === "agent" ? name.trim()[0]?.toUpperCase() : initials(name)}</span>}
    </span>
  );
}
