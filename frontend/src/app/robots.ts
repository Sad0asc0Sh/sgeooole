import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

/**
 * AI crawler policy — decided PER PURPOSE, not as one blanket allowlist
 * (ai-seo skill v2.7.6: search-discovery, user-triggered retrieval and
 * model-training tokens are not interchangeable):
 *
 * 1. Search discovery (OAI-SearchBot, PerplexityBot, Claude-SearchBot,
 *    Bingbot, Applebot): ALLOWED — blocking these removes the store from
 *    ChatGPT / Perplexity / Claude / Copilot / Siri answers.
 * 2. User-triggered retrieval (ChatGPT-User, Claude-User, Perplexity-User):
 *    ALLOWED — a user explicitly asking an assistant about a product must
 *    be able to fetch its page.
 * 3. Model training (GPTBot, ClaudeBot, anthropic-ai, Google-Extended):
 *    ALLOWED by deliberate choice — for a niche store, being present in
 *    model knowledge is worth more than the marginal content protection;
 *    this is a documented decision, not an oversight. Training controls do
 *    not affect search citations either way.
 * 4. CCBot (Common Crawl, training-only, no citation value): BLOCKED.
 *
 * Every AI group also inherits the private-path disallow list: previously
 * the AI group had a bare `allow: "/"` with no disallows, which in robots
 * group semantics silently opened /api, /checkout, /profile … to AI bots.
 */
const PRIVATE_DISALLOW = [
  "/admin/*",
  "/admin",
  "/profile/*",
  "/profile",
  "/api/*",
  "/checkout",
  // Transactional utility pages must never be crawled or indexed: /cart
  // was indexed with an "empty cart" title for brand searches, and
  // /tracking is a per-order lookup form. Their segment layouts also send
  // noindex as a second layer.
  "/cart",
  "/cart/*",
  "/tracking",
  "/tracking/*",
  "/payment/*",
  "/order/*",
  "/login",
  "/forgot-password",
  "/reset-password/*",
  "/complete-profile",
  "/*?sort=*",
  // NOTE: /*?page=* is intentionally NOT disallowed — blocking ?page= kept
  // paginated listing pages (and the product links on them) out of the crawl.
  "/*?minPrice=*",
  "/*?maxPrice=*",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_DISALLOW,
      },
      // Allow search engines to index product images
      {
        userAgent: "Googlebot-Image",
        allow: "/",
      },
      // 1) AI search discovery crawlers
      {
        userAgent: [
          "OAI-SearchBot",
          "PerplexityBot",
          "Claude-SearchBot",
          "Bingbot",
          "Applebot",
        ],
        allow: "/",
        disallow: PRIVATE_DISALLOW,
      },
      // 2) User-triggered AI retrieval
      {
        userAgent: ["ChatGPT-User", "Claude-User", "Perplexity-User"],
        allow: "/",
        disallow: PRIVATE_DISALLOW,
      },
      // 3) Model-training crawlers — deliberately allowed (see header note)
      {
        userAgent: ["GPTBot", "ClaudeBot", "anthropic-ai", "Google-Extended"],
        allow: "/",
        disallow: PRIVATE_DISALLOW,
      },
      // 4) Training-only crawler (Common Crawl): no citation value, blocked.
      {
        userAgent: "CCBot",
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
