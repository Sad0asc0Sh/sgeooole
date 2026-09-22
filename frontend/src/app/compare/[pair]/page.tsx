import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getComparison, getAllComparisonSlugs } from "@/content/programmatic";
import ArticleShell from "@/components/programmatic/ArticleShell";
import ContentBlocks from "@/components/programmatic/ContentBlocks";
import FaqSection from "@/components/programmatic/FaqSection";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

export const revalidate = 3600;

export async function generateStaticParams() {
  return getAllComparisonSlugs().map((pair) => ({ pair }));
}

export async function generateMetadata({ params }: { params: Promise<{ pair: string }> }): Promise<Metadata> {
  const { pair } = await params;
  const comparison = getComparison(pair);
  if (!comparison) return {};
  const canonical = `${SITE_URL}/compare/${comparison.slug}`;
  return {
    title: comparison.title,
    description: comparison.metaDescription,
    alternates: { canonical },
    openGraph: {
      title: comparison.title,
      description: comparison.metaDescription,
      url: canonical,
      siteName: "ای کا جی کالا",
      locale: "fa_IR",
      type: "article",
    },
  };
}

function SideCard({ side, accent }: { side: { name: string; summary: string; strengths: string[]; weaknesses: string[] }; accent: "blue" | "emerald" }) {
  const accentBg = accent === "blue" ? "bg-blue-50/60 border-blue-100" : "bg-emerald-50/60 border-emerald-100";
  const dot = accent === "blue" ? "bg-blue-600" : "bg-emerald-600";
  return (
    <div className={`rounded-2xl border p-6 ${accentBg}`}>
      <h2 className="text-lg font-extrabold text-gray-900 mb-2">{side.name}</h2>
      <p className="text-sm text-gray-600 leading-7 mb-4">{side.summary}</p>
      <h3 className="text-sm font-bold text-gray-800 mb-2">نقاط قوت</h3>
      <ul className="space-y-1.5 mb-4">
        {side.strengths.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-700 leading-6">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span>{s}</span>
          </li>
        ))}
      </ul>
      <h3 className="text-sm font-bold text-gray-800 mb-2">نقاط ضعف</h3>
      <ul className="space-y-1.5">
        {side.weaknesses.map((w, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-600 leading-6">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
            <span>{w}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ComparePage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params;
  const comparison = getComparison(pair);
  if (!comparison) notFound();

  const canonical = `${SITE_URL}/compare/${comparison.slug}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: comparison.h1,
    description: comparison.metaDescription,
    mainEntityOfPage: canonical,
    inLanguage: "fa-IR",
    author: { "@type": "Organization", name: "ای کا جی کالا", url: SITE_URL },
    publisher: { "@type": "Organization", name: "ای کا جی کالا", url: SITE_URL },
    dateModified: comparison.updatedAt,
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
          { label: "مقایسه‌ها", href: "/compare" },
          { label: comparison.h1 },
        ]}
        h1={comparison.h1}
        intro={comparison.intro}
        updatedAt={comparison.updatedAt}
        relatedSlugs={comparison.relatedSlugs}
      >
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <SideCard side={comparison.sideA} accent="blue" />
          <SideCard side={comparison.sideB} accent="emerald" />
        </div>

        <section className="mb-8">
          <h2 className="text-xl font-extrabold text-gray-900 mb-4">مقایسه رو در رو</h2>
          <ContentBlocks
            blocks={[{ type: "table", headers: comparison.table.headers, rows: comparison.table.rows }]}
          />
        </section>

        <section className="mb-8 rounded-2xl border-r-4 border-blue-600 bg-blue-50/60 p-6">
          <h2 className="text-lg font-extrabold text-gray-900 mb-3">جمع‌بندی: کدام را بخرید؟</h2>
          <p className="text-[15px] text-gray-700 leading-8 whitespace-pre-line">{comparison.verdict}</p>
        </section>

        <FaqSection faqs={comparison.faqs} />
      </ArticleShell>
    </>
  );
}
