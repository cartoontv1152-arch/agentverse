import { ok, requireUser, route } from "@/lib/api";
import { listContacts } from "@/lib/spaces";

/** People the user shares a space with: who they can DM or assign tasks to. */
export const GET = route(async () => {
  const user = await requireUser();
  return ok({ contacts: await listContacts(user.id) });
});
