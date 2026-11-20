import Link from "next/link";

/** Two-column auth frame: the form, and a plain explanation of what agents do in a space. */
export function AuthLayout({ title, subtitle, children, aside }: { title: string; subtitle: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="grid size-6 place-items-center rounded-[22%] bg-accent text-[0.7rem] font-bold text-paper">A</span>
          AgentVerse
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mb-7 mt-1.5 text-ink/65">{subtitle}</p>
          {children}
        </div>
      </div>
      <aside className="hidden border-l border-ink/10 bg-ink text-paper lg:flex lg:flex-col lg:justify-center lg:px-14">{aside}</aside>
    </div>
  );
}
