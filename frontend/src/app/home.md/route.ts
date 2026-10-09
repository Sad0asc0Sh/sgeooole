/**
 * /home.md — Markdown representation of the homepage.
 *
 * Agent readiness (ai-seo skill v2.7.6, agent-readiness reference):
 * agents that send `Accept: text/markdown` to `/` are rewritten here by
 * middleware.ts (Markdown content negotiation: same canonical URL,
 * Markdown body, `Content-Type: text/markdown`, `Vary: Accept`).
 * Browsers keep receiving the normal HTML homepage — nothing changes
 * for human visitors.
 *
 * The body is a faithful extract of what the homepage represents:
 * a self-contained brand definition block, the store's categories and
 * the discovery links an agent needs. Prices are intentionally NOT
 * listed: they are live on the product pages (see /llms.txt).
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

const BODY = `# ای کا جی کالا (ekgkala) — فروشگاه دوربین مداربسته

ای کا جی کالا (ekgkala) فروشگاه اینترنتی تخصصی تجهیزات نظارت تصویری و امنیتی در ایران است که از سال ۱۳۹۶ در مشهد فعالیت می‌کند و سه شعبه فعال دارد. این فروشگاه دوربین مداربسته، دستگاه‌های DVR و NVR، دزدگیر اماکن و تجهیزات شبکه را با قیمت و موجودی به‌روز روی صفحات محصول عرضه می‌کند و به سراسر کشور ارسال دارد.

## دسته‌های اصلی

- دوربین مداربسته (دام، بولت، PTZ، تحت شبکه و آنالوگ): ${SITE_URL}/products
- دستگاه ضبط تصویر DVR و NVR: ${SITE_URL}/products
- دزدگیر اماکن و تجهیزات جانبی: ${SITE_URL}/products
- تجهیزات شبکه دوربین مداربسته (سوئیچ PoE، کابل، هارد): ${SITE_URL}/products
- درب اتوماتیک، جک پارکینگی و کرکره برقی: ${SITE_URL}/products

## راهنما و محتوای تخصصی

- راهنمای خرید دوربین مداربسته و تجهیزات امنیتی: ${SITE_URL}/guides
- واژه‌نامه تخصصی دوربین مداربسته: ${SITE_URL}/glossary
- مقایسه برندها و مدل‌ها: ${SITE_URL}/compare
- سوالات متداول (پرداخت، ارسال، پیگیری سفارش): ${SITE_URL}/faq

## درباره فروشگاه

- آغاز فعالیت: سال ۱۳۹۶، مشهد — ۳ شعبه فعال (نشانی و تلفن: ${SITE_URL}/contact)
- پرداخت: درگاه‌های امن زرین‌پال و سداد
- ارسال: مشهد معمولاً همان روز کاری؛ شهرستان‌ها ۵ تا ۷ روز کاری
- درباره ما: ${SITE_URL}/about
- تماس با ما: ${SITE_URL}/contact

## برای دستیارهای هوش مصنوعی

- نمای کامل سایت برای شما: ${SITE_URL}/llms.txt
- متن کامل راهنماها، واژه‌نامه و مقایسه‌ها: ${SITE_URL}/llms-full.txt
- نقشه سایت: ${SITE_URL}/sitemap.xml
`;

export function buildHomeMarkdownBody(): string {
  return BODY;
}

export async function GET() {
  return new Response(buildHomeMarkdownBody(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      Vary: "Accept",
    },
  });
}
