"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Menu, Loader2, Grid3X3 } from "lucide-react";
import { categoryService, Category } from "@/services/categoryService";
import { cn } from "@/lib/utils";

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
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 200); // Small delay for better UX
    };

    const handleCategoryHover = (category: Category) => {
        setActiveCategory(category);
    };

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Trigger Button */}
            <div className="flex items-center gap-2 cursor-pointer py-2 px-2 text-slate-800 hover:text-vita-600 transition-colors">
                <Menu className="w-6 h-6" />
                <span className="font-bold text-sm">دسته‌بندی کالاها</span>
            </div>

            {/* Mega Menu Overlay */}
            {isOpen && (
                <div className="absolute top-full right-0 w-[90vw] max-w-[1200px] bg-white/95 backdrop-blur-lg shadow-2xl rounded-br-xl rounded-bl-xl border border-slate-200/50 z-50 flex h-[520px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">

                    {isLoading ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-vita-500" />
                        </div>
                    ) : (
                        <>
                            {/* Right Sidebar: Parent Categories with Icons */}
                            <div className="w-72 flex-shrink-0 border-l border-slate-100 overflow-y-auto bg-gradient-to-b from-slate-50/80 to-white custom-scrollbar">
                                <div className="p-3">
                                    {categories.map((category) => (
                                        <div
                                            key={category._id}
                                            onMouseEnter={() => handleCategoryHover(category)}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-3 cursor-pointer transition-all duration-200 rounded-xl mb-1 group",
                                                activeCategory?._id === category._id
                                                    ? "bg-vita-50 text-vita-700 shadow-sm border border-vita-100"
                                                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent"
                                            )}
                                        >
                                            {/* Category Icon */}
                                            <CategoryIcon
                                                category={category}
                                                size={36}
                                                className={cn(
                                                    "transition-transform duration-200",
                                                    activeCategory?._id === category._id && "scale-110"
                                                )}
                                            />

                                            {/* Category Name */}
                                            <span className="font-medium text-sm flex-1 leading-tight">
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
                            <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                                {activeCategory && (
                                    <div className="animate-in fade-in duration-300">
                                        {/* Header with Icon */}
                                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                                            <CategoryIcon category={activeCategory} size={40} />
                                            <div className="flex-1">
                                                <Link
                                                    href={`/products?category=${activeCategory.slug}&includeChildren=true`}
                                                    className="text-base font-bold text-slate-800 hover:text-vita-600 transition-colors flex items-center gap-1"
                                                >
                                                    {activeCategory.name}
                                                    <ChevronLeft className="w-4 h-4" />
                                                </Link>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    مشاهده همه محصولات این دسته‌بندی
                                                </p>
                                            </div>
                                        </div>

                                        {/* Subcategories Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {activeCategory.children?.map((subCategory) => (
                                                <div
                                                    key={subCategory._id}
                                                    className="group/sub bg-slate-50/50 rounded-xl p-4 hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                                                >
                                                    {/* Subcategory Header with Icon or Gold Line */}
                                                    <Link
                                                        href={`/products?category=${subCategory.slug}&includeChildren=true`}
                                                        className="flex items-center gap-2.5 mb-3 group/link"
                                                    >
                                                        {getIconUrl(subCategory) ? (
                                                            <CategoryIcon
                                                                category={subCategory}
                                                                size={28}
                                                                className="transition-transform group-hover/link:scale-110"
                                                            />
                                                        ) : (
                                                            /* Golden vertical line fallback */
                                                            <span className="w-1 h-6 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 shadow-sm flex-shrink-0" />
                                                        )}
                                                        <span className="font-bold text-sm text-slate-800 group-hover/link:text-vita-600 transition-colors">
                                                            {subCategory.name}
                                                        </span>
                                                    </Link>

                                                    {/* Child categories */}
                                                    {subCategory.children && subCategory.children.length > 0 && (
                                                        <ul className="space-y-1.5 pr-2 border-r-2 border-slate-200">
                                                            {subCategory.children.slice(0, 6).map((child) => (
                                                                <li key={child._id}>
                                                                    <Link
                                                                        href={`/products?category=${child.slug}&includeChildren=true`}
                                                                        className="flex items-center gap-2 text-xs text-slate-500 hover:text-vita-500 transition-colors py-1 group/child"
                                                                    >
                                                                        {getIconUrl(child) ? (
                                                                            <CategoryIcon
                                                                                category={child}
                                                                                size={18}
                                                                                className="transition-transform group-hover/child:scale-110"
                                                                            />
                                                                        ) : (
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/child:bg-vita-400 transition-colors" />
                                                                        )}
                                                                        <span>{child.name}</span>
                                                                    </Link>
                                                                </li>
                                                            ))}
                                                            {subCategory.children.length > 6 && (
                                                                <li>
                                                                    <Link
                                                                        href={`/products?category=${subCategory.slug}&includeChildren=true`}
                                                                        className="flex items-center gap-2 text-xs text-vita-500 hover:text-vita-600 transition-colors py-1 font-medium"
                                                                    >
                                                                        <Grid3X3 className="w-3 h-3" />
                                                                        <span>+{subCategory.children.length - 6} دسته دیگر</span>
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
                                            <div className="text-center py-12">
                                                <Grid3X3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                                <p className="text-slate-400 text-sm">
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
                </div>
            )}
        </div>
    );
}
