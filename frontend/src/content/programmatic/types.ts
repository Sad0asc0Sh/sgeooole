/**
 * Programmatic SEO — content data layer types
 * ============================================================
 * Phase 1 infrastructure for /guides, /glossary and /compare.
 *
 * Content lives as typed TS modules (versioned, build-time validated)
 * so adding a new page = adding one entry to guides.ts / glossary.ts /
 * comparisons.ts. No CMS round-trip, no runtime parsing.
 *
 * Every entry MUST satisfy the uniqueness rules from the strategy doc:
 * unique intro, unique FAQs, data-driven sections — never just a
 * variable swapped in a template.
 */

export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "callout"; text: string };

export interface GuideSection {
  heading: string;
  blocks: ContentBlock[];
}

export interface FaqEntry {
  question: string;
  answer: string;
}

/** Buying-guide / curation page (Curation + Personas playbooks) */
export interface Guide {
  slug: string;
  /** <title> tag */
  title: string;
  metaDescription: string;
  /** visible H1 */
  h1: string;
  /** unique intro, 2–3 short paragraphs joined by \n\n */
  intro: string;
  /** ISO date shown as "آخرین به‌روزرسانی" */
  updatedAt: string;
  /**
   * Category slug used for live product picks and the
   * "مشاهده همه محصولات" link (/products?category=...).
   * Omit when the guide is not tied to one category.
   */
  categorySlug?: string;
  categoryName?: string;
  sections: GuideSection[];
  faqs: FaqEntry[];
  /** slugs of related guides for internal linking */
  relatedSlugs: string[];
}

/** Glossary term page (Glossary playbook) */
export interface GlossaryTerm {
  slug: string;
  term: string;
  metaDescription: string;
  /** one-paragraph dictionary-style definition */
  definition: string;
  /** deeper-than-dictionary content blocks */
  body: ContentBlock[];
  examples: string[];
  relatedSlugs: string[];
  updatedAt: string;
}

/** Head-to-head comparison page (Comparisons playbook) */
export interface ComparisonSide {
  name: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
}

export interface Comparison {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  sideA: ComparisonSide;
  sideB: ComparisonSide;
  table: { headers: string[]; rows: string[][] };
  /** honest verdict, by use case */
  verdict: string;
  faqs: FaqEntry[];
  relatedSlugs: string[];
  updatedAt: string;
}
