import Link from "next/link";
import { Logo } from "@/components/ui/logo";

const links = [
  ["#agents", "Agents"],
  ["#features", "How it works"],
  ["#nexconn", "Built on Nexconn"],
  ["#faq", "FAQ"],
] as const;

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/6 bg-paper/80 backdrop-blur-md supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="AgentVerse home" className="rounded-control">
          <Logo />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-1 text-sm md:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="rounded-control px-3 py-2 text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 text-sm">
          {signedIn ? (
            <Link href="/app" className="rounded-control bg-ink px-3.5 py-2 font-semibold text-paper transition-colors hover:bg-ink/85">
              Open your spaces
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-control px-3 py-2 font-medium text-ink/80 transition-colors hover:bg-ink/5 hover:text-ink">
                Log in
              </Link>
              <Link href="/signup" className="rounded-control bg-ink px-3.5 py-2 font-semibold text-paper transition-colors hover:bg-ink/85">
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
