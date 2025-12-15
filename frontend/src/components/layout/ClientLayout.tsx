"use client";

import { useState } from "react";

import { usePathname } from "next/navigation";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import Footer from "@/components/layout/Footer";
import ServicesWidget from "@/components/features/services/ServicesWidget";

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [isAIOpen, setIsAIOpen] = useState(false);
    const [isServicesOpen, setIsServicesOpen] = useState(false);

    const isLoginPage = pathname?.startsWith("/login");
    const isProductPage = pathname?.startsWith("/product/");

    // Profile sub-pages: show header on desktop, hide on mobile
    const isProfileSubPage = pathname?.startsWith("/profile/") && pathname !== "/profile";
    const hasStandaloneMobileHeader =
        pathname === "/cart" ||
        pathname === "/checkout" ||
        pathname === "/tracking" ||
        pathname === "/about" ||
        pathname === "/contact" ||
        pathname?.startsWith("/order/");

    // Header should stay consistent on desktop across the site.
    // We still hide the full "chrome" (footer/bottom nav) on product pages to avoid layout conflicts.
    const showHeader = !isLoginPage;
    const showChrome = !isLoginPage && !isProductPage;

    // Hide the global header on mobile for pages that use their own mobile header
    const hideHeaderOnMobile = isProfileSubPage || isProductPage || hasStandaloneMobileHeader;

    return (
        <main className="min-h-screen flex flex-col">
            {/* Header: hidden on mobile for profile sub-pages, always shown on desktop */}
            {showHeader && (
                <div className={hideHeaderOnMobile ? "hidden md:block" : ""}>
                    <Header isAIOpen={isAIOpen} setIsAIOpen={setIsAIOpen} />
                </div>
            )}

            <div className={`flex-grow ${showChrome ? "pb-32" : ""}`}>
                {children}
            </div>

            {showChrome && (
                <>
                    <ServicesWidget isOpen={isServicesOpen} onOpenChange={setIsServicesOpen} />
                    <Footer />
                    <BottomNav
                        isServicesOpen={isServicesOpen}
                        onNavClick={() => {
                            // Delay closing to allow navigation to happen behind the sheet
                            setTimeout(() => setIsAIOpen(false), 500);
                        }}
                    />
                </>
            )}
        </main>
    );
}
