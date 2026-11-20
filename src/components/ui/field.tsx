import { forwardRef, useId } from "react";
import { AlertCircle } from "lucide-react";

const control =
  "w-full rounded-control border border-ink/14 bg-surface px-3 text-base text-ink placeholder:text-ink/40 transition-[border-color,box-shadow] hover:border-ink/26 focus:border-accent focus:outline-none focus-visible:outline-none focus:ring-[3px] focus:ring-accent/15 disabled:bg-ink/3 disabled:text-ink/55 aria-[invalid=true]:border-signal aria-[invalid=true]:focus:ring-signal/15";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-signal">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink/55">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = "", ...rest },
  ref,
) {
  return <input ref={ref} className={`${control} h-10 ${className}`} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className = "", ...rest },
  ref,
) {
  return <textarea ref={ref} className={`${control} py-2 leading-relaxed ${className}`} {...rest} />;
});

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex animate-rise items-start gap-2 rounded-control border border-signal/25 bg-signal/6 px-3 py-2.5 text-sm text-ink">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-signal" />
      {message}
    </div>
  );
}
