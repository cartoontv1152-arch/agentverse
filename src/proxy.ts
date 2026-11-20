import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk reads the session on every page and API request. Access control itself lives in each
 * resource (route handlers call requireUser(), the /app layout checks the session); this only
 * improves the redirect, sending signed-out visits to /login with `next` so people come back
 * to the page they asked for.
 */
export default clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname;
  if (path !== "/app" && !path.startsWith("/app/")) return;
  const { userId } = await auth();
  if (userId) return;
  const login = new URL("/login", req.url);
  login.searchParams.set("next", path + req.nextUrl.search);
  return NextResponse.redirect(login);
});

export const config = {
  matcher: [
    // Skip Next internals and static files unless they appear in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt)).*)",
    "/(api|trpc)(.*)",
  ],
};
