import type { Metadata } from "next";
import TermsClient from "./TermsClient";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekgkala.ir").replace(/\/$/, "");

const title = "قوانین و مقررات | ای کا جی کالا";
const description =
  "قوانین و مقررات خرید از فروشگاه اینترنتی ای کا جی کالا (ekgkala)؛ شرایط ثبت سفارش، پرداخت، ارسال و حریم خصوصی کاربران.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/terms`,
    siteName: "ای کا جی کالا",
    locale: "fa_IR",
    type: "website",
  },
};

export default function TermsPage() {
  return <TermsClient />;
}
