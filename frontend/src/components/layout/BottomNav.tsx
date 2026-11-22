"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Home, LayoutGrid, ShoppingCart, BookOpen, User } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import CategoriesSheet, { MOBILE_CATEGORY_MENU_ID } from "@/components/features/categories/CategoriesSheet";
import { useCategoryMenu } from "@/components/features/categories/useCategoryMenu";
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
const navItemClass = "flex min-h-11 min-w-11 flex-col items-center justify-center gap-1";

export default function BottomNav({ onNavClick, isServicesOpen }: BottomNavProps) {
    const pathname = usePathname();
    const router = useRouter();
    const menu = useCategoryMenu(pathname);
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
        onNavClick();

        if (pathname === "/" || pathname === "") {
            menu.close();
            getScrollManager().clear("/");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            menu.leaveForLink(e, "/");
            getScrollManager().clear("/");
            window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
            router.push("/");
        }
    };

    const handleNavLink = (event: { preventDefault(): void }, href: string) => {
        menu.leaveForLink(event, href);
        onNavClick();
    };

    const navItems = [
        { href: "/", label: "خانه", icon: Home },
        { href: "/categories", label: "دسته‌بندی", icon: LayoutGrid },
        { href: "/cart", label: "سبد خرید", icon: ShoppingCart },
        { href: "/blog", label: "بلاگ", icon: BookOpen },
        { href: user ? "/profile" : "/login", label: "حساب کاربری", icon: User },
    ];

    const renderNavigation = (inSheet = false) => (
            <nav className={`md:hidden sticky bottom-0 w-full shrink-0 bg-white/95 backdrop-blur-lg border-t border-ekg-200/60 pb-safe-area z-bottom-nav transition-transform duration-300 ease-in-out shadow-[0_-2px_8px_rgba(0,0,0,0.04)] ${isServicesOpen && !inSheet ? 'translate-y-full' : 'translate-y-0'}`}>
                <div className="flex justify-between items-center px-4 h-[var(--bottom-nav-height)]">
                    {navItems.map((item) => {
                        const isCat = item.href === "/categories";
                        const isHome = item.href === "/";
                        const isCart = item.href === "/cart";

                        const isActive = inSheet ? isCat : pathname === item.href;

                        if (isCat) {
                            return (
                                <button
                                    key={item.href}
                                    type="button"
                                    aria-haspopup="dialog"
                                    aria-expanded={menu.isOpen}
                                    aria-controls={menu.isOpen ? MOBILE_CATEGORY_MENU_ID : undefined}
                                    onClick={(event) => {
                                        if (inSheet) {
                                            menu.close();
                                        } else {
                                            event.currentTarget.focus({ preventScroll: true });
                                            menu.open();
                                        }
                                        onNavClick();
                                    }}
                                    className={`${navItemClass} ${isActive ? "text-kala-600" : "text-ekg-500"}`}
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
                                    className={`${navItemClass} ${isActive ? "text-kala-600" : "text-ekg-500"}`}
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
                                    onNavigate={(event) => handleNavLink(event, item.href)}
                                    className={`relative ${navItemClass} transition-colors duration-200 ${isActive ? "text-kala-600" : hasCartItems ? "text-ekg-700" : "text-ekg-500"}`}
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
                                onNavigate={(event) => handleNavLink(event, item.href)}
                                className={`${navItemClass} ${isActive ? "text-kala-600" : "text-ekg-500"}`}
                            >
                                <item.icon size={20} />
                                <span className="text-[10px] font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
    );

    return (
        <>
            {renderNavigation()}
            <AnimatePresence>
                {menu.isOpen && (
                    <CategoriesSheet onClose={menu.close} onNavigate={menu.leaveForLink} navigation={renderNavigation(true)} />
                )}
            </AnimatePresence>
        </>
    );
}
