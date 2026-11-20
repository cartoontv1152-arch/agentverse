import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isAppRoute = createRouteMatcher(["/app(.*)"]);

/**
 * Clerk reads the session on every page and API request. Signed-out visits to the app are sent
 * to log in with `next` set, so people return to the page they asked for.
 */
export default clerkMiddleware(async (auth, req) => {
  if (!isAppRoute(req)) return;
  const { userId } = await auth();
  if (userId) return;
  const login = new URL("/login", req.url);
  login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
});

export const config = {
  matcher: [
    // Skip Next internals and static files unless they appear in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt)).*)",
    "/(api|trpc)(.*)",
  ],
};
