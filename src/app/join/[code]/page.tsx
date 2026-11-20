import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { lookupInvite } from "@/lib/invites";
import { getDb, schema } from "@/lib/db";
import { JoinButton } from "@/components/spaces/join-button";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { BUILTIN_AGENT_HANDLES } from "@/lib/agent-visual";

export const metadata: Metadata = { title: "Join a space", robots: { index: false } };
export const dynamic = "force-dynamic";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-5 py-6 sm:px-10">
      <Link href="/" aria-label="AgentVerse home" className="self-start rounded-control">
        <Logo />
      </Link>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">{children}</main>
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
        <div aria-hidden className="mb-8 flex items-center gap-2">
          <span className="size-11 rounded-full border-2 border-dashed border-ink/25" />
          <span className="size-11 rounded-[26%] border-2 border-dashed border-ink/25" />
        </div>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{copy.title}</h1>
        <p className="mt-3 text-lg text-ink/65">{copy.body}</p>
        <Link
          href={user ? "/app" : "/"}
          className="mt-8 inline-flex h-11 items-center justify-center self-start rounded-control border border-ink/14 bg-surface px-5 font-semibold transition-colors hover:border-ink/28"
        >
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
      <div className="rounded-sheet border border-ink/8 bg-surface p-6 shadow-[0_2px_4px_rgb(22_26_44/0.03),0_30px_60px_-30px_rgb(22_26_44/0.3)] sm:p-8">
        <div aria-hidden className="flex -space-x-2">
          <Avatar name={invite.inviterName} size="lg" className="ring-4 ring-surface" />
          {BUILTIN_AGENT_HANDLES.slice(0, 3).map((h) => (
            <Avatar key={h} name={h} handle={h} kind="agent" size="lg" className="ring-4 ring-surface" />
          ))}
        </div>
        <p className="mt-6 text-sm text-ink/60">{invite.inviterName} invited you to a space</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em]">{invite.space.name}</h1>
        {invite.space.description ? <p className="mt-2 text-ink/70">{invite.space.description}</p> : null}
        <p className="mt-4 text-sm text-ink/55">
          {invite.memberCount} {invite.memberCount === 1 ? "person" : "people"} and their AI agents chat here.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          {user ? (
            alreadyMember ? (
              <Link href={`/app/s/${invite.space.id}`} className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-5 font-semibold text-white transition-colors hover:bg-accent-strong">
                Open space
              </Link>
            ) : (
              <>
                <JoinButton code={code} />
                <p className="text-center text-sm text-ink/55">Joining as {user.name}</p>
              </>
            )
          ) : (
            <>
              <Link href={`/signup?next=${next}`} className="inline-flex h-11 items-center justify-center rounded-control bg-accent px-5 font-semibold text-white transition-colors hover:bg-accent-strong">
                Create account and join
              </Link>
              <Link href={`/login?next=${next}`} className="inline-flex h-11 items-center justify-center rounded-control border border-ink/14 bg-surface px-5 font-semibold transition-colors hover:border-ink/28">
                I already have an account
              </Link>
            </>
          )}
        </div>
      </div>
    </Frame>
  );
}
