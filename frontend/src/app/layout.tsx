import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import "swiper/css";
import "swiper/css/free-mode";
import ClientLayout from "@/components/layout/ClientLayout";
import GoogleAuthProvider from "@/components/providers/GoogleAuthProvider";
import ThirdPartyScripts from "@/components/ThirdPartyScripts";
import CanonicalTag from "@/components/CanonicalTag";
import { Suspense } from "react";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://welfvita.ir'),
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
          <Suspense fallback={null}>
            <ClientLayout>{children}</ClientLayout>
          </Suspense>
        </GoogleAuthProvider>
        <ThirdPartyScripts />
      </body>
    </html>
  );
}
