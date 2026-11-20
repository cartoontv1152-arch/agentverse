import { put } from "@vercel/blob";
import { ApiError, ok, requireUser, route } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { randomAlnum } from "@/lib/nexconn/ids";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

/** Uploads an avatar image (people or agents) to Vercel Blob and returns its public URL. */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  await rateLimit(`upload:${user.id}`, 30, 3600, "Too many uploads this hour. Try again later.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "invalid_input", "Choose an image to upload.");
  const ext = TYPES[file.type];
  if (!ext) throw new ApiError(400, "invalid_type", "Use a PNG, JPG, WebP or GIF image.");
  if (file.size > MAX_BYTES) throw new ApiError(400, "too_large", "Images must be 2 MB or smaller.");
  const blob = await put(`avatars/${user.id}/${randomAlnum(12)}.${ext}`, file, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: false,
  });
  return ok({ url: blob.url }, 201);
});
