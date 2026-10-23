"use client";

import { useState } from "react";

import { usePathname } from "next/navigation";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import Footer from "@/components/layout/Footer";
import ServicesWidget from "@/components/features/services/ServicesWidget";
import AuthModalProvider from "@/providers/AuthModalProvider";
import { useLayoutState } from "@/providers/LayoutStateProvider";
import { useRouteLoadingState } from "@/providers/RouteLoadingProvider";
import { useCartSync } from "@/hooks/useCartSync";

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { isProductPage: isProductPageFromContext } = useLayoutState();
    const { isCurrentRouteReady } = useRouteLoadingState();
    const [isAIOpen, setIsAIOpen] = useState(false);
    const [isServicesOpen, setIsServicesOpen] = useState(false);

    // Re-read the cart whenever the document is resumed (back/forward, bfcache,
    // tab re-focus) so a returned page never paints a stale cart badge.
    useCartSync();

    const isLoginPage = pathname?.startsWith("/login");
    const isProductPage = pathname?.startsWith("/product/") || isProductPageFromContext;

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
    const isProductsListingRoute = pathname === "/products";
    // Support messenger: full-screen focused experience — hide the whole
    // chrome (BottomNav, footer, floating widgets) like product pages.
    const isSupportMessenger = pathname?.startsWith("/profile/tickets");
    const showChrome = !isLoginPage && !isProductPage && !isSupportMessenger && (!isProductsListingRoute || isCurrentRouteReady);

    // Footer is hidden on focused flows (account + purchase) where a big
    // marketing footer distracts from the task. BottomNav / Header (and the
    // desktop mega-menu inside it) stay untouched so site navigation and
    // sub-menus keep working exactly as before.
    const path = pathname ?? "";
    const isFooterHiddenRoute =
        path === "/profile" ||
        path.startsWith("/profile/") ||
        path === "/cart" ||
        path.startsWith("/cart/") ||
        path === "/checkout" ||
        path.startsWith("/checkout/") ||
        path.startsWith("/order/") ||
        path.startsWith("/payment/") ||
        path === "/tracking" ||
        path.startsWith("/tracking/") ||
        path === "/complete-profile" ||
        path.startsWith("/complete-profile/") ||
        path === "/forgot-password" ||
        path.startsWith("/forgot-password/") ||
        path.startsWith("/reset-password/") ||
        path.startsWith("/admin");
    const showFooter = showChrome && !isFooterHiddenRoute;

    // Hide the global header on mobile for pages that use their own mobile header
    const hideHeaderOnMobile = isProfileSubPage || isProductPage || hasStandaloneMobileHeader;

    return (
        <AuthModalProvider>
            <main className="min-h-screen flex flex-col">
                {/* Header: hidden on mobile for profile sub-pages, always shown on desktop */}
                {showHeader && (
                    <div className={hideHeaderOnMobile ? "hidden md:block" : ""}>
                        <Header isAIOpen={isAIOpen} setIsAIOpen={setIsAIOpen} />
                    </div>
                )}

                <div className={`flex-grow w-full min-h-[calc(100vh-140px)] ${showChrome ? "pb-nav-clearance" : ""}`}>
                    {children}
                </div>

                {showChrome && (
                    <>
                        <ServicesWidget isOpen={isServicesOpen} onOpenChange={setIsServicesOpen} />
                        {showFooter && <Footer />}
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
        </AuthModalProvider>
    );
}
