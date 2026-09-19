import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  themeColor: "#f59e0b",
  width: "device-width",
  initialScale: 1,
};

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
  title: {
    default: "ای کا جی کالا | ekgkala | فروشگاه اینترنتی",
    template: "%s | ای کا جی کالا",
  },
  description:
    "ای کا جی کالا (ekgkala)؛ فروشگاه اینترنتی با پیشنهادهای ویژه، قیمت مناسب، تحویل سریع و تجربه خرید روان.",
  keywords: [
    "ای کا جی کالا",
    "ekgkala",
    "ای‌کا‌جی‌کالا",
    "EKG KALA",
    "ای کا جی کالا فروشگاه",
    "فروشگاه اینترنتی ای کا جی کالا",
    "خرید آنلاین",
    "فروشگاه اینترنتی",
  ],
  openGraph: {
    title: "ای کا جی کالا | ekgkala | فروشگاه اینترنتی",
    description:
      "ای کا جی کالا (ekgkala)؛ فروشگاه اینترنتی با پیشنهادهای ویژه، قیمت مناسب و تحویل سریع.",
    url: "./",
    siteName: "ای کا جی کالا",
    locale: "fa_IR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ای کا جی کالا | ekgkala | فروشگاه اینترنتی",
    description:
      "ای کا جی کالا (ekgkala)؛ فروشگاه اینترنتی با پیشنهادهای ویژه، قیمت مناسب و تحویل سریع.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
  appleWebApp: {
    capable: true,
    title: "ای کا جی کالا",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
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
