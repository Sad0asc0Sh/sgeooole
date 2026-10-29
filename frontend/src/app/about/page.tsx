import type { Metadata } from "next";
import AboutClient from "./AboutClient";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

const title = "درباره ای کا جی کالا | ekgkala";
const description =
  "با داستان شکل‌گیری فروشگاه اینترنتی ای کا جی کالا (ekgkala) از سال ۱۳۹۶ بر پایه امنیت و آرامش، سه پایگاه فعال مشهد و شبکه تأمین گسترده کالای تکنولوژی آشنا شوید.";

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
