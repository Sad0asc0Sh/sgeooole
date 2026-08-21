import type { Metadata } from "next";
import { iransans } from "@/lib/fonts";
import "./globals.css";
import ClientLayout from "@/components/layout/ClientLayout";
import GoogleAuthProvider from "@/components/providers/GoogleAuthProvider";
import ThirdPartyScripts from "@/components/ThirdPartyScripts";
import ScrollRestorationProvider from "@/providers/ScrollRestorationProvider";
import SWRProvider from "@/providers/SWRProvider";
import LayoutStateProvider from "@/providers/LayoutStateProvider";
import RouteLoadingProvider from "@/providers/RouteLoadingProvider";
import { Suspense } from "react";

// Parspack Cloud Storage — DNS preconnect
const PARSPACK_ENDPOINT =
  process.env.NEXT_PUBLIC_PARSPACK_ENDPOINT ||
  "https://c258565.parspack.net";

export const metadata: Metadata = {
  metadataBase: (() => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL;
    if (!raw) return new URL("https://www.ekgkala.ir");

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
      return new URL("https://www.ekgkala.ir");
    }
  })(),
  alternates: {
    canonical: "./",
  },
  title: "ای‌کا‌جی کالا",
  description:
    "خرید آنلاین با پیشنهادهای ویژه، تحویل سریع و تجربه کاربری روان",
  other: {
    enamad: "46480007",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={iransans.variable}>
      <head>
        {/* Parspack Storage DNS Prefetch & Preconnect for LCP optimization */}
        <link
          rel="dns-prefetch"
          href={PARSPACK_ENDPOINT}
        />
        <link
          rel="preconnect"
          href={PARSPACK_ENDPOINT}
          crossOrigin="anonymous"
        />
        {/* Second preconnect without crossorigin for non-CORS image fetches */}
        <link
          rel="preconnect"
          href={PARSPACK_ENDPOINT}
        />
      </head>
      <body
        className={`font-sans antialiased bg-gray-50 text-gray-900 ${iransans.className}`}
      >
        <GoogleAuthProvider>
          <SWRProvider>
            <ScrollRestorationProvider>
              <LayoutStateProvider>
                <Suspense fallback={null}>
                  <RouteLoadingProvider>
                    <ClientLayout>{children}</ClientLayout>
                  </RouteLoadingProvider>
                </Suspense>
              </LayoutStateProvider>
            </ScrollRestorationProvider>
          </SWRProvider>
        </GoogleAuthProvider>
        <ThirdPartyScripts />
      </body>
    </html>
  );
}
