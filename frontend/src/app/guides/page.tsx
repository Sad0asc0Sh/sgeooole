import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "@/content/programmatic";
import ProgrammaticBreadcrumbs from "@/components/programmatic/ProgrammaticBreadcrumbs";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

const title = "راهنمای خرید دوربین مداربسته";
const description =
  "راهنمای‌های تخصصی خرید دوربین مداربسته، DVR و تجهیزات امنیتی؛ نوشته‌شده توسط تیم فنی ای کا جی کالا با پیشنهادهای به‌روز.";

export const revalidate = 3600;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/guides` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/guides`,
    siteName: "ای کا جی کالا",
    locale: "fa_IR",
    type: "website",
  },
};

export default function GuidesHubPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ProgrammaticBreadcrumbs items={[{ label: "خانه", href: "/" }, { label: "راهنمای خرید" }]} />
      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3">راهنمای خرید</h1>
      <p className="text-gray-600 leading-8 text-[15px] mb-8">
        راهنماهای تخصصی انتخاب و خرید دوربین مداربسته و تجهیزات امنیتی؛ هر راهنما برای یک نیاز واقعی
        نوشته شده و پیشنهادهای آن با قیمت و موجودی به‌روز فروشگاه همراه است.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="group rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-md hover:border-blue-200 transition-all"
          >
            <h2 className="text-lg font-extrabold text-gray-900 group-hover:text-blue-700 transition-colors mb-2">
              {guide.h1}
            </h2>
            <p className="text-sm text-gray-500 leading-7 line-clamp-3">{guide.metaDescription}</p>
            <span className="mt-4 inline-block text-sm font-bold text-blue-600">خواندن راهنما ←</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
