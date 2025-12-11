"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronDown, Loader2, Package, AlertCircle } from "lucide-react";
import { categoryService, Category } from "@/services/categoryService";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CategoriesContentProps {
    onClose?: () => void;
}

export default function CategoriesContent({ onClose }: CategoriesContentProps) {
    const router = useRouter();
    const [categoryTree, setCategoryTree] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

    // Normalize icon/image coming from API (object or plain string, relative or absolute)
    const resolveCategoryImage = (cat?: Partial<Category> | null) => {
        if (!cat) return null;
        const raw =
            (cat as any)?.icon?.url ||
            (cat as any)?.image?.url ||
            (cat as any)?.icon ||
            (cat as any)?.image;

        if (typeof raw !== "string" || raw.trim() === "") return null;
        const url = raw.trim();

        // If backend returns relative path, prepend API base (same logic as products)
        if (url.startsWith("/")) {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";
            let base = API_URL.replace(/\/api\/?$/, "");
            base = base.replace("localhost", "127.0.0.1");
            return `${base}${url}`;
        }
        return url;
    };

    // Load categories on mount
    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            setLoading(true);
            setError(null);
            const tree = await categoryService.getTree();
            setCategoryTree(tree);

            // Auto-select first category
            if (tree.length > 0) {
                setActiveId(tree[0]._id);
            }
        } catch (err: any) {
            console.error("[CATEGORIES] Error loading categories:", err);
            setError(err.message || "خطا در بارگذاری دسته‌بندی‌ها");
        } finally {
            setLoading(false);
        }
    };

    const activeCategory = categoryTree.find(c => c._id === activeId);

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev =>
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        );
    };

    const handleCategoryChange = (id: string) => {
        setActiveId(id);
        setExpandedGroups([]);
    };

    const handleNavigation = (url: string) => {
        if (onClose) onClose();
        router.push(url);
    };

    // Loading State
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-white">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-vita-500" size={48} />
                    <span className="text-sm text-gray-500">در حال بارگذاری دسته‌بندی‌ها...</span>
                </div>
            </div>
        );
    }

    // Error State
    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-white p-8">
                <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                        <AlertCircle className="text-red-500" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">خطا در بارگذاری</h3>
                    <p className="text-sm text-gray-500">{error}</p>
                    <button
                        onClick={loadCategories}
                        className="mt-2 px-6 py-2 bg-vita-600 text-white text-sm font-bold rounded-xl hover:bg-vita-700 transition-colors"
                    >
                        تلاش مجدد
                    </button>
                </div>
            </div>
        );
    }

    // Empty State
    if (categoryTree.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-white p-8">
                <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                        <Package className="text-gray-300" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">دسته‌بندی موجود نیست</h3>
                    <p className="text-sm text-gray-500">در حال حاضر هیچ دسته‌بندی فعالی وجود ندارد.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-white overflow-hidden">
            {/* --- Right Sidebar (Main Categories) --- */}
            <aside className="w-[28%] bg-gray-50 h-full overflow-y-auto no-scrollbar pb-20 border-l border-gray-100">
                {categoryTree.map((cat) => (
                    <button
                        key={cat._id}
                        onClick={() => handleCategoryChange(cat._id)}
                        className={`
                            w-full flex flex-col items-center justify-center gap-2 py-5 px-2 transition-all duration-300 border-b border-gray-100 relative
                            ${activeId === cat._id
                                ? "bg-white text-vita-600 font-bold"
                                : "text-gray-500 hover:bg-gray-100 font-medium"
                            }
                        `}
                    >
                        {/* Active Indicator Strip */}
                        {activeId === cat._id && (
                            <span className="absolute right-0 top-0 h-full w-1 bg-vita-500 rounded-l-md" />
                        )}

                        {/* Category Icon */}
                        {resolveCategoryImage(cat) ? (
                            <div className="relative w-6 h-6">
                                <Image
                                    src={resolveCategoryImage(cat)!}
                                    alt={cat.name}
                                    fill
                                    className="object-contain"
                                />
                            </div>
                        ) : (
                            <Package
                                size={24}
                                strokeWidth={1.5}
                                className={activeId === cat._id ? "text-vita-500" : "text-gray-400"}
                            />
                        )}

                        <span className="text-[10px] text-center leading-tight">{cat.name}</span>
                    </button>
                ))}
            </aside>

            {/* --- Left Content (Children Categories) --- */}
            <main className="flex-1 h-full overflow-y-auto bg-white p-4 pb-24 no-scrollbar">
                {/* Header */}
                <div className="flex items-center gap-2 mb-6">
                    <span className="text-sm font-bold text-gray-800">
                        {activeCategory?.name}
                    </span>
                    <div className="h-px flex-1 bg-gray-100" />
                    {activeCategory && (
                        <button
                            onClick={() => handleNavigation(`/products?category=${activeCategory.slug}&includeChildren=true`)}
                            className="text-[10px] text-vita-600 flex items-center hover:text-vita-700 transition-colors"
                        >
                            مشاهده همه <ChevronLeft size={12} />
                        </button>
                    )}
                </div>

                {/* Children Categories with Animation */}
                <AnimatePresence mode="wait">
                    {activeCategory ? (
                        <motion.div
                            key={activeId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col gap-3"
                        >
                            {/* If category has children (subcategories) */}
                            {activeCategory.children && activeCategory.children.length > 0 ? (
                                activeCategory.children.map((subCategory) => {
                                    const isExpanded = expandedGroups.includes(subCategory._id);
                                    const hasGrandChildren = subCategory.children && subCategory.children.length > 0;

                                    return (
                                        <div key={subCategory._id} className="border-b border-gray-100 last:border-0 pb-2">
                                            {/* Accordion Header */}
                                            <button
                                                onClick={() => {
                                                    if (hasGrandChildren) {
                                                        toggleGroup(subCategory._id);
                                                    } else {
                                                        handleNavigation(`/products?category=${subCategory.slug}`);
                                                    }
                                                }}
                                                className="w-full flex items-center justify-between py-3 text-gray-700 font-medium text-sm hover:text-vita-600 transition-colors"
                                            >
                                                <span className="flex items-center gap-3">
                                                    {/* Subcategory Image/Icon */}
                                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 overflow-hidden flex-shrink-0">
                                                        {resolveCategoryImage(subCategory) ? (
                                                            <div className="relative w-6 h-6">
                                                                <Image
                                                                    src={resolveCategoryImage(subCategory)!}
                                                                    alt={subCategory.name}
                                                                    fill
                                                                    className="object-contain"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <Package size={20} className="text-gray-300" />
                                                        )}
                                                    </div>
                                                    {subCategory.name}
                                                </span>
                                                {hasGrandChildren ? (
                                                    isExpanded ? <ChevronDown size={16} /> : <ChevronLeft size={16} className="text-gray-400" />
                                                ) : (
                                                    <ChevronLeft size={16} className="text-gray-400" />
                                                )}
                                            </button>

                                            {/* Accordion Content (Grandchildren) */}
                                            {hasGrandChildren && (
                                                <motion.div
                                                    initial={false}
                                                    animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }}
                                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="grid grid-cols-3 gap-4 py-2 pr-2">
                                                        {subCategory.children!.map((item) => (
                                                            <button
                                                                key={item._id}
                                                                onClick={() => handleNavigation(`/products?category=${item.slug}`)}
                                                                className="flex flex-col items-center gap-2 cursor-pointer group w-full"
                                                            >
                                                                <div className="w-14 h-14 bg-gray-50 rounded-full p-2 flex items-center justify-center border border-gray-100 group-hover:border-vita-200 transition-colors overflow-hidden">
                                                                    {resolveCategoryImage(item) ? (
                                                                        <div className="relative w-full h-full">
                                                                            <Image
                                                                                src={resolveCategoryImage(item)!}
                                                                                alt={item.name}
                                                                                fill
                                                                                className="object-cover rounded-full"
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <Package size={24} className="text-gray-300" />
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-center text-gray-600 leading-tight group-hover:text-vita-600 transition-colors">
                                                                    {item.name}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-12 text-gray-400 text-sm">
                                    <Package size={48} className="mx-auto mb-3 text-gray-200" />
                                    <p>این دسته‌بندی زیرمجموعه‌ای ندارد</p>
                                </div>
                            )}
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </main>
        </div>
    );
}
