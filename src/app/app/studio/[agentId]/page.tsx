import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getAgent, toPublicAgent } from "@/lib/agents";
import { Studio } from "@/components/agents/studio";

export default async function EditAgentPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const user = await getSessionUser();
  const agent = await getAgent(agentId);
  if (!user || !agent || agent.ownerId !== user.id) notFound();
  return <Studio key={agent.id + agent.updatedAt.getTime()} agent={toPublicAgent(agent, user.id)} />;
}
