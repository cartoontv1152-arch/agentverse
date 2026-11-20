import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://agentverse-nu-murex.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/login", "/signup"], disallow: ["/app", "/api", "/join"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
