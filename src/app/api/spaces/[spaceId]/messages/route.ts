import { after } from "next/server";
import { ok, parseJson, requireUser, route } from "@/lib/api";
import { requireMembership } from "@/lib/spaces";
import { chatMessageSchema } from "@/lib/validation";
import { recordMirror } from "@/lib/mirror";
import { checkAiLimits } from "@/lib/ai/limits";
import { looksLikeOpenQuestion, resolveMentionedAgents, routeOpenQuestion, runAgentTurn, runMentionChain } from "@/lib/ai/orchestrator";
import { sentAtFrom, spaceAgentRows, spaceChannel } from "@/lib/agent-triggers";

export const maxDuration = 120;

/**
 * Called by the client right after it sends a message through Nexconn. The server records the
 * message (attributed to the session user) for agent context and starts any agents it addresses.
 * Agents reply asynchronously through the Platform Chat API (streaming), so this returns fast.
 */
export const POST = route(async (req: Request, { params }: { params: Promise<{ spaceId: string }> }) => {
  const user = await requireUser();
  const { spaceId } = await params;
  const { space } = await requireMembership(spaceId, user.id);
  const input = await parseJson(req, chatMessageSchema);
  const channel = spaceChannel(space);

  await recordMirror({
    channelKey: channel.channelKey,
    spaceId: space.id,
    nexconnMessageId: input.messageId,
    senderUserId: user.id,
    senderName: user.name,
    kind: "text",
    text: input.text,
    sentAt: sentAtFrom(input.sentTime),
  });

  const rows = await spaceAgentRows(space.id);
  const enabled = rows.filter((r) => r.enabled).map((r) => r.agent);
  const paused = resolveMentionedAgents(input.text, input.mentionedIds, rows.filter((r) => !r.enabled).map((r) => r.agent));
  const mentioned = resolveMentionedAgents(input.text, input.mentionedIds, enabled);
  const requester = { id: user.id, name: user.name, nexconnId: user.nexconnId };

  if (mentioned.length > 0) {
    await checkAiLimits(user.id, space.id, mentioned.length);
    after(() =>
      runMentionChain({
        agents: mentioned,
        space,
        channel,
        requester,
        task: { type: "reply", text: input.text, requesterName: user.name },
      }),
    );
  } else if (space.replyMode === "auto" && enabled.length > 0 && looksLikeOpenQuestion(input.text)) {
    // Auto mode: an agent may pick up an unaddressed question. Limits are checked first so a
    // busy space never spends AI quota silently.
    try {
      await checkAiLimits(user.id, space.id, 1);
      after(async () => {
        const agent = await routeOpenQuestion(input.text, enabled).catch(() => null);
        if (agent) {
          await runAgentTurn({ agent, space, channel, requester, task: { type: "reply", text: input.text, requesterName: user.name } });
        }
      });
    } catch {
      // Over the limit: stay quiet in auto mode (no one asked an agent directly).
    }
  }

  return ok({
    triggered: mentioned.map((a) => ({ id: a.id, name: a.name })),
    paused: paused.map((a) => ({ id: a.id, name: a.name })),
  });
});
