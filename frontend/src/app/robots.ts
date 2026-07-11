import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://example.com").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Explicit rules for Torob Crawler to ensure it can crawl all listing pagination and query variations
      {
        userAgent: "Torob",
        allow: [
          "/",
          "/products",
          "/product/*",
          "/categories",
        ],
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
        ],
      },
      // Standard rules for general search engines
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
      // Block AI crawlers
      {
        userAgent: ["GPTBot", "ChatGPT-User"],
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
