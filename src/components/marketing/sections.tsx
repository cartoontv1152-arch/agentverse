import { BookOpenCheck, Check, EyeOff, Pencil, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { HUES } from "@/lib/agent-visual";

/* ---------------------------------------------------------------------------------------------
 * Features: a sticky heading on the left, concrete product fragments on the right.
 * ------------------------------------------------------------------------------------------- */

function Fragment({ children }: { children: React.ReactNode }) {
  return <div className="max-w-lg rounded-panel border border-ink/8 bg-paper/60 p-4 sm:p-5">{children}</div>;
}

const features: { title: string; body: string; visual: React.ReactNode }[] = [
  {
    title: "Nothing runs until a person says so",
    body: "Checklists, polls and memory updates arrive as proposals. Anyone in the space can approve, edit or dismiss them, and an edit updates the card in place for everyone.",
    visual: (
      <Fragment>
        <p className="text-sm font-semibold">Start this poll?</p>
        <p className="mt-1 text-sm text-ink/70">Which day should we visit Sintra?</p>
        <div className="mt-2 flex flex-col gap-1 text-sm">
          {["Saturday", "Sunday"].map((o) => (
            <span key={o} className="flex items-center gap-2">
              <span aria-hidden className="size-3 rounded-full border border-ink/30" />
              {o}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/8 pt-3">
          <span className="inline-flex items-center gap-1.5 rounded-control bg-accent px-2.5 py-1.5 text-xs font-semibold text-white">
            <Check aria-hidden className="size-3.5" /> Approve
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-control border border-ink/12 px-2.5 py-1.5 text-xs font-medium">
            <Pencil aria-hidden className="size-3" /> Edit
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-ink/60">
            <X aria-hidden className="size-3.5" /> Dismiss
          </span>
        </div>
      </Fragment>
    ),
  },
  {
    title: "Every agent reads the same memory",
    body: "Pin facts and decisions, or any message, to the space. Agents read them before they answer, so nobody repeats the budget twice. The Summarizer can propose entries too.",
    visual: (
      <Fragment>
        <ul className="flex flex-col gap-2.5 text-sm">
          <li className="flex items-start gap-2">
            <span className="rounded-chip px-1.5 py-0.5 text-2xs font-semibold" style={{ backgroundColor: HUES.jade.soft, color: HUES.jade.text }}>
              Decision
            </span>
            <span>We fly out May 3 and come back May 6.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="rounded-chip bg-ink/6 px-1.5 py-0.5 text-2xs font-semibold text-ink/65">Fact</span>
            <span>Budget is 1,200 EUR per person, flights included.</span>
          </li>
        </ul>
        <p className="mt-3 border-t border-ink/8 pt-2.5 text-2xs text-ink/50">Saved by Summarizer, approved by Asha</p>
      </Fragment>
    ),
  },
  {
    title: "Agents hand work to each other",
    body: "Mention several agents in one message and they run in that order. The Planner reads what the Researcher found before it drafts the plan.",
    visual: (
      <Fragment>
        <p className="text-sm">
          <span className="font-medium" style={{ color: HUES.cobalt.text }}>
            @Researcher
          </span>{" "}
          find three sights near Alfama, then{" "}
          <span className="font-medium" style={{ color: HUES.saffron.text }}>
            @Planner
          </span>{" "}
          make a plan
        </p>
        <div className="mt-4 flex items-center gap-2 text-2xs text-ink/55">
          <Avatar name="Researcher" handle="Researcher" kind="agent" size="sm" />
          <span className="h-px flex-1 bg-ink/15" />
          <span>answer with sources</span>
          <span className="h-px flex-1 bg-ink/15" />
          <Avatar name="Planner" handle="Planner" kind="agent" size="sm" />
        </div>
      </Fragment>
    ),
  },
  {
    title: "Catch up without scrolling back",
    body: "Open a space with unread messages and ask for a private summary. Translations from the message menu are private too: only you see them.",
    visual: (
      <Fragment>
        <div className="flex items-center gap-2.5 rounded-control border border-accent/25 bg-accent/5 px-3 py-2 text-sm">
          <BookOpenCheck aria-hidden className="size-4 text-accent" />
          <span className="flex-1">
            <span className="font-semibold">14 new messages</span> since you were here
          </span>
          <span className="rounded-[7px] bg-accent px-2 py-1 text-2xs font-semibold text-white">Catch me up</span>
        </div>
        <div className="mt-3 flex gap-2.5">
          <Avatar name="Summarizer" handle="Summarizer" kind="agent" size="sm" />
          <div className="text-sm">
            <p className="flex items-center gap-1 text-2xs font-medium text-accent">
              <EyeOff aria-hidden className="size-3" /> Only visible to you
            </p>
            <p className="mt-0.5 text-ink/80">Ben booked dinner for Saturday. Still open: who brings the camera.</p>
          </div>
        </div>
      </Fragment>
    ),
  },
];

export function FeatureLedger() {
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <h2 id="features-heading" className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          Made for a group, not a single prompt
        </h2>
        <p className="mt-4 max-w-md text-lg text-ink/65">
          Agents answer where everyone can see, and anything that changes your plans waits for a person.
        </p>
      </div>
      <ul className="flex flex-col gap-16">
        {features.map((f) => (
          <li key={f.title} className="flex flex-col gap-5">
            <div>
              <h3 className="text-xl font-semibold tracking-[-0.01em]">{f.title}</h3>
              <p className="mt-2 max-w-xl text-ink/65">{f.body}</p>
            </div>
            {f.visual}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Nexconn
 * ------------------------------------------------------------------------------------------- */

const nexconnFeatures: [string, string][] = [
  ["Group and direct channels", "Spaces, DMs between people, and private chats with any agent."],
  ["Streaming messages", "Agent replies arrive as RC:StreamMsg and fill in as Gemini writes them."],
  ["Message metadata", "Checklist ticks, assignees, due dates, votes and approvals sync to everyone live."],
  ["Custom message types", "Checklist, poll and proposal cards, agent status lines and group typing."],
  ["Mentions", "@people and @agents; a mention is what wakes an agent up."],
  ["Targeted messages", "Private catch-up summaries and translations only the asker sees."],
  ["Message updates", "Editing a pending proposal changes the card in place for the whole space."],
  ["Receipts, typing and unread counts", "Seen by 3, typing lines, and channel previews in the sidebar."],
  ["Platform Chat API", "Agents are real Nexconn users. The server registers them and sends as them."],
];

function FlowNode({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-panel border border-paper/15 bg-paper/5 px-4 py-3">
      <p className="font-display font-semibold text-paper">{title}</p>
      <p className="mt-0.5 text-xs text-paper/55">{detail}</p>
    </div>
  );
}

function Wire({ vertical = false }: { vertical?: boolean }) {
  return (
    <div aria-hidden className={`relative ${vertical ? "mx-auto h-8 w-px" : "h-px flex-1"} bg-paper/20`}>
      <span className={`absolute size-1.5 rounded-full bg-[#9fb0ff] ${vertical ? "left-1/2 -translate-x-1/2 animate-[wire-y_1.8s_linear_infinite]" : "top-1/2 -translate-y-1/2 animate-[wire-x_1.8s_linear_infinite]"}`} />
    </div>
  );
}

export function NexconnSection() {
  return (
    <div>
      <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
        <h2 id="nexconn-heading" className="text-3xl font-semibold tracking-[-0.02em] text-paper sm:text-4xl">
          Every message, vote and tick travels over Nexconn
        </h2>
        <p className="max-w-xl text-lg text-paper/65">
          Browsers use the Nexconn Web Chat SDK. The server uses the Platform Chat API to speak as each agent. There is no second realtime system.
        </p>
      </div>

      <div className="mt-12 flex flex-col items-stretch gap-0 lg:flex-row lg:items-center lg:gap-4">
        <FlowNode title="People in the browser" detail="Web Chat SDK: send, receive, metadata events" />
        <div className="hidden flex-1 lg:flex">
          <Wire />
        </div>
        <div className="lg:hidden">
          <Wire vertical />
        </div>
        <div className="rounded-panel border border-[#9fb0ff]/40 bg-[#9fb0ff]/10 px-4 py-3">
          <p className="font-display font-semibold text-paper">Nexconn</p>
          <p className="mt-0.5 text-xs text-paper/60">Channels, streams, metadata, Singapore</p>
        </div>
        <div className="hidden flex-1 lg:flex">
          <Wire />
        </div>
        <div className="lg:hidden">
          <Wire vertical />
        </div>
        <FlowNode title="Agents on the server" detail="Platform Chat API + Gemini tools" />
      </div>

      <dl className="mt-14 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        {nexconnFeatures.map(([term, def]) => (
          <div key={term} className="border-t border-paper/12 pt-4">
            <dt className="font-semibold text-paper">{term}</dt>
            <dd className="mt-1 text-sm text-paper/60">{def}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------
 * FAQ
 * ------------------------------------------------------------------------------------------- */

const faqs: [string, string][] = [
  [
    "Do agents read every message?",
    "An agent reads the recent conversation and the space memory when someone mentions it. If the owner turns on “also answer open questions”, an agent may pick up a question nobody else answered.",
  ],
  [
    "What can an agent do without asking?",
    "Reply in the chat. Checklists, polls and memory updates arrive as proposals that a person approves, edits or dismisses. The space owner can turn approval off.",
  ],
  ["Who sees agent replies?", "Everyone in the space. Catch-up summaries and translations from the message menu are private to the person who asked."],
  ["Which AI runs the agents?", "Google Gemini, with tools for Wikipedia, Hacker News and reading pages you link. Research answers cite the sources they used."],
  [
    "Are there limits?",
    "Each person can run 40 agent replies an hour and each space 120, which keeps the shared AI quota fair. When you hit a limit, the app says when agents are available again.",
  ],
  ["Can I remove the built-in agents?", "Yes. The space owner can pause or remove any agent and add custom ones. Anyone can message an agent privately."],
];

export function Faq() {
  return (
    <div className="divide-y divide-ink/10 border-y border-ink/10">
      {faqs.map(([q, a]) => (
        <details key={q} className="group py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-control py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
            {q}
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full border border-ink/15 text-ink/60 transition-transform duration-300 group-open:rotate-45">
              <PlusIcon />
            </span>
          </summary>
          <p className="max-w-2xl pb-5 text-ink/70">{a}</p>
        </details>
      ))}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M6 1v10M1 6h10" />
    </svg>
  );
}
