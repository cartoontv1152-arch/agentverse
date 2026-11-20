import { ok, parseJson, requireUser, route } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { createSpace, listSpacesForUser } from "@/lib/spaces";
import { spaceCreateSchema } from "@/lib/validation";

export const GET = route(async () => {
  const user = await requireUser();
  return ok({ spaces: await listSpacesForUser(user.id) });
});

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  await rateLimit(`space-create:${user.id}`, 20, 3600, "You've created a lot of spaces this hour. Try again later.");
  const input = await parseJson(req, spaceCreateSchema);
  const space = await createSpace({ name: input.name, description: input.description, owner: user });
  return ok({ space: { id: space.id, name: space.name, nexconnGroupId: space.nexconnGroupId } }, 201);
});
