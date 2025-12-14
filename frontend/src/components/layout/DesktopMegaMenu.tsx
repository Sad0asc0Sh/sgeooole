"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, Menu, Loader2 } from "lucide-react";
import { categoryService, Category } from "@/services/categoryService";
import { cn } from "@/lib/utils";

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
                <div className="absolute top-full right-0 w-[90vw] max-w-[1200px] bg-white/80 backdrop-blur-md shadow-xl rounded-br-lg rounded-bl-lg border border-slate-100 z-50 flex h-[500px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">

                    {isLoading ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-vita-500" />
                        </div>
                    ) : (
                        <>
                            {/* Right Sidebar: Parent Categories */}
                            <div className="w-64 flex-shrink-0 border-l border-slate-100 overflow-y-auto bg-slate-50/50 custom-scrollbar">
                                {categories.map((category) => (
                                    <div
                                        key={category._id}
                                        onMouseEnter={() => handleCategoryHover(category)}
                                        className={cn(
                                            "flex items-center justify-between px-4 py-3.5 cursor-pointer transition-all duration-200 text-sm font-medium",
                                            activeCategory?._id === category._id
                                                ? "bg-white/60 text-vita-600 border-r-4 border-vita-600 shadow-sm"
                                                : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900 border-r-4 border-transparent"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Icon Placeholder - In a real app, use category.icon.url */}
                                            {/* <div className="w-5 h-5 bg-slate-200 rounded-full" /> */}
                                            <span>{category.name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Left Content: Subcategories */}
                            <div className="flex-1 overflow-y-auto p-6 bg-transparent custom-scrollbar">
                                {activeCategory && (
                                    <div className="animate-in fade-in duration-300">
                                        <div className="flex items-center gap-2 mb-6 text-slate-800">
                                            <Link
                                                href={`/search/category-${activeCategory.slug}`}
                                                className="text-sm font-bold hover:text-vita-600 flex items-center gap-1"
                                            >
                                                همه محصولات {activeCategory.name}
                                                <ChevronLeft className="w-4 h-4" />
                                            </Link>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
                                            {activeCategory.children?.map((subCategory) => (
                                                <div key={subCategory._id} className="break-inside-avoid">
                                                    <Link
                                                        href={`/search/category-${subCategory.slug}`}
                                                        className="block text-sm font-bold text-slate-800 mb-3 border-r-2 border-vita-500 pr-2 hover:text-vita-600 transition-colors"
                                                    >
                                                        {subCategory.name}
                                                    </Link>

                                                    {subCategory.children && subCategory.children.length > 0 && (
                                                        <ul className="space-y-2 pr-2">
                                                            {subCategory.children.map((child) => (
                                                                <li key={child._id}>
                                                                    <Link
                                                                        href={`/search/category-${child.slug}`}
                                                                        className="text-xs text-slate-500 hover:text-vita-500 transition-colors block py-0.5"
                                                                    >
                                                                        {child.name}
                                                                    </Link>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
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
