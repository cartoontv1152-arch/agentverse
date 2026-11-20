import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";

/** A still from a space: the moment an agent's proposal is approved by a person. */
function ApprovedPreview() {
  const items = [
    { text: "Book the Alfama walking tour", who: "Asha", done: true },
    { text: "Reserve dinner for Saturday", who: "Ben", done: true },
    { text: "Buy 24h tram passes", who: "Asha", done: false },
  ];
  return (
    <div className="w-full max-w-md">
      <div className="flex items-start gap-3">
        <Avatar name="Ben Okafor" size="md" />
        <div className="min-w-0 rounded-panel rounded-tl-md bg-paper/8 px-3.5 py-2.5 text-paper/90">
          <span className="font-medium text-[#9fb0ff]">@Planner</span> turn this into a plan for the weekend
        </div>
      </div>
      <div className="mt-4 flex items-start gap-3">
        <Avatar name="Planner" handle="Planner" kind="agent" size="md" />
        <div className="min-w-0 flex-1 overflow-hidden rounded-panel border border-paper/12 bg-[#1f2438]">
          <div className="flex items-center justify-between border-b border-paper/10 px-4 py-3">
            <p className="font-display text-[0.95rem] font-semibold text-paper">Lisbon weekend</p>
            <p className="text-2xs text-paper/55">2 of 3 done</p>
          </div>
          <ul className="divide-y divide-paper/8">
            {items.map((item) => (
              <li key={item.text} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span
                  className={`grid size-[1.1rem] shrink-0 place-items-center rounded-[5px] border ${item.done ? "border-[#e8a23a] bg-[#e8a23a] text-ink" : "border-paper/30"}`}
                >
                  {item.done ? <Check aria-hidden className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className={`flex-1 ${item.done ? "text-paper/50 line-through decoration-paper/30" : "text-paper/90"}`}>{item.text}</span>
                <span className="text-2xs text-paper/50">{item.who}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-paper/10 px-4 py-2.5 text-2xs text-paper/55">Approved by Asha. Everyone sees ticks as they happen.</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Two-column auth frame: the Clerk form (its own header carries each step's title and
 * instructions), and a still of what happens inside a space.
 */
export function AuthLayout({ note, children }: { note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-12 sm:py-8">
        <Link href="/" className="self-start rounded-control" aria-label="AgentVerse home">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          {note ? <p className="mb-6 rounded-control border border-accent/20 bg-accent/[0.06] px-3.5 py-2.5 text-sm text-ink/80">{note}</p> : null}
          {children}
        </div>
        <p className="text-2xs text-ink/45">Sign-in by Clerk. Realtime chat by Nexconn. Agents run on Gemini.</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border border-paper/8" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-16 size-64 rotate-12 rounded-[26%] border border-paper/8" />
        <p className="relative max-w-sm font-display text-2xl font-semibold leading-tight tracking-[-0.01em] text-paper">
          Agents propose. Your group decides.
        </p>
        <p className="relative mt-3 max-w-sm text-paper/60">Checklists, polls and memory updates wait for a person to approve them, then update live for everyone.</p>
        <div className="relative mt-10">
          <ApprovedPreview />
        </div>
      </aside>
    </div>
  );
}
