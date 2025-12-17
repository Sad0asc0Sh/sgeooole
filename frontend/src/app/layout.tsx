import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import "swiper/css";
import "swiper/css/free-mode";
import ClientLayout from "@/components/layout/ClientLayout";
import GoogleAuthProvider from "@/components/providers/GoogleAuthProvider";
import ThirdPartyScripts from "@/components/ThirdPartyScripts";
import CanonicalTag from "@/components/CanonicalTag";
import SWRProvider from "@/providers/SWRProvider";
import { Suspense } from "react";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: (() => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL;
    if (!raw) return new URL("https://welfvita.ir");

    try {
      return new URL(raw);
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[metadata] Invalid NEXT_PUBLIC_SITE_URL: ${raw}`);
      } else {
        console.warn("[metadata] Invalid NEXT_PUBLIC_SITE_URL; falling back to default");
      }
      return new URL("https://welfvita.ir");
    }
  })(),
  title: "فروشگاه ولفویتا | خرید آنلاین محصولات",
  description: "خرید آنلاین با پیشنهادهای ویژه، تحویل سریع و تجربه کاربری روان",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className={`font-sans antialiased bg-gray-50 text-gray-900 ${vazirmatn.className}`}>
        <CanonicalTag />
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
