import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { lookupInvite } from "@/lib/invites";
import { getDb, schema } from "@/lib/db";
import { JoinButton } from "@/components/spaces/join-button";

export const metadata: Metadata = { title: "Join a space" };
export const dynamic = "force-dynamic";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-6 py-8">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <span aria-hidden className="grid size-6 place-items-center rounded-[22%] bg-accent text-[0.7rem] font-bold text-paper">A</span>
        AgentVerse
      </Link>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [invite, user] = await Promise.all([lookupInvite(code), getSessionUser()]);

  if (invite.status !== "valid") {
    const copy = {
      expired: { title: "This invite has expired", body: "Invite links last 7 days. Ask the person who invited you for a new link." },
      revoked: { title: "This invite was turned off", body: "The space owner turned this link off. Ask them for a new one." },
      not_found: { title: "This invite link doesn't work", body: "Check that you copied the whole link, or ask for a new one." },
    }[invite.status];
    return (
      <Frame>
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-2 text-ink/65">{copy.body}</p>
        <Link href={user ? "/app" : "/"} className="mt-6 font-medium text-accent hover:underline">
          {user ? "Go to your spaces" : "Go to the home page"}
        </Link>
      </Frame>
    );
  }

  let alreadyMember = false;
  if (user) {
    const [row] = await getDb()
      .select({ userId: schema.spaceMembers.userId })
      .from(schema.spaceMembers)
      .where(and(eq(schema.spaceMembers.spaceId, invite.space.id), eq(schema.spaceMembers.userId, user.id)))
      .limit(1);
    alreadyMember = Boolean(row);
  }
  const next = encodeURIComponent(`/join/${code}`);

  return (
    <Frame>
      <p className="text-sm text-ink/60">{invite.inviterName} invited you to a space</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{invite.space.name}</h1>
      {invite.space.description ? <p className="mt-2 text-ink/70">{invite.space.description}</p> : null}
      <p className="mt-3 text-sm text-ink/55">
        {invite.memberCount} {invite.memberCount === 1 ? "person" : "people"} and their AI agents chat here.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        {user ? (
          alreadyMember ? (
            <Link href={`/app/s/${invite.space.id}`} className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-5 font-medium text-paper hover:bg-accent/90">
              Open space
            </Link>
          ) : (
            <>
              <JoinButton code={code} />
              <p className="text-sm text-ink/55">Joining as {user.name}.</p>
            </>
          )
        ) : (
          <>
            <Link href={`/signup?next=${next}`} className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-5 font-medium text-paper hover:bg-accent/90">
              Create account and join
            </Link>
            <Link href={`/login?next=${next}`} className="inline-flex h-11 items-center justify-center rounded-control border border-ink/18 bg-surface px-5 font-medium hover:border-ink/35">
              I already have an account
            </Link>
          </>
        )}
      </div>
    </Frame>
  );
}
