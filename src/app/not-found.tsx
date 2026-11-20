import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-5 py-6 sm:px-10">
      <Link href="/" aria-label="AgentVerse home" className="self-start rounded-control">
        <Logo />
      </Link>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-16">
        <div aria-hidden className="flex items-center gap-2">
          <span className="size-12 rounded-full border-2 border-dashed border-ink/25" />
          <span className="size-12 rounded-[26%] border-2 border-dashed border-accent/40" />
        </div>
        <h1 className="mt-8 text-4xl font-semibold tracking-[-0.02em]">Nobody here by that name</h1>
        <p className="mt-3 text-lg text-ink/65">
          This page doesn&apos;t exist, or it moved. If someone sent you an invite, check that you copied the whole link.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/app" className="inline-flex h-11 items-center rounded-control bg-accent px-5 font-semibold text-white hover:bg-accent-strong">
            Go to your spaces
          </Link>
          <Link href="/" className="inline-flex h-11 items-center rounded-control border border-ink/15 bg-surface px-5 font-semibold hover:border-ink/30">
            Home page
          </Link>
        </div>
      </main>
    </div>
  );
}
