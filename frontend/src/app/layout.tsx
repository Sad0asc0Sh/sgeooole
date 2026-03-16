import type { Metadata } from "next";
import { iransans } from "@/lib/fonts"; // import فونت محلی
import "./globals.css";
import "swiper/css";
import "swiper/css/free-mode";
import ClientLayout from "@/components/layout/ClientLayout";
import GoogleAuthProvider from "@/components/providers/GoogleAuthProvider";
import ThirdPartyScripts from "@/components/ThirdPartyScripts";
import SWRProvider from "@/providers/SWRProvider";
import { Suspense } from "react";

export const metadata: Metadata = {
  metadataBase: (() => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL;
    if (!raw) return new URL("https://ekgkala.ir");

    try {
      return new URL(raw);
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[metadata] Invalid NEXT_PUBLIC_SITE_URL: ${raw}`);
      } else {
        console.warn("[metadata] Invalid NEXT_PUBLIC_SITE_URL; falling back to default");
      }
      return new URL("https://ekgkala.ir");
    }
  })(),
  alternates: {
    canonical: "./",
  },
  title: "فروشگاه ای‌کا‌جی کالا | خرید آنلاین محصولات",
  description: "خرید آنلاین با پیشنهادهای ویژه، تحویل سریع و تجربه کاربری روان",
  other: {
    'enamad': '46480007',
  },
  icons: {
    icon: '/logo-text-high-res.jpg',
    shortcut: '/logo-text-high-res.jpg',
    apple: '/logo-text-high-res.jpg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={iransans.variable}>
      <body className={`font-sans antialiased bg-gray-50 text-gray-900 ${iransans.className}`}>
        <GoogleAuthProvider>
          <SWRProvider>
            <Suspense fallback={null}>
              <ClientLayout>{children}</ClientLayout>
            </Suspense>
          </SWRProvider>
        </GoogleAuthProvider>
        <ThirdPartyScripts />
      </body>
    </html>
  );
}
