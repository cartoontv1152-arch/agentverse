import { ok, requireUser, route } from "@/lib/api";
import { getCardState } from "@/lib/cards";

/** Authoritative card state (checklist items, poll counts, proposal status). */
export const GET = route(async (_req: Request, { params }: { params: Promise<{ cardId: string }> }) => {
  const user = await requireUser();
  const { cardId } = await params;
  return ok({ card: await getCardState(cardId, user) });
});
