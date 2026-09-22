import type { ReactNode } from "react";
import Link from "next/link";
import ProgrammaticBreadcrumbs, { type Crumb } from "./ProgrammaticBreadcrumbs";
import { resolveRelatedLink } from "@/content/programmatic";

function toJalali(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
}

/** Consistent article shell for all programmatic pages. */
export default function ArticleShell({
  crumbs,
  h1,
  intro,
  updatedAt,
  relatedSlugs,
  children,
}: {
  crumbs: Crumb[];
  h1: string;
  intro: string;
  updatedAt: string;
  relatedSlugs: string[];
  children: ReactNode;
}) {
  const related = relatedSlugs
    .map(resolveRelatedLink)
    .filter((l): l is { href: string; label: string } => l !== null);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ProgrammaticBreadcrumbs items={crumbs} />
      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-10 mb-3">{h1}</h1>
      {updatedAt && (
        <p className="text-xs text-gray-400 mb-6">آخرین به‌روزرسانی: {toJalali(updatedAt)}</p>
      )}
      <div className="text-gray-700 leading-8 text-[15px] mb-8 whitespace-pre-line">{intro}</div>

      {children}

      {related.length > 0 && (
        <section className="mt-10 rounded-2xl bg-gray-50 border border-gray-200 p-6">
          <h2 className="text-lg font-extrabold text-gray-900 mb-4">مطالب مرتبط</h2>
          <ul className="space-y-2.5">
            {related.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-blue-700 hover:text-blue-800 font-medium text-[15px]">
                  ← {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 rounded-2xl bg-blue-700 p-6 text-center text-white">
        <h2 className="text-lg font-extrabold mb-2">مشاوره رایگان خرید</h2>
        <p className="text-blue-100 text-sm leading-7 mb-4">
          برای انتخاب درست، از تیم تخصصی ای کا جی کالا مشاوره بگیرید.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/products"
            className="rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50 transition-colors"
          >
            مشاهده محصولات
          </Link>
          <Link
            href="/contact"
            className="rounded-xl border border-blue-300 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-600 transition-colors"
          >
            تماس با ما
          </Link>
        </div>
      </section>
    </main>
  );
}
