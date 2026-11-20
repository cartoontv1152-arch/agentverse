import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet" | "dark";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white border border-accent hover:bg-accent-strong hover:border-accent-strong shadow-[0_1px_0_rgb(255_255_255/0.18)_inset]",
  secondary: "bg-surface text-ink border border-ink/14 hover:border-ink/28 hover:bg-white",
  ghost: "text-ink/75 hover:bg-ink/6 hover:text-ink border border-transparent",
  danger: "bg-signal text-white border border-signal hover:bg-signal/90",
  quiet: "text-accent hover:bg-accent/8 border border-transparent",
  dark: "bg-ink text-paper border border-ink hover:bg-ink/88",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-[0.95rem] gap-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, className = "", children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-control font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-control text-ink/60 transition-colors hover:bg-ink/6 hover:text-ink disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
