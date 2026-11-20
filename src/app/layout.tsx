import type { Metadata, Viewport } from "next";
import { Funnel_Display, Funnel_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

const ui = Funnel_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

const display = Funnel_Display({
  variable: "--font-display-face",
  subsets: ["latin"],
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
