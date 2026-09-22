import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGuide, getAllGuideSlugs } from "@/content/programmatic";
import ArticleShell from "@/components/programmatic/ArticleShell";
import ContentBlocks from "@/components/programmatic/ContentBlocks";
import FaqSection from "@/components/programmatic/FaqSection";
import ProductPicks from "@/components/programmatic/ProductPicks";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

export const revalidate = 3600;

export async function generateStaticParams() {
  return getAllGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  const canonical = `${SITE_URL}/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.metaDescription,
    alternates: { canonical },
    openGraph: {
      title: guide.title,
      description: guide.metaDescription,
      url: canonical,
      siteName: "ای کا جی کالا",
      locale: "fa_IR",
      type: "article",
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const canonical = `${SITE_URL}/guides/${guide.slug}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.h1,
    description: guide.metaDescription,
    mainEntityOfPage: canonical,
    inLanguage: "fa-IR",
    author: { "@type": "Organization", name: "ای کا جی کالا", url: SITE_URL },
    publisher: { "@type": "Organization", name: "ای کا جی کالا", url: SITE_URL },
    dateModified: guide.updatedAt,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <ArticleShell
        crumbs={[
          { label: "خانه", href: "/" },
          { label: "راهنمای خرید", href: "/guides" },
          { label: guide.h1 },
        ]}
        h1={guide.h1}
        intro={guide.intro}
        updatedAt={guide.updatedAt}
        relatedSlugs={guide.relatedSlugs}
      >
        {guide.sections.map((section, i) => (
          <section key={i} className="mb-8">
            <h2 className="text-xl font-extrabold text-gray-900 mb-4">{section.heading}</h2>
            <ContentBlocks blocks={section.blocks} />
          </section>
        ))}

        {guide.categorySlug && guide.categoryName && (
          <ProductPicks categorySlug={guide.categorySlug} categoryName={guide.categoryName} />
        )}

        <FaqSection faqs={guide.faqs} />
      </ArticleShell>
    </>
  );
}
