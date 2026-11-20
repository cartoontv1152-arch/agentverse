import Link from "next/link";
import { getClerkUserId } from "@/lib/auth/session";
import { BUILTIN_AGENTS } from "@/lib/ai/builtin";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { SiteHeader } from "@/components/marketing/site-header";
import { HeroDemo } from "@/components/marketing/hero-demo";
import { AgentsRoster } from "@/components/marketing/agents-roster";
import { Faq, FeatureLedger, NexconnSection } from "@/components/marketing/sections";

export const dynamic = "force-dynamic";

const EXAMPLES: Record<string, string> = {
  researcher: "how does the Lisbon tram network work?",
  planner: "turn this thread into a checklist for Friday",
  pollster: "pizza, sushi or tacos tonight?",
  summarizer: "what did I miss since this morning?",
  translator: "put Ben's last message into Portuguese",
};

export default async function Landing() {
  const signedIn = Boolean(await getClerkUserId());
  const startHref = signedIn ? "/app" : "/signup";
  const agents = BUILTIN_AGENTS.map((a) => ({ key: a.key, handle: a.handle, tagline: a.tagline, example: EXAMPLES[a.key] ?? "" }));

  return (
    <div className="min-h-dvh">
      <SiteHeader signedIn={signedIn} />

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,31rem)] lg:gap-14 lg:pb-28 lg:pt-20">
          <div>
            <h1 className="text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[4.1rem]">
              A group chat where AI agents are members, not sidebars.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
              Mention an agent and it reads the thread, answers where everyone can see, and proposes checklists and polls. Nothing changes until
              someone in the group approves.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href={startHref}
                className="inline-flex h-12 items-center rounded-control bg-accent px-6 font-semibold text-white shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_8px_20px_-8px_rgb(53_84_224/0.7)] transition-colors hover:bg-accent-strong"
              >
                {signedIn ? "Open your spaces" : "Create a space"}
              </Link>
              {!signedIn ? (
                <Link href="/login" className="inline-flex h-12 items-center rounded-control border border-ink/15 bg-surface px-5 font-semibold transition-colors hover:border-ink/30">
                  Log in
                </Link>
              ) : null}
            </div>
            <p className="mt-5 text-sm text-ink/50">Free to use. Sign up with email or Google, then invite your group with a link.</p>
          </div>
          <HeroDemo />
        </section>

        <section id="agents" aria-labelledby="agents-heading" className="scroll-mt-20 border-t border-ink/8">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <div className="max-w-2xl">
              <h2 id="agents-heading" className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                Five agents join every new space
              </h2>
              <p className="mt-4 text-lg text-ink/65">
                Each one is a real member of the chat with its own skills. Keep the ones you need, pause the rest, or build your own.
              </p>
            </div>
            <div className="mt-12">
              <AgentsRoster agents={agents} studioHref={signedIn ? "/app/studio/new" : "/signup?next=%2Fapp%2Fstudio%2Fnew"} />
            </div>
          </div>
        </section>

        <section id="features" aria-labelledby="features-heading" className="scroll-mt-20 border-t border-ink/8 bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <FeatureLedger />
          </div>
        </section>

        <section id="nexconn" aria-labelledby="nexconn-heading" className="scroll-mt-16 bg-ink">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
            <NexconnSection />
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-28">
            <h2 id="faq-heading" className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              Questions people ask first
            </h2>
            <Faq />
          </div>
        </section>

        <section aria-labelledby="cta-heading" className="border-t border-ink/8 bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-24">
            <div className="max-w-2xl">
              <h2 id="cta-heading" className="text-3xl font-semibold tracking-[-0.02em] sm:text-[2.75rem] sm:leading-[1.1]">
                Start a space, share the link, mention an agent.
              </h2>
              <Link
                href={startHref}
                className="mt-8 inline-flex h-12 items-center rounded-control bg-accent px-6 font-semibold text-white transition-colors hover:bg-accent-strong"
              >
                {signedIn ? "Open your spaces" : "Create your first space"}
              </Link>
            </div>
            <div aria-hidden className="flex items-center">
              {["Asha Rao", "Ben Okafor", "Maya Chen"].map((n) => (
                <Avatar key={n} name={n} size="lg" className="-ml-2 ring-4 ring-surface first:ml-0" />
              ))}
              {BUILTIN_AGENTS.map((a) => (
                <Avatar key={a.key} name={a.name} handle={a.handle} kind="agent" size="lg" className="-ml-2 ring-4 ring-surface" />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-ink/55">Realtime messaging by Nexconn. Agents on Google Gemini. Sign-in by Clerk.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/65">
            <a href="#agents" className="hover:text-ink">
              Agents
            </a>
            <a href="#nexconn" className="hover:text-ink">
              Built on Nexconn
            </a>
            {signedIn ? (
              <Link href="/app" className="hover:text-ink">
                Your spaces
              </Link>
            ) : (
              <>
                <Link href="/login" className="hover:text-ink">
                  Log in
                </Link>
                <Link href="/signup" className="hover:text-ink">
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}
