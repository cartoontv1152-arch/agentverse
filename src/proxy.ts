import { NextResponse, type NextRequest } from "next/server";

/** Exposes the request path to server layouts (used to return people to the page they wanted after login). */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/app/:path*"],
};
