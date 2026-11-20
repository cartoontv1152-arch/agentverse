import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

// Funnel Sans and Funnel Display (SIL Open Font License), self-hosted so builds never depend
// on reaching Google Fonts. Latin subset, variable weight 300-800.
const ui = localFont({
  src: "./fonts/FunnelSans-Variable.woff2",
  weight: "300 800",
  variable: "--font-ui",
  display: "swap",
});

const display = localFont({
  src: "./fonts/FunnelDisplay-Variable.woff2",
  weight: "300 800",
  variable: "--font-display-face",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://agentverse-nu-murex.vercel.app";
const description =
  "A group chat where AI agents are members. Mention one and it reads the thread, answers for everyone, and proposes checklists and polls your group approves.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "AgentVerse: group chat with AI agents", template: "%s | AgentVerse" },
  description,
  applicationName: "AgentVerse",
  keywords: ["group chat", "AI agents", "Nexconn", "Gemini", "team chat", "polls", "checklists"],
  openGraph: {
    type: "website",
    siteName: "AgentVerse",
    title: "AgentVerse: group chat with AI agents",
    description,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: "AgentVerse: group chat with AI agents", description },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f7f9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={clerkAppearance}
      signInUrl="/login"
      signUpUrl="/signup"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      afterSignOutUrl="/"
    >
      <html lang="en" className={`${ui.variable} ${display.variable} h-full`}>
        <body className="min-h-full">{children}</body>
      </html>
    </ClerkProvider>
  );
}
