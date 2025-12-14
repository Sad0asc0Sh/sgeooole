"use client";

import Link from "next/link";
import { Search, Sparkles, ShoppingCart, User, Heart } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useState } from "react";
import AIChatSheet from "@/components/features/ai/AIChatSheet";
import MobileSearchOverlay from "@/components/features/search/MobileSearchOverlay";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import DesktopMegaMenu from "./DesktopMegaMenu";
import DesktopSearch from "@/components/features/search/DesktopSearch";
import { useScrollDirection } from "@/hooks/useScrollDirection";

interface HeaderProps {
    isAIOpen: boolean;
    setIsAIOpen: (open: boolean) => void;
}

export default function Header({ isAIOpen, setIsAIOpen }: HeaderProps) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const { user } = useAuth();
    const { itemCount } = useCart();
    const isNavVisible = useScrollDirection({
        topOffset: 50,
        topLockOffset: 120,
        transitionMs: 350,
    });

    const desktopNavLinks = [
        { href: "/", label: "خانه" },
        { href: "/categories", label: "دسته‌بندی‌ها" },
        { href: "/products", label: "محصولات" },
        { href: "/blog", label: "بلاگ" },
        { href: "/about", label: "درباره ما" },
        { href: "/contact", label: "تماس با ما" },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-welf-200 bg-white/80 backdrop-blur-md">
            {/* MOBILE HEADER */}
            <div className="md:hidden mobile-container flex h-16 items-center justify-between">
                {/* Right: Brand Logo */}
                <Link href="/">
                    <Logo />
                </Link>

                {/* Left: Search & AI */}
                <div className="flex items-center gap-2">
                    <div
                        onClick={() => setIsSearchOpen(true)}
                        className="relative cursor-pointer"
                    >
                        <input
                            type="text"
                            readOnly
                            placeholder="جستجو..."
                            className="h-9 w-40 rounded-full bg-welf-50 px-8 text-xs text-welf-900 placeholder:text-welf-500 focus:outline-none cursor-pointer pointer-events-none"
                        />
                        <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-welf-500" />
                    </div>

                    {/* AI Assistant Overlay */}
                    <button
                        onClick={() => setIsAIOpen(true)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-welf-50 text-vita-500 hover:bg-vita-50 transition-colors"
                    >
                        <Sparkles className="h-5 w-5" />
                    </button>

                    <AIChatSheet open={isAIOpen} onOpenChange={setIsAIOpen} />
                    <MobileSearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
                </div>
            </div>

            {/* DESKTOP HEADER */}
            <div className="hidden md:block">
                <div className="container mx-auto">
                    {/* Top Row: Logo - Search - Actions */}
                    <div className="flex items-center justify-between h-20 px-4">
                        {/* Right: Logo */}
                        <Link href="/" className="flex-shrink-0">
                            <Logo />
                        </Link>

                        {/* Center: Expanded Search Bar */}
                        <div className="flex-1 max-w-2xl mx-8">
                            <DesktopSearch />
                        </div>

                        {/* Left: Actions (AI, Profile, Cart) */}
                        <div className="flex items-center gap-4">
                            {/* AI Assistant */}
                            <button
                                onClick={() => setIsAIOpen(true)}
                                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-vita-500 to-vita-600 text-white hover:from-vita-600 hover:to-vita-700 transition-all shadow-md hover:shadow-lg"
                            >
                                <Sparkles className="h-5 w-5" />
                                <span className="text-sm font-medium">دستیار هوشمند</span>
                            </button>

                            {/* Profile */}
                            <Link
                                href="/profile"
                                className={`flex items-center gap-2 h-10 rounded-xl bg-welf-50 text-welf-700 hover:bg-welf-100 transition-colors ${user ? 'w-10 justify-center' : 'px-4'
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
                                className="relative flex items-center gap-2 h-10 px-4 rounded-xl bg-welf-50 text-welf-700 hover:bg-welf-100 transition-colors"
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
                        className={`border-t border-welf-100 transition-all duration-300 ease-in-out overflow-hidden ${isNavVisible
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
                                    className="text-sm font-medium text-welf-700 hover:text-vita-600 transition-colors relative group whitespace-nowrap"
                                >
                                    {link.label}
                                    <span className="absolute bottom-0 right-0 w-0 h-0.5 bg-vita-600 group-hover:w-full transition-all duration-300"></span>
                                </Link>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Shared Components */}
                <AIChatSheet open={isAIOpen} onOpenChange={setIsAIOpen} />
                <MobileSearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
            </div>
        </header>
    );
}
