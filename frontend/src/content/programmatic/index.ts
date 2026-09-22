/**
 * Programmatic SEO — content index
 * ============================================================
 * Single entry point for all programmatic content lookups.
 * Used by /guides, /glossary, /compare routes and sitemap.ts.
 */
export type { ContentBlock, Guide, GuideSection, FaqEntry, GlossaryTerm, Comparison, ComparisonSide } from "./types";
export { guides, getGuide, getAllGuideSlugs } from "./guides";
export { glossaryTerms, getGlossaryTerm, getAllGlossarySlugs } from "./glossary";
export { comparisons, getComparison, getAllComparisonSlugs } from "./comparisons";

import { guides, getGuide } from "./guides";
import { glossaryTerms, getGlossaryTerm } from "./glossary";
import { comparisons, getComparison } from "./comparisons";

export const PROGRAMMATIC_SECTIONS = {
  guides: { path: "/guides", title: "راهنمای خرید", priority: 0.8 as const, changeFrequency: "weekly" as const },
  glossary: { path: "/glossary", title: "واژه‌نامه", priority: 0.6 as const, changeFrequency: "monthly" as const },
  compare: { path: "/compare", title: "مقایسه‌ها", priority: 0.75 as const, changeFrequency: "weekly" as const },
} as const;

/** All programmatic page URLs for sitemap generation. */
export function getAllProgrammaticUrls(): { url: string; lastModified: string; changeFrequency: "weekly" | "monthly"; priority: number }[] {
  const urls: { url: string; lastModified: string; changeFrequency: "weekly" | "monthly"; priority: number }[] = [];
  for (const g of guides) {
    urls.push({ url: `${PROGRAMMATIC_SECTIONS.guides.path}/${g.slug}`, lastModified: g.updatedAt, changeFrequency: "weekly", priority: 0.8 });
  }
  for (const t of glossaryTerms) {
    urls.push({ url: `${PROGRAMMATIC_SECTIONS.glossary.path}/${t.slug}`, lastModified: t.updatedAt, changeFrequency: "monthly", priority: 0.6 });
  }
  for (const c of comparisons) {
    urls.push({ url: `${PROGRAMMATIC_SECTIONS.compare.path}/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly", priority: 0.75 });
  }
  return urls;
}

/** Resolve a slug to any related entry (for cross-linking between sections). */
export function resolveRelatedLink(slug: string): { href: string; label: string } | null {
  const guide = getGuide(slug);
  if (guide) return { href: `/guides/${guide.slug}`, label: guide.h1 };
  const term = getGlossaryTerm(slug);
  if (term) return { href: `/glossary/${term.slug}`, label: term.term };
  const comparison = getComparison(slug);
  if (comparison) return { href: `/compare/${comparison.slug}`, label: comparison.h1 };
  return null;
}

/**
 * Build-time validation: duplicate slugs, dangling related links.
 * Run in dev/test to catch authoring mistakes before they ship.
 */
export function validateProgrammaticContent(): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();

  const register = (kind: string, slug: string) => {
    const prev = seen.get(slug);
    if (prev) errors.push(`Duplicate slug "${slug}" in ${kind} (already in ${prev})`);
    else seen.set(slug, kind);
  };

  const checkLinks = (kind: string, slug: string, related: string[]) => {
    for (const rel of related) {
      if (rel === slug) {
        errors.push(`Self-link in ${kind}/${slug}`);
        continue;
      }
      if (!resolveRelatedLink(rel)) errors.push(`Dangling related link "${rel}" in ${kind}/${slug}`);
    }
  };

  for (const g of guides) {
    register("guides", g.slug);
    if (!g.title || !g.metaDescription || !g.h1 || !g.intro) errors.push(`Missing SEO fields in guides/${g.slug}`);
    if (g.faqs.length === 0) errors.push(`No FAQs in guides/${g.slug}`);
    checkLinks("guides", g.slug, g.relatedSlugs);
  }
  for (const t of glossaryTerms) {
    register("glossary", t.slug);
    if (!t.term || !t.metaDescription || !t.definition) errors.push(`Missing SEO fields in glossary/${t.slug}`);
    checkLinks("glossary", t.slug, t.relatedSlugs);
  }
  for (const c of comparisons) {
    register("compare", c.slug);
    if (!c.title || !c.metaDescription || !c.h1 || !c.verdict) errors.push(`Missing SEO fields in compare/${c.slug}`);
    checkLinks("compare", c.slug, c.relatedSlugs);
  }
  return errors;
}
