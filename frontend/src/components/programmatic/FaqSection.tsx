import type { FaqEntry } from "@/content/programmatic/types";

/**
 * FAQ section with server-rendered FAQPage JSON-LD (crawler-visible),
 * following the existing /faq page pattern.
 */
export default function FaqSection({ faqs, heading = "سوالات متداول" }: { faqs: FaqEntry[]; heading?: string }) {
  if (!faqs || faqs.length === 0) return null;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <section className="mt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <h2 className="text-xl font-extrabold text-gray-900 mb-5">{heading}</h2>
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <details
            key={i}
            className="group rounded-xl border border-gray-200 bg-white open:shadow-sm transition-shadow"
          >
            <summary className="cursor-pointer list-none px-5 py-4 font-bold text-gray-800 text-[15px] flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              {faq.question}
              <span className="text-blue-600 text-xl leading-none transition-transform group-open:rotate-45 shrink-0">+</span>
            </summary>
            <p className="px-5 pb-5 text-gray-600 leading-8 text-sm">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
