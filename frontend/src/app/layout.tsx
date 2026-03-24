import type { Metadata } from "next";
import { iransans } from "@/lib/fonts";
import "./globals.css";
import ClientLayout from "@/components/layout/ClientLayout";
import GoogleAuthProvider from "@/components/providers/GoogleAuthProvider";
import ThirdPartyScripts from "@/components/ThirdPartyScripts";
import SWRProvider from "@/providers/SWRProvider";
import { Suspense } from "react";

// ArvanCloud configuration for DNS preconnect
const ARVAN_ENDPOINT =
  process.env.NEXT_PUBLIC_ARVAN_ENDPOINT ||
  "https://s3.ir-thr-at1.arvanstorage.ir";
const ARVAN_BUCKET_NAME =
  process.env.NEXT_PUBLIC_ARVAN_BUCKET_NAME || "";

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
        console.warn(
          "[metadata] Invalid NEXT_PUBLIC_SITE_URL; falling back to default"
        );
      }
      return new URL("https://ekgkala.ir");
    }
  })(),
  alternates: {
    canonical: "./",
  },
  title: "فروشگاه ای‌کا‌جی کالا | خرید آنلاین محصولات",
  description:
    "خرید آنلاین با پیشنهادهای ویژه، تحویل سریع و تجربه کاربری روان",
  other: {
    enamad: "46480007",
  },
  icons: {
    icon: "/logo-text-high-res.jpg",
    shortcut: "/logo-text-high-res.jpg",
    apple: "/logo-text-high-res.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={iransans.variable}>
      <head>
        {/* ArvanCloud DNS Prefetch & Preconnect for LCP optimization */}
        <link
          rel="dns-prefetch"
          href={ARVAN_ENDPOINT}
        />
        <link
          rel="preconnect"
          href={ARVAN_ENDPOINT}
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`font-sans antialiased bg-gray-50 text-gray-900 ${iransans.className}`}
      >
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
