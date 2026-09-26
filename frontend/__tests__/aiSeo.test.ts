/**
 * AI SEO infrastructure tests.
 * Guards the machine-readable / agent-readiness layer:
 * - robots.ts must ALLOW cite-capable AI crawlers (GPTBot, ChatGPT-User,
 *   PerplexityBot, ClaudeBot, anthropic-ai, Google-Extended, Bingbot)
 * - robots.ts must BLOCK the training-only CCBot crawler
 * - /llms.txt and /llms-full.txt routes must serve text/plain markdown
 */
import robots from "@/app/robots";
import { GET as llmsTxtGet, buildLlmsTxtBody } from "@/app/llms.txt/route";
import { GET as llmsFullTxtGet, buildLlmsFullTxtBody } from "@/app/llms-full.txt/route";
import { guides, glossaryTerms, comparisons } from "@/content/programmatic";

const AI_CITE_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Bingbot",
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

  test("sitemap is declared", () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe("/llms.txt route", () => {
  test("GET handler exists and body is markdown with brand and key sections", () => {
    expect(typeof llmsTxtGet).toBe("function");
    const text = buildLlmsTxtBody();
    expect(text).toContain("ekgkala");
    expect(text).toContain("ای کا جی کالا");
    for (const path of ["/guides", "/glossary", "/compare", "/products", "/llms-full.txt"]) {
      expect(text).toContain(path);
    }
  });
});

describe("/llms-full.txt route", () => {
  test("body contains all programmatic content", () => {
    expect(typeof llmsFullTxtGet).toBe("function");
    const text = buildLlmsFullTxtBody();
    expect(text.length).toBeGreaterThan(10000);
    for (const guide of guides) expect(text).toContain(guide.h1);
    for (const term of glossaryTerms) expect(text).toContain(term.term);
    for (const comparison of comparisons) expect(text).toContain(comparison.h1);
  });
});
