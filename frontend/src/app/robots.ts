import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/*",
          "/admin",
          "/profile/*",
          "/profile",
          "/api/*",
          "/checkout",
          "/payment/*",
          "/order/*",
          "/login",
          "/forgot-password",
          "/reset-password/*",
          "/complete-profile",
          "/*?sort=*",
          "/*?page=*",
          "/*?minPrice=*",
          "/*?maxPrice=*",
        ],
      },
      // Allow search engines to index product images
      {
        userAgent: "Googlebot-Image",
        allow: "/",
      },
      // AI search & assistant crawlers: explicitly allowed so AI engines
      // (ChatGPT, Perplexity, Claude, Gemini, Copilot) can discover and cite
      // our content. Blocking these bots = self-inflicted AI-search invisibility.
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "PerplexityBot",
          "ClaudeBot",
          "anthropic-ai",
          "Google-Extended",
          "Bingbot",
        ],
        allow: "/",
      },
      // Training-only crawler (Common Crawl): no citation value, blocked.
      {
        userAgent: "CCBot",
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
