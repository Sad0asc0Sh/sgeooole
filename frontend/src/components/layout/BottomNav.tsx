"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, LayoutGrid, ShoppingCart, BookOpen, User } from "lucide-react";
import CategoriesSheet from "@/components/features/categories/CategoriesSheet";

export default function BottomNav() {
    const pathname = usePathname();
    const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);

    const navItems = [
        { href: "/", label: "خانه", icon: Home },
        { href: "/categories", label: "دسته‌بندی", icon: LayoutGrid },
        { href: "/cart", label: "سبد خرید", icon: ShoppingCart },
        { href: "/blog", label: "بلاگ", icon: BookOpen },
        { href: "/profile", label: "حساب کاربری", icon: User },
    ];

    return (
        <>
            <nav className="fixed bottom-0 w-full bg-white border-t border-welf-200 pb-safe-area z-50">
                <div className="flex justify-between items-center px-4 h-16">
                    {navItems.map((item) => {
                        const isCat = item.href === "/categories";

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
                                    onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
                                    className={`flex flex-col items-center gap-1 ${isActive ? "text-vita-600" : "text-welf-500"}`}
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
                                onClick={() => setIsCategoriesOpen(false)}
                                className={`flex flex-col items-center gap-1 ${isActive ? "text-vita-600" : "text-welf-500"}`}
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
