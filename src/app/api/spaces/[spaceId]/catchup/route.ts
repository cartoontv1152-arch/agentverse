import { after } from "next/server";
import { ApiError, ok, parseJson, requireUser, route } from "@/lib/api";
import { requireMembership } from "@/lib/spaces";
import { catchupSchema } from "@/lib/validation";
import { messagesSince } from "@/lib/mirror";
import { checkAiLimits } from "@/lib/ai/limits";
import { runAgentTurn } from "@/lib/ai/orchestrator";
import { spaceAgentByBuiltin, spaceChannel } from "@/lib/agent-triggers";

export const maxDuration = 120;

/**
 * "What did I miss?": the Summarizer summarises messages since `since` and replies privately to
 * the requester (a targeted Nexconn group message only they receive).
 */
export const POST = route(async (req: Request, { params }: { params: Promise<{ spaceId: string }> }) => {
  const user = await requireUser();
  const { spaceId } = await params;
  const m = await requireMembership(spaceId, user.id);
  const input = await parseJson(req, catchupSchema);
  const summarizer = await spaceAgentByBuiltin(spaceId, "summarizer");
  if (!summarizer) throw new ApiError(400, "agent_missing", "Add the Summarizer to this space to catch up.");
  if (!summarizer.enabled) throw new ApiError(400, "agent_paused", "The Summarizer is paused in this space.");
  const since = input.since ? new Date(input.since) : m.lastReadAt;
  const channel = spaceChannel(m.space);
  const unread = (await messagesSince(channel.channelKey, since, 150)).filter((msg) => msg.senderUserId !== user.id);
  if (unread.length === 0) return ok({ started: false, unread: 0 });
  await checkAiLimits(user.id, spaceId, 1);
  after(() =>
    runAgentTurn({
      agent: summarizer.agent,
      space: m.space,
      channel,
      requester: { id: user.id, name: user.name, nexconnId: user.nexconnId },
      task: { type: "catchup", requesterName: user.name, unread },
      privateTo: [user.nexconnId],
    }),
  );
  return ok({ started: true, unread: unread.length });
});
