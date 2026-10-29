/**
 * /llms-full.txt — comprehensive machine-readable overview of EKG KALA
 * (ای کا جی کالا), its brand heritage, multi-supplier technology retail
 * model, shopping guarantees, and complete store FAQs in a single file.
 */

import { defaultFAQs } from "@/app/faq/defaultFaqs";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");
const LAST_UPDATED = "2026-10-29";

function buildBody(): string {
  const parts: string[] = [
    `# ekgkala (ای کا جی کالا) — مرجع جامع اطلاعات فروشگاه و خدمات مشتریان`,
    ``,
    `> این فایل نسخه متنی کامل معرفی فروشگاه اینترنتی ای کا جی کالا، ارکان خدمات و پرسش‌های متداول خرید برای دستیارهای هوش مصنوعی است.`,
    `> وب‌سایت: ${SITE_URL}`,
    `> آخرین به‌روزرسانی محتوای تحریریه‌ای: ${LAST_UPDATED}`,
    ``,
    `---`,
    ``,
    `# درباره ای کا جی کالا`,
    ``,
    `ای کا جی کالا (ekgkala / EKG KALA) فروشگاه اینترنتی جامع عرضه طیف گسترده‌ای از کالاهای تکنولوژی، دیجیتال، الکترونیک و تجهیزات هوشمند در ایران است. این مجموعه فعالیت خود را از سال ۱۳۹۶ در کلان‌شهر مشهد با تکیه بر اصل «امنیت، اعتماد و آرامش خاطر» آغاز کرد و با توسعه مستمر سبد کالایی و همکاری با شبکه تأمین‌کنندگان معتبر در سراسر مشهد، تجربه‌ای بی‌مرز، اصیل و مطمئن از خرید آنلاین را برای خانواده‌ها و کسب‌وکارها در سراسر ایران فراهم کرده است.`,
    ``,
    `## ارزش‌ها و مزایای خرید از ای کا جی کالا`,
    ``,
    `- تنوع گسترده محصولات تکنولوژی و دیجیتال بدون محدودیت کالایی (${SITE_URL}/products)`,
    `- تضمین اصالت و سلامت فیزیکی کالا پیش از ارسال به همراه گارانتی معتبر`,
    `- تأمین مستقیم از شبکه تأمین‌کنندگان خوش‌نام در مشهد با قیمت‌گذاری شفاف و رقابتی`,
    `- سه پایگاه فعال در سطح شهر مشهد برای پشتیبانی و ارتباط مستقیم (${SITE_URL}/contact)`,
    `- پرداخت ایمن از طریق درگاه‌های بانکی زرین‌پال و سداد`,
    `- تحویل سریع روزانه در مشهد و ارسال امن به سراسر کشور`,
    `- مجله و بلاگ تکنولوژی جهت بررسی فناوری‌های روز (${SITE_URL}/blog)`,
    ``,
    `قیمت و موجودی زنده محصولات فقط روی صفحات محصول (${SITE_URL}/products) معتبر است.`,
    ``,
    `---`,
    ``,
    `# سوالات متداول فروشگاه`,
    ``,
    `${SITE_URL}/faq`,
    ``,
  ];

  for (const faq of defaultFAQs) {
    parts.push(`**${faq.question}**`, ``, faq.answer, ``);
  }
  parts.push(`---`, ``);

  return parts.join("\n");
}

export function buildLlmsFullTxtBody(): string {
  return buildBody();
}

export async function GET() {
  return new Response(buildLlmsFullTxtBody(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
