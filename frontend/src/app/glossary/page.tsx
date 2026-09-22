import type { Metadata } from "next";
import Link from "next/link";
import { glossaryTerms } from "@/content/programmatic";
import ProgrammaticBreadcrumbs from "@/components/programmatic/ProgrammaticBreadcrumbs";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

const title = "واژه‌نامه دوربین مداربسته | ای کا جی کالا";
const description =
  "واژه‌نامه تخصصی دوربین مداربسته و سیستم‌های امنیتی؛ معنی اصطلاحات فنی مثل DVR، NVR، PoE و دید در شب به زبان ساده.";

export const revalidate = 86400;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/glossary` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/glossary`,
    siteName: "ای کا جی کالا",
    locale: "fa_IR",
    type: "website",
  },
};

export default function GlossaryHubPage() {
  const termSetSchema = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "واژه‌نامه دوربین مداربسته ای کا جی کالا",
    url: `${SITE_URL}/glossary`,
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(termSetSchema) }}
      />
      <ProgrammaticBreadcrumbs items={[{ label: "خانه", href: "/" }, { label: "واژه‌نامه" }]} />
      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3">واژه‌نامه دوربین مداربسته</h1>
      <p className="text-gray-600 leading-8 text-[15px] mb-8">
        اصطلاحات فنی دنیای مداربسته را به زبان ساده بفهمید؛ هر واژه با تعریف دقیق، توضیح عمیق‌تر و
        مثال کاربردی همراه است.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {glossaryTerms.map((entry) => (
          <Link
            key={entry.slug}
            href={`/glossary/${entry.slug}`}
            className="group rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-md hover:border-blue-200 transition-all"
          >
            <h2 className="text-lg font-extrabold text-gray-900 group-hover:text-blue-700 transition-colors mb-2">
              {entry.term}
            </h2>
            <p className="text-sm text-gray-500 leading-7 line-clamp-3">{entry.definition}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
