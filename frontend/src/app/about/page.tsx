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
  // Entity SEO: AboutPage schema so search/AI crawlers read the brand's
  // identity (founded ۱۳۹۶, three Mashhad branches) from this site itself
  // and resolve it to the same #organization entity as the homepage.
  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${SITE_URL}/about#aboutpage`,
    name: "درباره فروشگاه اینترنتی ای کا جی کالا (ekgkala)",
    description,
    url: `${SITE_URL}/about`,
    inLanguage: "fa-IR",
    mainEntity: {
      "@id": `${SITE_URL}/#organization`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }}
      />
      <AboutClient />
    </>
  );
}
