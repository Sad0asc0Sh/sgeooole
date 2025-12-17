"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Menu, Loader2, Grid3X3 } from "lucide-react";
import { categoryService, Category } from "@/services/categoryService";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/hooks/useScrollLock";

// Helper to extract icon URL from category
const getIconUrl = (category: Category): string | null => {
    if (!category.icon) return null;
    if (typeof category.icon === 'string') return category.icon;
    if (typeof category.icon === 'object' && 'url' in category.icon) {
        return (category.icon as { url: string }).url;
    }
    return null;
};

// Category Icon Component with fallback
const CategoryIcon = ({
    category,
    size = 24,
    className = ""
}: {
    category: Category;
    size?: number;
    className?: string;
}) => {
    const iconUrl = getIconUrl(category);
    const [hasError, setHasError] = useState(false);

    if (!iconUrl || hasError) {
        // Fallback: Beautiful gradient icon with first letter
        const colors = [
            'from-vita-500 to-vita-600',
            'from-emerald-500 to-emerald-600',
            'from-amber-500 to-amber-600',
            'from-purple-500 to-purple-600',
            'from-rose-500 to-rose-600',
            'from-cyan-500 to-cyan-600',
            'from-indigo-500 to-indigo-600',
            'from-orange-500 to-orange-600',
        ];
        // Use category name hash to pick color
        const colorIndex = category.name.charCodeAt(0) % colors.length;
        const firstLetter = category.name.charAt(0);

        return (
            <div
                className={cn(
                    `flex items-center justify-center rounded-lg bg-gradient-to-br text-white font-bold shadow-sm`,
                    colors[colorIndex],
                    className
                )}
                style={{ width: size, height: size, fontSize: size * 0.5 }}
            >
                {firstLetter}
            </div>
        );
    }

    return (
        <div
            className={cn("relative overflow-hidden rounded-lg bg-slate-100 flex-shrink-0", className)}
            style={{ width: size, height: size }}
        >
            <Image
                src={iconUrl}
                alt={category.name}
                fill
                className="object-contain p-0.5"
                sizes={`${size}px`}
                onError={() => setHasError(true)}
            />
        </div>
    );
};

export default function DesktopMegaMenu() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeCategory, setActiveCategory] = useState<Category | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [overlayPosition, setOverlayPosition] = useState<{ top: number; left: number; width: number } | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const triggerRef = useRef<HTMLDivElement | null>(null);
    const { lock, unlock } = useScrollLock();

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const data = await categoryService.getTree();
                setCategories(data);
                if (data.length > 0) {
                    setActiveCategory(data[0]);
                }
            } catch (error) {
                console.error("Failed to fetch categories:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCategories();
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        if (typeof window === "undefined") return;

        const updatePosition = () => {
            const triggerEl = triggerRef.current;
            if (!triggerEl) return;

            const rect = triggerEl.getBoundingClientRect();
            const viewportPadding = 16;
            const maxWidth = 800;
            const gap = 8;

            const width = Math.min(maxWidth, Math.max(0, window.innerWidth - viewportPadding * 2));
            let left = rect.right - width;
            left = Math.max(viewportPadding, Math.min(left, window.innerWidth - width - viewportPadding));

            const top = rect.bottom + gap;
            setOverlayPosition({ top, left, width });
        };

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);

        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [isOpen]);

    const handleMouseEnter = () => {
        lock();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (!isOpen) {
            const triggerEl = triggerRef.current;
            if (triggerEl && typeof window !== "undefined") {
                const rect = triggerEl.getBoundingClientRect();
                const viewportPadding = 16;
                const maxWidth = 800;
                const gap = 8;

                const width = Math.min(maxWidth, Math.max(0, window.innerWidth - viewportPadding * 2));
                let left = rect.right - width;
                left = Math.max(viewportPadding, Math.min(left, window.innerWidth - width - viewportPadding));

                const top = rect.bottom + gap;
                setOverlayPosition({ top, left, width });
            }
        }
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
            unlock();
        }, 200); // Small delay for better UX
    };

    const handleCategoryHover = (category: Category) => {
        setActiveCategory(category);
    };

    return (
        <div className="relative">
            {/* Trigger Button */}
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="flex items-center gap-2 cursor-pointer py-2 px-2 text-slate-800 hover:text-vita-600 transition-colors"
            >
                <Menu className="w-6 h-6" />
                <span className="font-bold text-sm">دسته‌بندی کالاها</span>
            </div>

            {/* Mega Menu Overlay - Compact like Digikala */}
            {isOpen && overlayPosition && typeof document !== "undefined" && createPortal(
                <div
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    style={{
                        top: overlayPosition.top,
                        left: overlayPosition.left,
                        width: overlayPosition.width,
                    }}
                    className="fixed bg-white shadow-xl rounded-lg border border-slate-200 z-[40] flex max-h-[420px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >

                    {isLoading ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-vita-500" />
                        </div>
                    ) : (
                        <>
                            {/* Right Sidebar: Parent Categories with Icons */}
                            <div className="w-56 flex-shrink-0 border-l border-slate-100 overflow-y-auto bg-slate-50/80 custom-scrollbar">
                                <div className="py-2 px-2">
                                    {categories.map((category) => (
                                        <div
                                            key={category._id}
                                            onMouseEnter={() => handleCategoryHover(category)}
                                            className={cn(
                                                "flex items-center gap-2.5 px-2.5 py-2.5 cursor-pointer transition-all duration-150 rounded-lg mb-0.5 group",
                                                activeCategory?._id === category._id
                                                    ? "bg-white text-vita-700 shadow-sm border border-slate-200"
                                                    : "text-slate-600 hover:bg-white/60 hover:text-slate-900 border border-transparent"
                                            )}
                                        >
                                            {/* Category Icon */}
                                            <CategoryIcon
                                                category={category}
                                                size={28}
                                                className="transition-transform duration-150"
                                            />

                                            {/* Category Name */}
                                            <span className="font-medium text-xs flex-1 leading-snug">
                                                {category.name}
                                            </span>

                                            {/* Arrow indicator */}
                                            <ChevronLeft
                                                className={cn(
                                                    "w-4 h-4 transition-all duration-200",
                                                    activeCategory?._id === category._id
                                                        ? "text-vita-500 translate-x-1"
                                                        : "text-slate-300 group-hover:text-slate-500"
                                                )}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Left Content: Subcategories with Icons */}
                            <div className="flex-1 overflow-y-auto p-4 bg-white custom-scrollbar">
                                {activeCategory && (
                                    <div className="animate-in fade-in duration-200">
                                        {/* Header with Icon */}
                                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                                            <CategoryIcon category={activeCategory} size={32} />
                                            <div className="flex-1">
                                                <Link
                                                    href={`/products?category=${activeCategory.slug}&includeChildren=true`}
                                                    className="text-sm font-bold text-slate-800 hover:text-vita-600 transition-colors flex items-center gap-1"
                                                >
                                                    همه محصولات {activeCategory.name}
                                                    <ChevronLeft className="w-3.5 h-3.5" />
                                                </Link>
                                            </div>
                                        </div>

                                        {/* Subcategories Grid */}
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                            {activeCategory.children?.map((subCategory) => (
                                                <div
                                                    key={subCategory._id}
                                                    className="group/sub"
                                                >
                                                    {/* Subcategory Header with Icon or Gold Line */}
                                                    <Link
                                                        href={`/products?category=${subCategory.slug}&includeChildren=true`}
                                                        className="flex items-center gap-2 mb-2 group/link"
                                                    >
                                                        {getIconUrl(subCategory) ? (
                                                            <CategoryIcon
                                                                category={subCategory}
                                                                size={22}
                                                                className="transition-transform group-hover/link:scale-105"
                                                            />
                                                        ) : (
                                                            /* Golden vertical line fallback */
                                                            <span className="w-0.5 h-5 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 flex-shrink-0" />
                                                        )}
                                                        <span className="font-bold text-xs text-slate-700 group-hover/link:text-vita-600 transition-colors">
                                                            {subCategory.name}
                                                        </span>
                                                    </Link>

                                                    {/* Child categories */}
                                                    {subCategory.children && subCategory.children.length > 0 && (
                                                        <ul className="space-y-1 pr-1.5 border-r border-slate-200">
                                                            {subCategory.children.slice(0, 4).map((child) => (
                                                                <li key={child._id}>
                                                                    <Link
                                                                        href={`/products?category=${child.slug}&includeChildren=true`}
                                                                        className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-vita-500 transition-colors py-0.5 group/child"
                                                                    >
                                                                        {getIconUrl(child) ? (
                                                                            <CategoryIcon
                                                                                category={child}
                                                                                size={14}
                                                                                className="transition-transform group-hover/child:scale-105"
                                                                            />
                                                                        ) : (
                                                                            <span className="w-1 h-1 rounded-full bg-slate-300 group-hover/child:bg-vita-400 transition-colors" />
                                                                        )}
                                                                        <span>{child.name}</span>
                                                                    </Link>
                                                                </li>
                                                            ))}
                                                            {subCategory.children.length > 4 && (
                                                                <li>
                                                                    <Link
                                                                        href={`/products?category=${subCategory.slug}&includeChildren=true`}
                                                                        className="flex items-center gap-1 text-[10px] text-vita-500 hover:text-vita-600 transition-colors py-0.5 font-medium"
                                                                    >
                                                                        <span>+{subCategory.children.length - 4} دسته دیگر</span>
                                                                    </Link>
                                                                </li>
                                                            )}
                                                        </ul>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Empty State */}
                                        {(!activeCategory.children || activeCategory.children.length === 0) && (
                                            <div className="text-center py-8">
                                                <Grid3X3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                                <p className="text-slate-400 text-xs">
                                                    زیردسته‌ای برای این دسته‌بندی تعریف نشده است
                                                </p>
                                                <Link
                                                    href={`/products?category=${activeCategory.slug}&includeChildren=true`}
                                                    className="inline-flex items-center gap-1 mt-3 text-vita-500 text-sm font-medium hover:text-vita-600 transition-colors"
                                                >
                                                    مشاهده محصولات
                                                    <ChevronLeft className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
