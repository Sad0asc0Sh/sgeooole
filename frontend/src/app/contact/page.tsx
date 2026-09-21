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
  return <ContactClient />;
}
