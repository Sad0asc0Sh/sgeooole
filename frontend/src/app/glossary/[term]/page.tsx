import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGlossaryTerm, getAllGlossarySlugs } from "@/content/programmatic";
import { NOT_FOUND_METADATA } from "@/lib/seo";
import ArticleShell from "@/components/programmatic/ArticleShell";
import ContentBlocks from "@/components/programmatic/ContentBlocks";
import FaqSection from "@/components/programmatic/FaqSection";
import ProductPicks from "@/components/programmatic/ProductPicks";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

export const revalidate = 86400;

export async function generateStaticParams() {
  return getAllGlossarySlugs().map((term) => ({ term }));
}

export async function generateMetadata({ params }: { params: Promise<{ term: string }> }): Promise<Metadata> {
  const { term } = await params;
  const entry = getGlossaryTerm(term);
  if (!entry) return NOT_FOUND_METADATA;
  const canonical = `${SITE_URL}/glossary/${entry.slug}`;
  const title = `${entry.term} | واژه‌نامه`;
  return {
    title,
    description: entry.metaDescription,
    alternates: { canonical },
    openGraph: {
      title,
      description: entry.metaDescription,
      url: canonical,
      siteName: "ای کا جی کالا",
      locale: "fa_IR",
      type: "article",
    },
  };
}

export default async function GlossaryTermPage({ params }: { params: Promise<{ term: string }> }) {
  const { term } = await params;
  const entry = getGlossaryTerm(term);
  if (!entry) notFound();

  const canonical = `${SITE_URL}/glossary/${entry.slug}`;
  const definedTermSchema = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: entry.term,
    description: entry.definition,
    inDefinedTermSet: `${SITE_URL}/glossary`,
    url: canonical,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSchema) }}
      />
      <ArticleShell
        crumbs={[
          { label: "خانه", href: "/" },
          { label: "واژه‌نامه", href: "/glossary" },
          { label: entry.term },
        ]}
        h1={entry.term}
        intro={entry.definition}
        updatedAt={entry.updatedAt}
        relatedSlugs={entry.relatedSlugs}
      >
        <section className="mb-8">
          <ContentBlocks blocks={entry.body} />
        </section>

        {entry.examples.length > 0 && (
          <section className="mb-8 rounded-xl bg-blue-50/60 border border-blue-100 p-5">
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">مثال کاربردی</h2>
            <ul className="space-y-2 text-[15px] text-gray-700 leading-7">
              {entry.examples.map((ex, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                  <span>{ex}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {entry.categorySlug && entry.categoryName && (
          <ProductPicks categorySlug={entry.categorySlug} categoryName={entry.categoryName} />
        )}

        {entry.faqs && entry.faqs.length > 0 && <FaqSection faqs={entry.faqs} />}
      </ArticleShell>
    </>
  );
}
