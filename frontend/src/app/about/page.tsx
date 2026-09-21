import type { Metadata } from "next";
import AboutClient from "./AboutClient";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

const title = "درباره ای کا جی کالا | ekgkala";
const description =
  "با فروشگاه اینترنتی ای کا جی کالا (ekgkala) آشنا شوید؛ سه شعبه فعال، تیم تخصصی تعمیرات و نمایندگی برندهای معتبر در خراسان بزرگ.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/about`,
    siteName: "ای کا جی کالا",
    locale: "fa_IR",
    type: "website",
  },
};

export default function AboutPage() {
  return <AboutClient />;
}
