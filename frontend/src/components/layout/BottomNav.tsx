"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Home, LayoutGrid, ShoppingCart, BookOpen, User } from "lucide-react";
import CategoriesSheet from "@/components/features/categories/CategoriesSheet";
import { useAuth } from "@/hooks/useAuth";
import { useCartStore } from "@/store/cartStore";
import { getScrollManager } from "@/lib/scroll/ScrollManager";
import styles from "./BottomNav.module.css";

interface BottomNavProps {
    onNavClick: () => void;
    isServicesOpen: boolean;
}

/** Keep in sync with the .bump animation length in BottomNav.module.css. */
const CART_BUMP_MS = 620;

export default function BottomNav({ onNavClick, isServicesOpen }: BottomNavProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
    const { user } = useAuth();

    // Total units in the cart. A primitive selector means the nav re-renders only
    // when that number changes — unlike useCart(), which ticks every second for
    // countdown re-pricing and would repaint this bar once a second.
    const cartCount = useCartStore((state) =>
        state.cartItems.reduce((total, item) => total + (Number(item.qty) || 0), 0),
    );
    const cartInitialized = useCartStore((state) => state.initialized);
    const hasCartItems = cartCount > 0;

    // Feedback for "a product just landed in the cart": the cart fills up (solid
    // glyph + count badge) and plays a short spring + halo. The first settled
    // count after hydration is recorded silently so a page load with a full cart
    // never looks like a fresh add.
    const [isCartBumping, setIsCartBumping] = useState(false);
    const previousCartCount = useRef<number | null>(null);

    useEffect(() => {
        if (!cartInitialized) return;

        const previous = previousCartCount.current;
        previousCartCount.current = cartCount;
        if (previous === null || cartCount <= previous) return;

        setIsCartBumping(true);
        const timer = window.setTimeout(() => setIsCartBumping(false), CART_BUMP_MS);
        return () => window.clearTimeout(timer);
    }, [cartCount, cartInitialized]);

    const cartAriaLabel = hasCartItems
        ? `سبد خرید، ${cartCount.toLocaleString("fa-IR")} کالا`
        : "سبد خرید";

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
            <nav className={`md:hidden sticky bottom-0 w-full shrink-0 bg-white/95 backdrop-blur-lg border-t border-ekg-200/60 pb-safe-area z-bottom-nav transition-transform duration-300 ease-in-out shadow-[0_-2px_8px_rgba(0,0,0,0.04)] ${isServicesOpen ? 'translate-y-full' : 'translate-y-0'}`}>
                <div className="flex justify-between items-center px-4 h-[var(--bottom-nav-height)]">
                    {navItems.map((item) => {
                        const isCat = item.href === "/categories";
                        const isHome = item.href === "/";
                        const isCart = item.href === "/cart";

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

                        if (isCart) {
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-label={cartAriaLabel}
                                    onClick={() => {
                                        setTimeout(() => setIsCategoriesOpen(false), 500);
                                        onNavClick();
                                    }}
                                    className={`relative flex flex-col items-center gap-1 transition-colors duration-200 ${isActive ? "text-kala-600" : hasCartItems ? "text-ekg-700" : "text-ekg-500"}`}
                                >
                                    <span className={`relative flex h-5 w-5 items-center justify-center ${styles.cartIcon} ${isCartBumping ? styles.bump : ""}`}>
                                        {/* Filled glyph once the cart holds something; outline while empty. */}
                                        <ShoppingCart
                                            size={20}
                                            fill={hasCartItems ? "currentColor" : "none"}
                                            strokeWidth={hasCartItems ? 1.75 : 2}
                                            aria-hidden
                                        />
                                        {hasCartItems && (
                                            <span
                                                className={`absolute -right-2.5 -top-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-kala-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white tabular-nums ${isCartBumping ? styles.badgeBump : ""}`}
                                            >
                                                {cartCount > 99 ? "۹۹+" : cartCount.toLocaleString("fa-IR")}
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-[10px] font-medium">{item.label}</span>
                                </Link>
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
