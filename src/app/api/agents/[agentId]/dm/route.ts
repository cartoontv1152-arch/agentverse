import { after } from "next/server";
import { ApiError, ok, parseJson, requireUser, route } from "@/lib/api";
import { canUseAgent, getAgent } from "@/lib/agents";
import { chatMessageSchema } from "@/lib/validation";
import { recordMirror } from "@/lib/mirror";
import { checkAiLimits } from "@/lib/ai/limits";
import { runAgentTurn } from "@/lib/ai/orchestrator";
import { agentDmChannelKey } from "@/lib/spaces";
import { sentAtFrom } from "@/lib/agent-triggers";

export const maxDuration = 120;

/**
 * Private DM with an agent. The client sends the message to the agent's Nexconn user through a
 * direct channel, then calls this route; the agent replies by streaming into the same channel.
 */
export const POST = route(async (req: Request, { params }: { params: Promise<{ agentId: string }> }) => {
  const user = await requireUser();
  const { agentId } = await params;
  const agent = await getAgent(agentId);
  if (!agent || !(await canUseAgent(user.id, agent))) throw new ApiError(404, "not_found", "Agent not found.");
  const input = await parseJson(req, chatMessageSchema);
  const channelKey = agentDmChannelKey(agent.nexconnId, user.nexconnId);
  await recordMirror({
    channelKey,
    spaceId: null,
    nexconnMessageId: input.messageId,
    senderUserId: user.id,
    senderName: user.name,
    kind: "text",
    text: input.text,
    sentAt: sentAtFrom(input.sentTime),
  });
  await checkAiLimits(user.id, null, 1);
  after(() =>
    runAgentTurn({
      agent,
      space: null,
      channel: { target: { type: "direct", userId: user.nexconnId }, channelKey, space: null },
      requester: { id: user.id, name: user.name, nexconnId: user.nexconnId },
      task: { type: "reply", text: input.text, requesterName: user.name },
    }),
  );
  return ok({ triggered: [{ id: agent.id, name: agent.name }] });
});
