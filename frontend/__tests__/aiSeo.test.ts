/**
 * AI SEO infrastructure tests.
 * Guards the machine-readable / agent-readiness layer:
 * - robots.ts decides AI access PER PURPOSE: search-discovery bots
 *   (OAI-SearchBot, PerplexityBot, Claude-SearchBot, Bingbot, Applebot),
 *   user-triggered fetchers (ChatGPT-User, Claude-User, Perplexity-User)
 *   and training bots (GPTBot, ClaudeBot, anthropic-ai, Google-Extended)
 *   are all explicitly allowed, each with the private paths disallowed
 * - robots.ts must BLOCK the training-only CCBot crawler
 * - /llms.txt carries a broad brand definition block + when-to-use guidance,
 *   /llms-full.txt embeds store overview + the store FAQ, and /home.md serves
 *   the Markdown homepage used by content negotiation
 */
import robots from "@/app/robots";
import { GET as llmsTxtGet, buildLlmsTxtBody } from "@/app/llms.txt/route";
import { GET as llmsFullTxtGet, buildLlmsFullTxtBody } from "@/app/llms-full.txt/route";
import { GET as homeMdGet, buildHomeMarkdownBody } from "@/app/home.md/route";
import { defaultFAQs } from "@/app/faq/defaultFaqs";

const AI_CITE_BOTS = [
  "OAI-SearchBot",
  "PerplexityBot",
  "Claude-SearchBot",
  "Bingbot",
  "Applebot",
  "ChatGPT-User",
  "Claude-User",
  "Perplexity-User",
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
];

describe("robots.txt AI crawler policy", () => {
  const rawRules = robots().rules;
  const rules = Array.isArray(rawRules) ? rawRules : [rawRules];

  test("cite-capable AI bots are explicitly allowed", () => {
    const allowedAgents = rules
      .filter((r) => r.allow === "/" || (Array.isArray(r.allow) && r.allow.includes("/")))
      .flatMap((r) => (Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent]));
    for (const bot of AI_CITE_BOTS) {
      expect(allowedAgents).toContain(bot);
    }
  });

  test("GPTBot and ChatGPT-User are NOT blocked", () => {
    const blockedAgents = rules
      .filter((r) => r.disallow === "/" || (Array.isArray(r.disallow) && r.disallow.includes("/")))
      .flatMap((r) => (Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent]));
    expect(blockedAgents).not.toContain("GPTBot");
    expect(blockedAgents).not.toContain("ChatGPT-User");
  });

  test("training-only CCBot is blocked", () => {
    const ccbotRule = rules.find((r) => {
      const agents = Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent];
      return agents.includes("CCBot");
    });
    expect(ccbotRule).toBeDefined();
    expect(ccbotRule!.disallow).toBe("/");
  });

  test("private paths stay disallowed for the generic crawler", () => {
    const generic = rules.find((r) => r.userAgent === "*");
    expect(generic).toBeDefined();
    const disallow = generic!.disallow as string[];
    for (const path of ["/api/*", "/checkout", "/login", "/profile/*"]) {
      expect(disallow).toContain(path);
    }
  });

  test("AI bot groups also disallow the private paths (no bare allow)", () => {
    for (const bot of AI_CITE_BOTS) {
      const rule = rules.find((r) => {
        const agents = Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent];
        return agents.includes(bot);
      });
      expect(rule).toBeDefined();
      const disallow = (Array.isArray(rule!.disallow) ? rule!.disallow : [rule!.disallow]) as string[];
      for (const path of ["/api/*", "/checkout", "/profile/*"]) {
        expect(disallow).toContain(path);
      }
    }
  });

  test("sitemap is declared", () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe("/llms.txt route", () => {
  test("GET handler exists and body is markdown with broad technology brand and key sections", () => {
    expect(typeof llmsTxtGet).toBe("function");
    const text = buildLlmsTxtBody();
    expect(text).toContain("ekgkala");
    expect(text).toContain("ای کا جی کالا");
    expect(text).toContain("تکنولوژی");
    for (const path of ["/products", "/categories", "/blog", "/faq", "/llms-full.txt"]) {
      expect(text).toContain(path);
    }
    for (const removedPath of ["/compare", "/glossary", "/guides"]) {
      expect(text).not.toContain(removedPath);
    }
  });

  test("body has a self-contained definition block and when-to-use guidance", () => {
    const text = buildLlmsTxtBody();
    expect(text).toContain("ای کا جی کالا چیست؟");
    expect(text).toContain("چه زمانی از ای کا جی کالا استفاده کنید");
    expect(text).toContain("/sitemap.xml");
  });
});

describe("/llms-full.txt route", () => {
  test("body embeds the broad store overview, FAQ, and freshness line without legacy compare/glossary routes", () => {
    expect(typeof llmsFullTxtGet).toBe("function");
    const text = buildLlmsFullTxtBody();
    expect(text).toContain("درباره ای کا جی کالا");
    expect(text).toContain("تکنولوژی");
    for (const faq of defaultFAQs) expect(text).toContain(faq.question);
    expect(text).toContain("آخرین به‌روزرسانی محتوای تحریریه‌ای");
    for (const removedPath of ["/compare", "/glossary", "/guides"]) {
      expect(text).not.toContain(removedPath);
    }
  });
});

describe("/home.md route (Markdown homepage)", () => {
  test("body is Markdown with broad technology brand definition and discovery links", () => {
    expect(typeof homeMdGet).toBe("function");
    const text = buildHomeMarkdownBody();
    expect(text).toContain("# ای کا جی کالا");
    expect(text).toContain("فروشگاه اینترنتی جامع");
    for (const path of ["/products", "/blog", "/faq", "/llms.txt", "/llms-full.txt", "/sitemap.xml"]) {
      expect(text).toContain(path);
    }
    for (const removedPath of ["/compare", "/glossary", "/guides"]) {
      expect(text).not.toContain(removedPath);
    }
  });
});

describe("soft-404 status guard", () => {
  const fs = require("fs");
  const path = require("path");
  const appDir = path.join(process.cwd(), "src", "app");

  test("no root app/loading.tsx (would stream every notFound as 200)", () => {
    expect(fs.existsSync(path.join(appDir, "loading.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(appDir, "loading.js"))).toBe(false);
  });

  test("no loading.tsx in the PDP segment", () => {
    const pdpDir = path.join(appDir, "product", "[...segments]");
    expect(fs.existsSync(path.join(pdpDir, "loading.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(pdpDir, "loading.js"))).toBe(false);
  });
});
