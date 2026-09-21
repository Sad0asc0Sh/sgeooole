import type { Metadata } from "next";
import FaqClient from "./FaqClient";
import { defaultFAQs } from "./defaultFaqs";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");
const API_BASE = (process.env.INTERNAL_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

const title = "سوالات متداول | ای کا جی کالا";
const description =
  "پاسخ سوالات متداول فروشگاه اینترنتی ای کا جی کالا (ekgkala)؛ پیگیری سفارش، روش‌های پرداخت، هزینه و زمان ارسال کالا.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/faq`,
    siteName: "ای کا جی کالا",
    locale: "fa_IR",
    type: "website",
  },
};

type FaqItem = { question?: string; answer?: string };

// Server-side copy of the CMS FAQ content (same source the client UI reads)
// so the FAQPage structured data is rendered in HTML for crawlers.
async function getFaqItems(): Promise<FaqItem[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${API_BASE}/pages/slug/faq`, {
        signal: controller.signal,
        next: { revalidate: 600 },
      });
      if (!res.ok) return defaultFAQs;
      const json = await res.json().catch(() => null);
      const content = json?.data?.content;
      if (typeof content === "string") {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {
          /* fall through to defaults */
        }
      }
      return defaultFAQs;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return defaultFAQs;
  }
}

export default async function FAQPage() {
  const faqs = await getFaqItems();
  const entities = faqs
    .filter((f) => f?.question && f?.answer)
    .map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    }));

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entities,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <FaqClient />
    </>
  );
}
