"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Sparkles, ShoppingCart, User } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useEffect, useState } from "react";
import AIChatSheet from "@/components/features/ai/AIChatSheet";
import MobileSearchOverlay from "@/components/features/search/MobileSearchOverlay";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import DesktopMegaMenu from "./DesktopMegaMenu";
import DesktopSearch from "@/components/features/search/DesktopSearch";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { getScrollManager } from "@/lib/scroll/ScrollManager";

interface HeaderProps {
    isAIOpen: boolean;
    setIsAIOpen: (open: boolean) => void;
}

export default function Header({ isAIOpen, setIsAIOpen }: HeaderProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const { user } = useAuth();
    const { itemCount } = useCart();
    const isNavVisible = useScrollDirection({
        topOffset: 50,
        topLockOffset: 120,
        minSwitchDistance: 20,
        transitionMs: 350,
    });
    const [spacerReady, setSpacerReady] = useState(false);

    const handleHomeClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (pathname === "/" || pathname === "") {
            getScrollManager().clear("/");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            getScrollManager().clear("/");
            window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
            router.push("/");
        }
    };

    useEffect(() => {
        const id = requestAnimationFrame(() => setSpacerReady(true));
        return () => cancelAnimationFrame(id);
    }, []);

    useEffect(() => {
        document.documentElement.style.setProperty(
            '--header-height',
            isNavVisible ? '136px' : '80px'
        );
    }, [isNavVisible]);

    const desktopNavLinks = [
        { href: "/", label: "خانه" },
        { href: "/categories", label: "دسته‌بندی‌ها" },
        { href: "/products", label: "محصولات" },
        { href: "/blog", label: "بلاگ" },
        { href: "/about", label: "درباره ما" },
        { href: "/contact", label: "تماس با ما" },
    ];

    return (
        <>
            {/* Spacer: keeps layout stable when header is fixed (and animates with nav collapse/expand) */}
            <div
                aria-hidden
                className={`h-16 ${spacerReady ? "transition-[height] duration-300 ease-in-out" : ""} ${isNavVisible ? "md:h-[136px]" : "md:h-20"}`}
            />

            <header className="fixed inset-x-0 top-0 z-50 w-full border-b border-ekg-200 bg-white bg-white/80 backdrop-blur-md supports-[backdrop-filter:blur(12px)]:bg-white/80">
            {/* MOBILE HEADER */}
            <div className="md:hidden mobile-container flex h-16 items-center gap-3">
                {/* Right: Brand Logo */}
                <Link href="/" onClick={handleHomeClick} className="shrink-0">
                    <Logo />
                </Link>

                {/* Left: Search & AI */}
                <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
                    <div
                        onClick={() => setIsSearchOpen(true)}
                        className="relative flex-1 min-w-0 cursor-pointer"
                    >
                        <input
                            type="text"
                            readOnly
                            placeholder="جستجو..."
                            className="h-9 w-full min-w-0 rounded-full bg-ekg-50 px-8 text-xs text-ekg-900 placeholder:text-ekg-500 focus:outline-none cursor-pointer pointer-events-none"
                        />
                        <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-ekg-500" />
                    </div>

                    {/* AI Assistant Overlay */}
                    <button
                        onClick={() => setIsAIOpen(true)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ekg-50 text-kala-500 hover:bg-kala-50 transition-colors"
                    >
                        <Sparkles className="h-5 w-5" />
                    </button>

                </div>
            </div>

            {/* DESKTOP HEADER */}
            <div className="hidden md:block">
                <div className="w-full max-w-[1440px] mx-auto">
                    {/* Top Row: Logo - Search - Actions */}
                    <div className="flex items-center h-20 gap-4 px-4 lg:px-6">
                        {/* Right: Logo */}
                        <Link href="/" onClick={handleHomeClick} className="flex-shrink-0 flex items-center">
                            <Logo />
                        </Link>

                        {/* Center: Expanded Search Bar */}
                        <div className="flex-1 min-w-0">
                            <DesktopSearch />
                        </div>

                        {/* Left: Actions (AI, Profile, Cart) */}
                        <div className="flex items-center gap-4">
                            {/* AI Assistant */}
                            <button
                                onClick={() => setIsAIOpen(true)}
                                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-kala-500 to-kala-600 text-white hover:from-kala-600 hover:to-kala-700 transition-all shadow-md hover:shadow-lg"
                            >
                                <Sparkles className="h-5 w-5" />
                                <span className="text-sm font-medium">دستیار هوشمند</span>
                            </button>

                            {/* Profile */}
                            <Link
                                href={user ? "/profile" : "/login"}
                                className={`flex items-center gap-2 h-10 rounded-xl bg-ekg-50 text-ekg-700 hover:bg-ekg-100 transition-colors ${user ? 'w-10 justify-center' : 'px-4'
                                    }`}
                            >
                                <User className="h-5 w-5" />
                                {!user && (
                                    <span className="text-sm font-medium">
                                        ورود/ثبت نام
                                    </span>
                                )}
                            </Link>

                            {/* Cart */}
                            <Link
                                href="/cart"
                                className="relative flex items-center gap-2 h-10 px-4 rounded-xl bg-ekg-50 text-ekg-700 hover:bg-ekg-100 transition-colors"
                            >
                                <ShoppingCart className="h-5 w-5" />
                                <span className="text-sm font-medium">سبد خرید</span>
                                {itemCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                        {itemCount}
                                    </span>
                                )}
                            </Link>
                        </div>
                    </div>

                    {/* Bottom Row: Navigation Links */}
                    <div
                        className={`border-t border-ekg-100 transition-all duration-300 ease-in-out overflow-hidden ${isNavVisible
                            ? 'max-h-14 opacity-100'
                            : 'max-h-0 opacity-0'
                            }`}
                    >
                        <nav className="flex items-center gap-8 h-14 px-4">
                            <DesktopMegaMenu />
                            {desktopNavLinks.filter(link => link.href !== "/categories").map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={link.href === "/" ? handleHomeClick : undefined}
                                    className="text-sm font-medium text-ekg-700 hover:text-kala-600 transition-colors relative group whitespace-nowrap"
                                >
                                    {link.label}
                                    <span className="absolute bottom-0 right-0 w-0 h-0.5 bg-kala-600 group-hover:w-full transition-all duration-300"></span>
                                </Link>
                            ))}
                        </nav>
                    </div>
                </div>

            </div>
        </header>

            <AIChatSheet open={isAIOpen} onOpenChange={setIsAIOpen} />
            <MobileSearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}
