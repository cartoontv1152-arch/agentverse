"use client";

import { useEffect, useState } from "react";
import { Check, CheckCircle2, ExternalLink, Hash, ListChecks, Pencil, SendHorizontal, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { HUES } from "@/lib/agent-visual";
import { useInView, usePrefersReducedMotion } from "./use-in-view";

/**
 * A space playing out on its own: a person asks the Researcher, another asks the Planner, the
 * proposal is approved and the checklist ticks live. Everything derives from one clock `t`
 * (ms into the loop), so the scene can pause off-screen and show its end state for reduced motion.
 */

const LOOP = 17000;
const T = {
  askType: 300,
  askSend: 2000,
  researching: 2300,
  answer: 3900,
  planType: 7000,
  planSend: 8400,
  planning: 8700,
  proposal: 10000,
  approvePress: 11400,
  approved: 11700,
  checklist: 12300,
  tick1: 13200,
  tick2: 14100,
  fadeOut: 16400,
};

const ASK = "@Researcher how does Tram 28 work, and when should we ride it?";
const ANSWER =
  "Tram 28 loops through Graça, Alfama, Baixa and Estrela [1]. It fills up from mid-morning, so ride early and board at the Martim Moniz end [2].";
const PLAN = "@Planner turn this into a plan for Saturday";
const ITEMS = [
  { text: "Ride Tram 28 from Martim Moniz before 9", who: "Asha" },
  { text: "Book lunch in Alfama", who: "Ben" },
  { text: "Sunset at Miradouro da Graça", who: "Maya" },
];

function typed(text: string, t: number, start: number, msPerChar: number) {
  if (t < start) return "";
  return text.slice(0, Math.floor((t - start) / msPerChar));
}

function Mention({ children }: { children: React.ReactNode }) {
  return <span className="rounded-[5px] bg-accent/10 px-1 font-medium text-accent">{children}</span>;
}

function renderMentions(text: string) {
  const parts = text.split(/(@\w+)/);
  return parts.map((p, i) => (p.startsWith("@") ? <Mention key={i}>{p}</Mention> : <span key={i}>{p}</span>));
}

function renderCitations(text: string) {
  return text.split(/(\[\d\])/).map((p, i) =>
    /^\[\d\]$/.test(p) ? (
      <sup key={i} className="mx-px rounded-[4px] bg-accent/12 px-1 text-[0.65rem] font-semibold text-accent">
        {p.slice(1, -1)}
      </sup>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function Row({ children, avatar, name, agent, time }: { children: React.ReactNode; avatar: React.ReactNode; name: string; agent?: boolean; time: string }) {
  return (
    <div className="flex animate-rise gap-2.5">
      <div className="pt-0.5">{avatar}</div>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5 text-[0.8rem]">
          <span className="font-semibold">{name}</span>
          {agent ? <span className="rounded-[4px] bg-ink/6 px-1 text-[0.65rem] font-medium text-ink/60">Agent</span> : null}
          <span className="text-[0.68rem] text-ink/40">{time}</span>
        </p>
        <div className="mt-0.5 text-[0.84rem] leading-[1.45] text-ink/90">{children}</div>
      </div>
    </div>
  );
}

export function HeroDemo() {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, rootMargin: "0px" });
  const [t, setT] = useState(0);

  useEffect(() => {
    if (reduced || !inView) return;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      if (document.visibilityState === "visible") setT((prev) => (prev + (now - last)) % LOOP);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, inView]);

  const now = reduced ? T.tick2 + 600 : t;
  const composing = now < T.askSend ? typed(ASK, now, T.askType, 26) : now >= T.planType && now < T.planSend ? typed(PLAN, now, T.planType, 30) : "";
  const working = now >= T.researching && now < T.answer ? "researcher" : now >= T.planning && now < T.proposal ? "planner" : null;
  const answer = typed(ANSWER, now, T.answer, 14);
  const answerDone = answer.length === ANSWER.length;
  const approved = now >= T.approved;
  const ticks = [now >= T.tick1, now >= T.tick2, false];

  return (
    <div ref={ref} className="relative" aria-label="Preview of a space: people mention agents, approve a plan, and tick it off together" role="img">
      <div
        className="overflow-hidden rounded-sheet border border-ink/10 bg-surface shadow-[0_2px_4px_rgb(22_26_44/0.04),0_30px_70px_-30px_rgb(22_26_44/0.45)] transition-opacity duration-500"
        style={{ opacity: now >= T.fadeOut ? 0 : 1 }}
      >
        <div className="flex h-12 items-center gap-2 border-b border-ink/8 px-4">
          <Hash aria-hidden className="size-4 text-ink/40" />
          <p className="whitespace-nowrap font-display text-[0.95rem] font-semibold">Lisbon trip</p>
          <p className="hidden whitespace-nowrap text-[0.72rem] text-ink/45 sm:block">3 people, 5 agents</p>
          <div className="ml-auto flex items-center gap-1">
            {["Researcher", "Planner", "Pollster", "Summarizer", "Translator"].map((h) => {
              const lit = working === h.toLowerCase();
              return (
                <span key={h} className="relative">
                  <Avatar name={h} handle={h} kind="agent" size="xs" />
                  {lit ? <span aria-hidden className="absolute -inset-[3px] animate-working rounded-[30%] border-2" style={{ borderColor: HUES[h === "Researcher" ? "cobalt" : "saffron"].bg }} /> : null}
                </span>
              );
            })}
          </div>
        </div>

        <div className="relative flex h-[430px] flex-col justify-end gap-3.5 overflow-hidden px-4 pb-3 pt-4 [mask-image:linear-gradient(to_bottom,transparent,black_18%)] sm:h-[460px]">
          {now >= T.askSend ? (
            <Row avatar={<Avatar name="Asha Rao" size="sm" />} name="Asha" time="09:41">
              {renderMentions(ASK)}
            </Row>
          ) : null}
          {now >= T.answer ? (
            <Row avatar={<Avatar name="Researcher" handle="Researcher" kind="agent" size="sm" />} name="Researcher" agent time="09:41">
              <p>
                {renderCitations(answer)}
                {!answerDone ? <span aria-hidden className="ml-0.5 inline-block h-3.5 w-1 translate-y-0.5 animate-caret bg-accent" /> : null}
              </p>
              {answerDone ? (
                <div className="mt-2 flex animate-fade flex-wrap gap-1.5">
                  {[
                    ["1", "Lisbon tramways"],
                    ["2", "Martim Moniz"],
                  ].map(([n, title]) => (
                    <span key={n} className="inline-flex items-center gap-1.5 rounded-[7px] border border-ink/10 bg-paper px-1.5 py-0.5 text-[0.7rem]">
                      <span className="font-semibold text-accent">{n}</span>
                      <span className="font-medium">{title}</span>
                      <span className="text-ink/40">wikipedia.org</span>
                      <ExternalLink aria-hidden className="size-2.5 text-ink/35" />
                    </span>
                  ))}
                </div>
              ) : null}
            </Row>
          ) : null}
          {now >= T.planSend ? (
            <Row avatar={<Avatar name="Ben Okafor" size="sm" />} name="Ben" time="09:42">
              {renderMentions(PLAN)}
            </Row>
          ) : null}
          {now >= T.proposal ? (
            <Row avatar={<Avatar name="Planner" handle="Planner" kind="agent" size="sm" />} name="Planner" agent time="09:42">
              <div className="mt-1 overflow-hidden rounded-[12px] border border-ink/10" style={{ borderColor: approved ? undefined : HUES.saffron.bg }}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <ListChecks aria-hidden className="size-3.5" style={{ color: HUES.saffron.text }} />
                  <p className="text-[0.78rem] font-semibold">{approved ? "Saturday in Lisbon" : "Create this checklist?"}</p>
                  {approved ? <span className="ml-auto text-[0.68rem] text-ink/50">{ticks.filter(Boolean).length} of 3 done</span> : null}
                </div>
                {approved ? (
                  <div aria-hidden className="h-0.5 bg-ink/6">
                    <div className="h-full transition-[width] duration-500" style={{ width: `${(ticks.filter(Boolean).length / 3) * 100}%`, backgroundColor: HUES.saffron.bg }} />
                  </div>
                ) : null}
                <ul className="divide-y divide-ink/6 border-t border-ink/8">
                  {ITEMS.map((item, i) => {
                    const done = approved && now >= T.checklist && ticks[i];
                    return (
                      <li key={item.text} className="flex items-center gap-2.5 px-3 py-1.5 text-[0.78rem]">
                        <span
                          className={`grid size-3.5 shrink-0 place-items-center rounded-[4px] border transition-colors duration-300 ${done ? "text-ink" : "border-ink/25"}`}
                          style={done ? { backgroundColor: HUES.saffron.bg, borderColor: HUES.saffron.bg } : undefined}
                        >
                          {done ? <Check aria-hidden className="size-2.5" strokeWidth={3.5} /> : null}
                        </span>
                        <span className={`flex-1 transition-colors ${done ? "text-ink/45 line-through decoration-ink/30" : ""}`}>{item.text}</span>
                        <span className="text-[0.68rem] text-ink/45">{item.who}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center gap-1.5 border-t border-ink/8 bg-paper/70 px-3 py-2">
                  {approved ? (
                    <p className="flex animate-fade items-center gap-1.5 text-[0.72rem] font-medium" style={{ color: HUES.jade.text }}>
                      <CheckCircle2 aria-hidden className="size-3.5" /> Approved by Ben, live for everyone
                    </p>
                  ) : (
                    <>
                      <span
                        className={`inline-flex items-center gap-1 rounded-[7px] bg-accent px-2 py-1 text-[0.7rem] font-semibold text-white transition-transform duration-150 ${now >= T.approvePress ? "scale-95 bg-accent-strong" : ""}`}
                      >
                        <Check aria-hidden className="size-3" /> Approve
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-[7px] border border-ink/12 px-2 py-1 text-[0.7rem] font-medium">
                        <Pencil aria-hidden className="size-2.5" /> Edit
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-1 text-[0.7rem] font-medium text-ink/60">
                        <X aria-hidden className="size-3" /> Dismiss
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Row>
          ) : null}
        </div>

        <div className="h-6 px-4">
          {working ? (
            <p className="flex animate-fade items-center gap-2 text-[0.72rem] text-ink/60">
              <Avatar name={working} handle={working} kind="agent" size="xs" />
              {working === "researcher" ? "Researcher is searching Wikipedia for Lisbon tram 28" : "Planner is drafting a checklist"}
              <span aria-hidden className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1 animate-working rounded-full bg-accent" style={{ animationDelay: `${i * 180}ms` }} />
                ))}
              </span>
            </p>
          ) : null}
        </div>

        <div className="px-3 pb-3">
          <div className={`flex items-center gap-2 rounded-[12px] border px-3 py-2 transition-colors ${composing ? "border-accent ring-2 ring-accent/15" : "border-ink/12"}`}>
            <p className="min-h-5 flex-1 truncate text-[0.82rem]">
              {composing ? (
                <>
                  {renderMentions(composing)}
                  <span aria-hidden className="ml-px inline-block h-3.5 w-px translate-y-0.5 animate-caret bg-ink" />
                </>
              ) : (
                <span className="text-ink/40">Message Lisbon trip</span>
              )}
            </p>
            <span className={`grid size-7 place-items-center rounded-[8px] transition-colors ${composing ? "bg-accent text-white" : "bg-ink/8 text-ink/35"}`}>
              <SendHorizontal aria-hidden className="size-3.5" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
