import type { Metadata } from "next";
import Link from "next/link";
import { comparisons } from "@/content/programmatic";
import ProgrammaticBreadcrumbs from "@/components/programmatic/ProgrammaticBreadcrumbs";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

const title = "مقایسه دوربین مداربسته و برندها";
const description =
  "مقایسه تخصصی برندها و انواع دوربین مداربسته؛ داهوا در برابر هایک ویژن، دام در برابر بولت و راهنمای انتخاب درست.";

export const revalidate = 3600;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/compare` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/compare`,
    siteName: "ای کا جی کالا",
    locale: "fa_IR",
    type: "website",
  },
};

export default function CompareHubPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ProgrammaticBreadcrumbs items={[{ label: "خانه", href: "/" }, { label: "مقایسه‌ها" }]} />
      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3">مقایسه‌ها</h1>
      <p className="text-gray-600 leading-8 text-[15px] mb-8">
        مقایسه بی‌طرفانه برندها و انواع دوربین مداربسته؛ با جدول رو در رو، نقاط قوت و ضعف، و
        جمع‌بندی صادقانه بر اساس کاربرد شما.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {comparisons.map((comparison) => (
          <Link
            key={comparison.slug}
            href={`/compare/${comparison.slug}`}
            className="group rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-md hover:border-blue-200 transition-all"
          >
            <h2 className="text-lg font-extrabold text-gray-900 group-hover:text-blue-700 transition-colors mb-2">
              {comparison.h1}
            </h2>
            <p className="text-sm text-gray-500 leading-7 line-clamp-3">{comparison.metaDescription}</p>
            <span className="mt-4 inline-block text-sm font-bold text-blue-600">مشاهده مقایسه ←</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
