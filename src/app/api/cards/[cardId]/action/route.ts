import { ok, parseJson, requireUser, route } from "@/lib/api";
import { editAction, resolveAction } from "@/lib/cards";
import { actionDecisionSchema, proposalSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/ratelimit";

type Ctx = { params: Promise<{ cardId: string }> };

/** Approve or dismiss an agent's proposal. Approval executes it exactly once. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { cardId } = await params;
  await rateLimit(`card-action:${user.id}`, 60, 60, "Slow down a little and try again.");
  const { decision } = await parseJson(req, actionDecisionSchema);
  const { card, result } = await resolveAction(cardId, user, decision);
  return ok({ status: card.status, resultCardId: result?.id ?? null });
});

/** Edit a pending proposal; the card updates in place for everyone (Nexconn message update). */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { cardId } = await params;
  await rateLimit(`card-action:${user.id}`, 60, 60, "Slow down a little and try again.");
  const proposal = await parseJson(req, proposalSchema);
  const card = await editAction(cardId, user, proposal);
  return ok({ status: card.status, revision: card.revision });
});
