import { after } from "next/server";
import { ApiError, ok, parseJson, requireUser, route } from "@/lib/api";
import { requireMembership } from "@/lib/spaces";
import { translateSchema } from "@/lib/validation";
import { findMirrorMessage } from "@/lib/mirror";
import { checkAiLimits } from "@/lib/ai/limits";
import { runAgentTurn } from "@/lib/ai/orchestrator";
import { spaceAgentByBuiltin, spaceChannel } from "@/lib/agent-triggers";

export const maxDuration = 120;

/** Translates one message for the requester only (private reply from the Translator). */
export const POST = route(async (req: Request, { params }: { params: Promise<{ spaceId: string }> }) => {
  const user = await requireUser();
  const { spaceId } = await params;
  const m = await requireMembership(spaceId, user.id);
  const input = await parseJson(req, translateSchema);
  const translator = await spaceAgentByBuiltin(spaceId, "translator");
  if (!translator) throw new ApiError(400, "agent_missing", "Add the Translator to this space to translate messages.");
  if (!translator.enabled) throw new ApiError(400, "agent_paused", "The Translator is paused in this space.");
  const channel = spaceChannel(m.space);
  const message = await findMirrorMessage(input.messageId);
  if (!message || message.channelKey !== channel.channelKey) {
    throw new ApiError(404, "not_found", "That message can't be translated (it may be older than this space's history).");
  }
  await checkAiLimits(user.id, spaceId, 1);
  after(() =>
    runAgentTurn({
      agent: translator.agent,
      space: m.space,
      channel,
      requester: { id: user.id, name: user.name, nexconnId: user.nexconnId },
      task: { type: "translate", requesterName: user.name, language: input.language, sourceSender: message.senderName, sourceText: message.text },
      privateTo: [user.nexconnId],
    }),
  );
  return ok({ started: true });
});
