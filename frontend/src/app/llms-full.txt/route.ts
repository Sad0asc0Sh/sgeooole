/**
 * /llms-full.txt — the full text of the site's editorial content
 * (guides, glossary, comparisons) in one machine-readable file,
 * generated from the validated programmatic content layer.
 *
 * Lets an AI agent get everything in a single request instead of crawling.
 */

import {
  guides,
  glossaryTerms,
  comparisons,
  type ContentBlock,
} from "@/content/programmatic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

function renderBlock(block: ContentBlock): string {
  switch (block.type) {
    case "paragraph":
      return block.text;
    case "list":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "table": {
      const header = `| ${block.headers.join(" | ")} |`;
      const divider = `| ${block.headers.map(() => "---").join(" | ")} |`;
      const rows = block.rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
      return `${header}\n${divider}\n${rows}`;
    }
    case "callout":
      return `> ${block.text}`;
  }
}

function buildBody(): string {
  const parts: string[] = [
    `# ekgkala (ای کا جی کالا) — محتوای کامل راهنماها، واژه‌نامه و مقایسه‌ها`,
    ``,
    `> این فایل نسخه متنی کامل محتوای تحریریه‌ای سایت برای دستیارهای هوش مصنوعی است.`,
    `> وب‌سایت: ${SITE_URL}`,
    ``,
    `---`,
    ``,
  ];

  parts.push(`# راهنمای خرید`, ``);
  for (const guide of guides) {
    parts.push(`## ${guide.h1}`, ``, `${SITE_URL}/guides/${guide.slug}`, ``, guide.intro, ``);
    for (const section of guide.sections) {
      parts.push(`### ${section.heading}`, ``);
      for (const block of section.blocks) parts.push(renderBlock(block), ``);
    }
    parts.push(`### سوالات متداول`, ``);
    for (const faq of guide.faqs) {
      parts.push(`**${faq.question}**`, ``, faq.answer, ``);
    }
    parts.push(`---`, ``);
  }

  parts.push(`# واژه‌نامه دوربین مداربسته`, ``);
  for (const term of glossaryTerms) {
    parts.push(`## ${term.term}`, ``, `${SITE_URL}/glossary/${term.slug}`, ``, term.definition, ``);
    for (const block of term.body) parts.push(renderBlock(block), ``);
    if (term.examples.length > 0) {
      parts.push(`**مثال:**`, ``);
      for (const example of term.examples) parts.push(`- ${example}`);
      parts.push(``);
    }
    parts.push(`---`, ``);
  }

  parts.push(`# مقایسه‌ها`, ``);
  for (const comparison of comparisons) {
    parts.push(`## ${comparison.h1}`, ``, `${SITE_URL}/compare/${comparison.slug}`, ``, comparison.intro, ``);
    parts.push(`### ${comparison.sideA.name}`, ``, comparison.sideA.summary, ``);
    parts.push(`نقاط قوت: ${comparison.sideA.strengths.join("؛ ")}`, ``);
    parts.push(`نقاط ضعف: ${comparison.sideA.weaknesses.join("؛ ")}`, ``);
    parts.push(`### ${comparison.sideB.name}`, ``, comparison.sideB.summary, ``);
    parts.push(`نقاط قوت: ${comparison.sideB.strengths.join("؛ ")}`, ``);
    parts.push(`نقاط ضعف: ${comparison.sideB.weaknesses.join("؛ ")}`, ``);
    const { headers, rows } = comparison.table;
    parts.push(`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`);
    for (const row of rows) parts.push(`| ${row.join(" | ")} |`);
    parts.push(``, `**جمع‌بندی:** ${comparison.verdict}`, ``);
    parts.push(`### سوالات متداول`, ``);
    for (const faq of comparison.faqs) {
      parts.push(`**${faq.question}**`, ``, faq.answer, ``);
    }
    parts.push(`---`, ``);
  }

  return parts.join("\n");
}

export function buildLlmsFullTxtBody(): string {
  return buildBody();
}

export async function GET() {
  return new Response(buildLlmsFullTxtBody(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
