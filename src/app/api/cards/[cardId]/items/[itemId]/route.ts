import { ApiError, ok, parseJson, requireUser, route } from "@/lib/api";
import { updateTaskItem } from "@/lib/cards";
import { taskPatchSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/ratelimit";

/** Tick/untick a checklist item, or set its assignee or due date. Syncs live via message metadata. */
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ cardId: string; itemId: string }> }) => {
  const user = await requireUser();
  const { cardId, itemId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new ApiError(404, "not_found", "Checklist item not found.");
  await rateLimit(`card-item:${user.id}`, 120, 60, "Slow down a little and try again.");
  const patch = await parseJson(req, taskPatchSchema);
  const { state } = await updateTaskItem(cardId, itemId, user, patch);
  return ok({ state });
});
