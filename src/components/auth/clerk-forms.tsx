"use client";

import { SignIn, SignUp } from "@clerk/nextjs";

function withNext(path: string, next: string) {
  return next === "/app" ? path : `${path}?next=${encodeURIComponent(next)}`;
}

/** Clerk sign-in. Hash routing keeps every step on /login, so `next` survives verification steps. */
export function LoginForm({ next }: { next: string }) {
  return <SignIn routing="hash" forceRedirectUrl={next} signUpUrl={withNext("/signup", next)} />;
}

export function SignupForm({ next }: { next: string }) {
  return <SignUp routing="hash" forceRedirectUrl={next} signInUrl={withNext("/login", next)} />;
}
