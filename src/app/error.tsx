"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-dvh flex-col px-5 py-6 sm:px-10">
      <Link href="/" aria-label="AgentVerse home" className="self-start rounded-control">
        <Logo />
      </Link>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-16">
        <h1 className="text-4xl font-semibold tracking-[-0.02em]">This page didn&apos;t load</h1>
        <p className="mt-3 text-lg text-ink/65">Something failed on our side while loading it. Your messages and spaces are safe. Try again, or go back to your spaces.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className="inline-flex h-11 items-center rounded-control bg-accent px-5 font-semibold text-white hover:bg-accent-strong">
            Try again
          </button>
          <Link href="/app" className="inline-flex h-11 items-center rounded-control border border-ink/15 bg-surface px-5 font-semibold hover:border-ink/30">
            Go to your spaces
          </Link>
        </div>
      </main>
    </div>
  );
}
