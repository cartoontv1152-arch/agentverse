/**
 * Live smoke test for the agent runtime (real Gemini + real research APIs), printing to stdout.
 * Run: node --conditions=react-server --env-file=.env.local --import tsx scripts/smoke-agent.mts "question" [agentKey]
 */
import { runAgent, type AgentSink } from "@/lib/ai/runtime";
import { BUILTIN_AGENTS } from "@/lib/ai/builtin";
import type { Agent } from "@/lib/db/schema";

const question = process.argv[2] ?? "What is Lisbon's tram 28 and when did it start?";
const key = process.argv[3] ?? "researcher";
const spec = BUILTIN_AGENTS.find((a) => a.key === key)!;
const agent = { id: "smoke", builtinKey: spec.key, ownerId: null, name: spec.name, handle: spec.handle, tagline: spec.tagline, instructions: spec.instructions, tools: spec.tools, avatarUrl: null, nexconnId: "smoke", createdAt: new Date(), updatedAt: new Date() } satisfies Agent;

const sink: AgentSink = {
  async status(state, detail) { console.log(`\n[status] ${state}${detail ? ": " + detail : ""}`); },
  text(delta) { process.stdout.write(delta); },
  async propose(p) { console.log("\n[proposal]", JSON.stringify(p)); return "Posted an action card awaiting approval."; },
  async complete(cited) { console.log("\n[sources]", cited.map((c) => `[${c.n}] ${c.source.title} ${c.source.url}`).join("\n")); },
  async fail(message) { console.log("\n[fail]", message); },
};

const started = Date.now();
await runAgent(
  { agent, space: null, memory: [], history: [], peopleNames: ["Asha", "Ben"], otherAgents: [], priorOutputs: [], task: { type: "reply", text: question, requesterName: "Asha" }, forceResearch: key === "researcher" },
  sink,
).catch((e) => console.error("\nERROR", e));
console.log(`\n(done in ${Date.now() - started} ms)`);
