import type { Metadata } from "next";
import ContactClient from "./ContactClient";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

const title = "تماس با ای کا جی کالا | ekgkala";
const description =
  "راه‌های ارتباط با فروشگاه اینترنتی ای کا جی کالا (ekgkala)؛ تلفن، ایمیل و آدرس. پاسخگوی سوالات شما درباره سفارش و محصولات هستیم.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/contact`,
    siteName: "ای کا جی کالا",
    locale: "fa_IR",
    type: "website",
  },
};

export default function ContactPage() {
  // Entity SEO: this page is the canonical source of the store's branch
  // addresses and phones — including branch 3 (Khin Arab, Tarchi), the
  // address Enamad/Torob list for this store. The ContactPage schema ties
  // those third-party records back to this domain as the entity home.
  // All values are exactly as published in ContactClient's branch list.
  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${SITE_URL}/contact#contactpage`,
    name: "تماس با فروشگاه اینترنتی ای کا جی کالا (ekgkala)",
    url: `${SITE_URL}/contact`,
    inLanguage: "fa-IR",
    mainEntity: {
      "@type": "OnlineStore",
      "@id": `${SITE_URL}/#organization`,
      name: "ای کا جی کالا",
      alternateName: ["ای کا جی کالا", "ای‌کا‌جی کالا", "ekgkala", "EKG KALA"],
      url: SITE_URL,
      telephone: "05135013383",
      address: [
        {
          "@type": "PostalAddress",
          name: "شعبه ۱ ای کا جی کالا (بلوار پیروزی)",
          addressCountry: "IR",
          addressRegion: "خراسان رضوی",
          addressLocality: "مشهد",
          streetAddress: "پیروزی 75 بین ولایتی 9و11",
        },
        {
          "@type": "PostalAddress",
          name: "شعبه ۲ ای کا جی کالا (میدان صاحب‌الزمان)",
          addressCountry: "IR",
          addressRegion: "خراسان رضوی",
          addressLocality: "مشهد",
          streetAddress: "میدان صاحب الزمان پاساژ سبحان طبقه +۱ واحد ۱۶",
        },
        {
          "@type": "PostalAddress",
          name: "شعبه ۳ ای کا جی کالا (خین‌عرب - طرح‌چی)",
          addressCountry: "IR",
          addressRegion: "خراسان رضوی",
          addressLocality: "مشهد",
          streetAddress: "خین عرب طرح چی6 - پ63",
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
      />
      <ContactClient />
    </>
  );
}
