/**
 * /home.md — Markdown representation of the homepage.
 *
 * Agent readiness: agents that send `Accept: text/markdown` to `/` are
 * rewritten here by middleware.ts (Markdown content negotiation: same
 * canonical URL, Markdown body, `Content-Type: text/markdown`, `Vary: Accept`).
 * Browsers keep receiving the normal HTML homepage.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

const BODY = `# ای کا جی کالا (ekgkala) — فروشگاه اینترنتی کالای تکنولوژی و دیجیتال

ای کا جی کالا (ekgkala) فروشگاه اینترنتی جامع عرضه طیف گسترده‌ای از محصولات تکنولوژی، دیجیتال، لوازم الکترونیک و تجهیزات هوشمند در ایران است که فعالیت خود را از سال ۱۳۹۶ در مشهد بر پایه امنیت، اصالت و آرامش خاطر مشتریان آغاز کرده است. این فروشگاه با تکیه بر سه پایگاه فعال و شبکه تأمین‌کنندگان معتبر در سراسر مشهد، کالاهای متنوع تکنولوژی را با قیمت و موجودی به‌روز روی صفحات محصول عرضه می‌کند و به سراسر کشور ارسال دارد.

## دسترسی سریع به فروشگاه

- مشاهده همه محصولات تکنولوژی و دیجیتال: ${SITE_URL}/products
- مرور دسته‌بندی‌های کالا: ${SITE_URL}/categories
- مجله و بلاگ ای کا جی کالا: ${SITE_URL}/blog
- سوالات متداول (پرداخت، ارسال، پیگیری سفارش): ${SITE_URL}/faq

## درباره فروشگاه

- آغاز فعالیت: سال ۱۳۹۶، مشهد — ۳ پایگاه و شعبه فعال (نشانی و تلفن: ${SITE_URL}/contact)
- شبکه تأمین: همکاری با تأمین‌کنندگان منتخب در سراسر مشهد با تضمین اصالت کالا
- پرداخت: درگاه‌های امن بانکی زرین‌پال و سداد
- ارسال: مشهد معمولاً همان روز کاری؛ سایر شهرهای کشور ۵ تا ۷ روز کاری
- درباره ما: ${SITE_URL}/about
- تماس با ما: ${SITE_URL}/contact
- قوانین و مقررات: ${SITE_URL}/terms

## برای دستیارهای هوش مصنوعی

- نمای کامل سایت برای دستیارها: ${SITE_URL}/llms.txt
- اطلاعات کامل فروشگاه و پرسش‌های متداول: ${SITE_URL}/llms-full.txt
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
