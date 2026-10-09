"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Home, LayoutGrid, ShoppingCart, BookOpen, User } from "lucide-react";
import CategoriesSheet from "@/components/features/categories/CategoriesSheet";
import { useAuth } from "@/hooks/useAuth";
import { getScrollManager } from "@/lib/scroll/ScrollManager";

interface BottomNavProps {
    onNavClick: () => void;
    isServicesOpen: boolean;
}

export default function BottomNav({ onNavClick, isServicesOpen }: BottomNavProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
    const { user } = useAuth();

    // Hide BottomNav on Product Detail Page
    if (pathname.startsWith("/product/")) return null;

    const handleHomeClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsCategoriesOpen(false);
        onNavClick();

        if (pathname === "/" || pathname === "") {
            getScrollManager().clear("/");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            getScrollManager().clear("/");
            window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
            router.push("/");
        }
    };

    const navItems = [
        { href: "/", label: "خانه", icon: Home },
        { href: "/categories", label: "دسته‌بندی", icon: LayoutGrid },
        { href: "/cart", label: "سبد خرید", icon: ShoppingCart },
        { href: "/blog", label: "بلاگ", icon: BookOpen },
        { href: user ? "/profile" : "/login", label: "حساب کاربری", icon: User },
    ];

    return (
        <>
            <nav className={`md:hidden fixed inset-x-0 bottom-0 w-full bg-white/95 backdrop-blur-lg border-t border-ekg-200/60 pb-safe-area z-bottom-nav transition-transform duration-300 ease-in-out shadow-[0_-2px_8px_rgba(0,0,0,0.04)] ${isServicesOpen ? 'translate-y-full' : 'translate-y-0'}`}>
                <div className="flex justify-between items-center px-4 h-[var(--bottom-nav-height)]">
                    {navItems.map((item) => {
                        const isCat = item.href === "/categories";
                        const isHome = item.href === "/";

                        // Active State Logic
                        let isActive = false;
                        if (isCategoriesOpen) {
                            isActive = isCat;
                        } else {
                            isActive = pathname === item.href;
                        }

                        if (isCat) {
                            return (
                                <button
                                    key={item.href}
                                    type="button"
                                    onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
                                    className={`flex flex-col items-center gap-1 ${isActive ? "text-kala-600" : "text-ekg-500"}`}
                                >
                                    <item.icon size={20} />
                                    <span className="text-[10px] font-medium">{item.label}</span>
                                </button>
                            );
                        }

                        if (isHome) {
                            return (
                                <button
                                    key={item.href}
                                    type="button"
                                    onClick={handleHomeClick}
                                    className={`flex flex-col items-center gap-1 ${isActive ? "text-kala-600" : "text-ekg-500"}`}
                                >
                                    <item.icon size={20} />
                                    <span className="text-[10px] font-medium">{item.label}</span>
                                </button>
                            );
                        }

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => {
                                    setTimeout(() => setIsCategoriesOpen(false), 500);
                                    onNavClick();
                                }}
                                className={`flex flex-col items-center gap-1 ${isActive ? "text-kala-600" : "text-ekg-500"}`}
                            >
                                <item.icon size={20} />
                                <span className="text-[10px] font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
            <CategoriesSheet isOpen={isCategoriesOpen} onClose={() => setIsCategoriesOpen(false)} />
        </>
    );
}
