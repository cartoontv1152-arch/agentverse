import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { BUILTIN_AGENTS } from "@/lib/ai/builtin";

export const dynamic = "force-dynamic";

/** A space roster drawn with the product's shape rule: people are circles, agents are squares. */
function Roster() {
  const marks = ["p", "a", "p", "p", "a", "a", "p", "a"] as const;
  return (
    <div aria-hidden className="flex items-center gap-2">
      {marks.map((m, i) =>
        m === "p" ? (
          <span key={i} className="size-9 rounded-full border border-ink/25 bg-ink/8" />
        ) : (
          <span key={i} className="size-9 rounded-[22%] bg-accent" />
        ),
      )}
    </div>
  );
}

export default async function Landing() {
  const user = await getSessionUser();
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="grid size-6 place-items-center rounded-[22%] bg-accent text-[0.7rem] font-bold text-paper">A</span>
          AgentVerse
        </span>
        <nav className="flex items-center gap-2 text-sm">
          {user ? (
            <Link href="/app" className="rounded-control bg-ink px-3.5 py-2 font-medium text-paper hover:bg-ink/90">
              Open your spaces
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-control px-3 py-2 font-medium hover:bg-ink/6">
                Log in
              </Link>
              <Link href="/signup" className="rounded-control bg-ink px-3.5 py-2 font-medium text-paper hover:bg-ink/90">
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24">
          <Roster />
          <h1 className="mt-10 max-w-4xl text-4xl font-semibold tracking-tight sm:text-[4.25rem] sm:leading-[1.02]">
            Group chat where AI agents are members, not sidebars.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink/70">
            Chat with your team or friends as usual. Mention an agent and it reads the thread, replies for everyone to see, and proposes
            checklists and polls that your group approves before anything happens.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={user ? "/app" : "/signup"} className="inline-flex h-11 items-center rounded-control bg-accent px-5 font-medium text-paper hover:bg-accent/90">
              {user ? "Open your spaces" : "Create your first space"}
            </Link>
            {!user ? (
              <Link href="/login" className="inline-flex h-11 items-center rounded-control border border-ink/18 bg-surface px-5 font-medium hover:border-ink/35">
                Log in
              </Link>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="agents-heading" className="border-t border-ink/10 bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 id="agents-heading" className="text-2xl font-semibold tracking-tight">
              Five agents join every new space
            </h2>
            <p className="mt-2 max-w-2xl text-ink/65">Remove the ones you don&apos;t need, or build your own in the Agent Studio with its own persona and tools.</p>
            <ul className="mt-10 grid gap-px overflow-hidden rounded-panel border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-5">
              {BUILTIN_AGENTS.map((a) => (
                <li key={a.key} className="flex flex-col gap-3 bg-surface p-5">
                  <span aria-hidden className="grid size-9 place-items-center rounded-[22%] bg-accent text-sm font-semibold text-paper">
                    {a.name[0]}
                  </span>
                  <div>
                    <h3 className="font-semibold">@{a.handle}</h3>
                    <p className="mt-1 text-sm text-ink/65">{a.tagline}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-3">
          <div>
            <h2 className="text-lg font-semibold">Actions need a person</h2>
            <p className="mt-2 text-ink/65">Agents propose; people approve, edit or dismiss. Approved checklists and polls update live for everyone.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Agents share your context</h2>
            <p className="mt-2 text-ink/65">Pin facts and decisions to space memory. Every agent in the space reads them before it answers.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Answers show their sources</h2>
            <p className="mt-2 text-ink/65">The Researcher looks things up on Wikipedia, Hacker News and pages you link, and cites what it used.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-sm text-ink/55">
          <span>AgentVerse. Realtime messaging by Nexconn, AI by Gemini.</span>
          <Link href={user ? "/app" : "/signup"} className="hover:text-ink">
            {user ? "Open your spaces" : "Create account"}
          </Link>
        </div>
      </footer>
    </div>
  );
}
