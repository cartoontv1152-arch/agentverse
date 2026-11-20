import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export type ApiErrorBody = { error: { code: string; message: string; details?: Record<string, unknown> } };

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json<ApiErrorBody>(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path.join(".");
    return NextResponse.json<ApiErrorBody>(
      {
        error: {
          code: "invalid_input",
          message: first ? `${field ? field + ": " : ""}${first.message}` : "Invalid input",
          details: { issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        },
      },
      { status: 400 },
    );
  }
  console.error("[api] unexpected error", err);
  return NextResponse.json<ApiErrorBody>(
    { error: { code: "server_error", message: "Something went wrong on our side. Try again." } },
    { status: 500 },
  );
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler with uniform error handling. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "unauthenticated", "Your session has ended. Log in again.");
  return user;
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be JSON.");
  }
  return schema.parse(body);
}
