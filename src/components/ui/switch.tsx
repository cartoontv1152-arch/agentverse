/** Accessible on/off switch. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-accent" : "bg-ink/20"}`}
    >
      <span
        aria-hidden
        className={`size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(22_26_44/0.3)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}
