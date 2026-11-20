import { ok, parseJson, requireUser, route } from "@/lib/api";
import { castVote } from "@/lib/cards";
import { voteSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/ratelimit";

/** Vote (or remove a vote) on a poll option. Counts sync live via message metadata. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ cardId: string }> }) => {
  const user = await requireUser();
  const { cardId } = await params;
  await rateLimit(`card-vote:${user.id}`, 120, 60, "Slow down a little and try again.");
  const { optionId } = await parseJson(req, voteSchema);
  const { metadata } = await castVote(cardId, optionId, user);
  return ok({ metadata });
});
