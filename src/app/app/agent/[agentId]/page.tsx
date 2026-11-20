import { AgentDmView } from "@/components/agents/agent-dm-view";

export default async function AgentDmPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  return <AgentDmView key={agentId} agentId={agentId} />;
}
