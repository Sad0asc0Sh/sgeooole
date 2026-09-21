import type { Metadata } from "next";
import BlogClient from "./BlogClient";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

const title = "بلاگ ای کا جی کالا | ekgkala";
const description =
  "بلاگ فروشگاه اینترنتی ای کا جی کالا (ekgkala)؛ آموزش‌ها، راهنمای خرید و اخبار محصولات.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/blog`,
    siteName: "ای کا جی کالا",
    locale: "fa_IR",
    type: "website",
  },
  // The blog is a placeholder until real articles ship — keep it out of the index.
  robots: { index: false, follow: true },
};

export default function BlogPage() {
  return <BlogClient />;
}
