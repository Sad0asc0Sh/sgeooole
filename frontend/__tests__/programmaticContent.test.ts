/**
 * Programmatic SEO content validation tests.
 * Guards the uniqueness/integrity rules from the strategy doc:
 * no duplicate slugs, no dangling internal links, complete SEO fields.
 */
import {
  guides,
  glossaryTerms,
  comparisons,
  getGuide,
  getGlossaryTerm,
  getComparison,
  getAllProgrammaticUrls,
  resolveRelatedLink,
  validateProgrammaticContent,
} from "@/content/programmatic";

describe("programmatic content integrity", () => {
  test("validateProgrammaticContent reports zero errors", () => {
    const errors = validateProgrammaticContent();
    expect(errors).toEqual([]);
  });

  test("every guide has unique intro, sections and FAQs", () => {
    expect(guides.length).toBeGreaterThan(0);
    const intros = new Set(guides.map((g) => g.intro));
    expect(intros.size).toBe(guides.length);
    for (const g of guides) {
      expect(g.sections.length).toBeGreaterThan(0);
      expect(g.faqs.length).toBeGreaterThan(0);
    }
  });

  test("glossary terms have definitions deeper than one line", () => {
    for (const t of glossaryTerms) {
      expect(t.definition.length).toBeGreaterThan(40);
      expect(t.body.length).toBeGreaterThan(0);
    }
  });

  test("comparisons have honest verdicts and balanced sides", () => {
    for (const c of comparisons) {
      expect(c.verdict.length).toBeGreaterThan(50);
      expect(c.sideA.strengths.length).toBeGreaterThan(0);
      expect(c.sideB.strengths.length).toBeGreaterThan(0);
      expect(c.table.rows.length).toBeGreaterThan(0);
    }
  });

  test("lookups resolve all slugs", () => {
    for (const g of guides) expect(getGuide(g.slug)?.slug).toBe(g.slug);
    for (const t of glossaryTerms) expect(getGlossaryTerm(t.slug)?.slug).toBe(t.slug);
    for (const c of comparisons) expect(getComparison(c.slug)?.slug).toBe(c.slug);
  });

  test("related links resolve to real pages", () => {
    const allRelated = [
      ...guides.map((g) => g.relatedSlugs),
      ...glossaryTerms.map((t) => t.relatedSlugs),
      ...comparisons.map((c) => c.relatedSlugs),
    ].flat();
    expect(allRelated.length).toBeGreaterThan(0);
    for (const slug of allRelated) {
      const link = resolveRelatedLink(slug);
      expect(link).not.toBeNull();
      expect(link!.href).toMatch(/^\/(guides|glossary|compare)\//);
    }
  });

  test("sitemap entries cover every content page", () => {
    const urls = getAllProgrammaticUrls();
    const total = guides.length + glossaryTerms.length + comparisons.length;
    expect(urls.length).toBe(total);
    for (const u of urls) {
      expect(u.url).toMatch(/^\/(guides|glossary|compare)\//);
      expect(u.priority).toBeGreaterThan(0);
    }
  });
});
