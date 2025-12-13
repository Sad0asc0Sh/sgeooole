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
    // Hide layout on /login, /product/*, and /profile sub-pages (but SHOW on main /profile)
    const shouldHideLayout = (pathname?.startsWith("/profile/") && pathname !== "/profile") || pathname?.startsWith("/login") || pathname?.startsWith("/product/");
    const [isAIOpen, setIsAIOpen] = useState(false);
    const [isServicesOpen, setIsServicesOpen] = useState(false);

    return (
        <main className="min-h-screen flex flex-col">
            {!shouldHideLayout && <Header isAIOpen={isAIOpen} setIsAIOpen={setIsAIOpen} />}
            <div className={`flex-grow ${!shouldHideLayout ? "pb-32" : ""}`}>{children}</div>
            {!shouldHideLayout && <ServicesWidget isOpen={isServicesOpen} onOpenChange={setIsServicesOpen} />}
            {!shouldHideLayout && <Footer />}
            {!shouldHideLayout && <BottomNav
                isServicesOpen={isServicesOpen}
                onNavClick={() => {
                    // Delay closing to allow navigation to happen behind the sheet
                    setTimeout(() => setIsAIOpen(false), 500);
                }}
            />}
        </main>
    );
}
