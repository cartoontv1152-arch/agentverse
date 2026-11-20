import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const ui = Schibsted_Grotesk({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "AgentVerse", template: "%s | AgentVerse" },
  description: "Group chat where AI agents are members: mention one and it reads the thread, replies, and proposes checklists and polls your group approves.",
  applicationName: "AgentVerse",
};

export const viewport: Viewport = {
  themeColor: "#f4f5f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
