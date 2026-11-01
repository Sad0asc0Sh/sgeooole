"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, Clock, ChevronLeft, Loader2, History, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useScrollLock } from "@/hooks/useScrollLock";
import { productService, Product } from "@/services/productService";
import { categoryService, Category } from "@/services/categoryService";
import { cn } from "@/lib/utils";
import { buildProductUrl } from "@/lib/paths";

export default function DesktopSearch() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [matchedCategories, setMatchedCategories] = useState<Category[]>([]);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const categoryScrollRef = useRef<HTMLDivElement>(null);

    // Drag to scroll state
    const [isDragging, setIsDragging] = useState(false);
    const [isMouseDown, setIsMouseDown] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!categoryScrollRef.current) return;
        setIsMouseDown(true);
        setStartX(e.pageX - categoryScrollRef.current.offsetLeft);
        setScrollLeft(categoryScrollRef.current.scrollLeft);
    };

    const handleMouseLeave = () => {
        setIsMouseDown(false);
        setIsDragging(false);
    };

    const handleMouseUp = () => {
        setIsMouseDown(false);
        // Delay resetting isDragging so onClick can detect it
        setTimeout(() => setIsDragging(false), 50);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isMouseDown || !categoryScrollRef.current) return;
        e.preventDefault();

        const x = e.pageX - categoryScrollRef.current.offsetLeft;
        // Only consider it a drag if moved more than 5px to prevent blocking clicks on micro-movements
        if (Math.abs(x - startX) > 5) {
            setIsDragging(true);
        }

        const walk = (x - startX) * 2; // Scroll-fast
        categoryScrollRef.current.scrollLeft = scrollLeft - walk;
    };

    const debouncedQuery = useDebounce(query, 500);
    const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
    const { lock, unlock } = useScrollLock();

    const closeSearch = () => setIsSearchOpen(false);

    useEffect(() => {
        if (isSearchOpen) lock();
        else unlock();
    }, [isSearchOpen, lock, unlock]);

    // Load all categories once for client-side filtering
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const allCats = await categoryService.getAll();
                setCategories(allCats);
            } catch (err) {
                console.error("Failed to load categories", err);
            }
        };
        loadCategories();
    }, []);

    // Search Logic
    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedQuery.trim()) {
                setProducts([]);
                setMatchedCategories([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                // 1. Filter Categories Client-Side
                const searchLower = debouncedQuery.toLowerCase();
                const filteredCats = categories.filter(c =>
                    c.name.toLowerCase().includes(searchLower)
                ).slice(0, 6); // Limit to 6 categories
                setMatchedCategories(filteredCats);

                // 2. Fetch Products
                const { products: fetchedProducts } = await productService.getProducts({
                    search: debouncedQuery,
                    limit: 5
                });
                setProducts(fetchedProducts);

            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        performSearch();
    }, [debouncedQuery, categories]);

    const handleSearchSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (query.trim()) {
            addToHistory(query.trim());
            router.push(`/products?search=${encodeURIComponent(query.trim())}`);
            closeSearch();
        }
    };

    const handleHistoryClick = (term: string) => {
        setQuery(term);
        addToHistory(term);
        // Trigger search immediately or let debounce handle it? 
        // Better to let debounce handle it or manually trigger if needed.
        // But for UX, setting query is enough to trigger the effect.
        inputRef.current?.focus();
    };

    return (
        <div ref={containerRef} className="relative w-full">
            {/* Full screen overlay: captures outside clicks and only closes the search */}
            {isSearchOpen && (
                <div
                    aria-hidden="true"
                    className="fixed inset-0 z-40 h-screen w-screen bg-transparent"
                    onClick={closeSearch}
                />
            )}

            {/* Search Input Bar */}
            <div
                onClick={() => { setIsSearchOpen(true); inputRef.current?.focus(); }}
                className={cn(
                    "relative z-50 flex items-center h-12 w-full rounded-xl bg-ekg-50 px-4 transition-all duration-200 border border-transparent",
                    isSearchOpen ? "bg-white border-ekg-200 shadow-sm ring-2 ring-kala-100" : "hover:bg-ekg-100"
                )}
            >
                <Search className={cn(
                    "w-5 h-5 transition-colors",
                    isSearchOpen ? "text-kala-500" : "text-ekg-500"
                )} />

                <form onSubmit={handleSearchSubmit} className="flex-1 mx-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIsSearchOpen(true);
                        }}
                        onFocus={() => setIsSearchOpen(true)}
                        placeholder="جستجو در بین هزاران محصول..."
                        className="w-full bg-transparent text-sm text-ekg-900 placeholder:text-ekg-500 focus:outline-none"
                    />
                </form>

                {query && (
                    <button
                        onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                        className="p-1 rounded-full hover:bg-ekg-100 text-ekg-400 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Dropdown Results */}
            {isSearchOpen && (
                <div className="absolute top-full right-0 left-0 mt-2 bg-white rounded-xl shadow-xl border border-ekg-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">

                    {/* State: Loading */}
                    {isLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-kala-500" />
                        </div>
                    )}

                    {/* State: Empty Query (History) */}
                    {!isLoading && !query && (
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-ekg-800 flex items-center gap-2">
                                    <History className="w-4 h-4 text-kala-500" />
                                    تاریخچه جستجو
                                </h3>
                                {history.length > 0 && (
                                    <button
                                        onClick={clearHistory}
                                        className="text-[11px] text-red-500 hover:text-red-600 flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        پاک کردن همه
                                    </button>
                                )}
                            </div>

                            {history.length === 0 ? (
                                <p className="text-xs text-ekg-400 text-center py-4">
                                    هنوز جستجویی انجام نداده‌اید
                                </p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {history.map((term, idx) => (
                                        <div
                                            key={idx}
                                            className="group flex items-center gap-2 px-3 py-1.5 bg-ekg-50 hover:bg-white border border-transparent hover:border-kala-200 rounded-full transition-all cursor-pointer"
                                            onClick={() => handleHistoryClick(term)}
                                        >
                                            <Clock className="w-3 h-3 text-ekg-400 group-hover:text-kala-500" />
                                            <span className="text-xs text-ekg-600 group-hover:text-ekg-900">{term}</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeFromHistory(term); }}
                                                className="p-0.5 rounded-full hover:bg-red-50 text-ekg-300 hover:text-red-500 transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* State: Results */}
                    {!isLoading && query && (
                        <div>
                            {/* 1. Matched Categories */}
                            {matchedCategories.length > 0 && (
                                <div className="p-4 border-b border-ekg-50">
                                    <h4 className="text-xs font-bold text-ekg-500 mb-3 px-1">در دسته‌بندی‌ها</h4>
                                    <div
                                        ref={categoryScrollRef}
                                        onMouseDown={handleMouseDown}
                                        onMouseLeave={handleMouseLeave}
                                        onMouseUp={handleMouseUp}
                                        onMouseMove={handleMouseMove}
                                        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide cursor-grab active:cursor-grabbing select-none"
                                    >
                                        {matchedCategories.map((cat) => (
                                            <Link
                                                key={cat._id}
                                                href={`/products?category=${cat.slug}&includeChildren=true`}
                                                onClick={(e) => {
                                                    // Prevent click if we were dragging
                                                    if (isDragging) e.preventDefault();
                                                    else closeSearch();
                                                }}
                                                draggable={false}
                                                className="flex flex-col items-center gap-2 min-w-[80px] group select-none"
                                            >
                                                <div className="w-14 h-14 rounded-full bg-ekg-50 border border-ekg-100 flex items-center justify-center group-hover:border-kala-500 group-hover:shadow-md transition-all pointer-events-none">
                                                    {/* Placeholder or Icon */}
                                                    {cat.icon?.url ? (
                                                        <img src={cat.icon.url} alt={cat.name} className="w-8 h-8 object-contain opacity-70 group-hover:opacity-100 pointer-events-none" />
                                                    ) : (
                                                        <span className="text-lg font-bold text-ekg-400 group-hover:text-kala-500 pointer-events-none">{cat.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <span className="text-[11px] text-ekg-700 font-medium text-center truncate w-full group-hover:text-kala-600 pointer-events-none">
                                                    {cat.name}
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 2. Matched Products */}
                            <div className="p-2">
                                {products.length > 0 ? (
                                    <>
                                        <h4 className="text-xs font-bold text-ekg-500 mb-2 px-3 mt-2">محصولات مرتبط</h4>
                                        <div className="space-y-1">
                                            {products.map((product) => (
                                                <Link
                                                    key={product.id}
                                                    href={buildProductUrl(product as any)}
                                                    onClick={() => { addToHistory(query); closeSearch(); }}
                                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-ekg-50 transition-colors group"
                                                >
                                                    <div className="w-10 h-10 rounded-md bg-white border border-ekg-100 flex-shrink-0 overflow-hidden">
                                                        {product.image ? (
                                                            <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-ekg-50">
                                                                <Search className="w-4 h-4 text-ekg-300" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h5 className="text-xs font-bold text-ekg-800 truncate group-hover:text-kala-600 transition-colors">
                                                            {product.title}
                                                        </h5>
                                                        {product.category && !/^[0-9a-fA-F]{24}$/.test(product.category) && (
                                                            <span className="text-[10px] text-ekg-500 truncate block">
                                                                {product.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <ChevronLeft className="w-4 h-4 text-ekg-300 group-hover:text-kala-500 -translate-x-1 group-hover:-translate-x-2 transition-transform" />
                                                </Link>
                                            ))}
                                        </div>
                                        <button
                                            onClick={handleSearchSubmit}
                                            className="w-full mt-2 py-2 text-xs font-bold text-kala-600 hover:bg-kala-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                                        >
                                            مشاهده همه نتایج
                                            <ChevronLeft className="w-3 h-3" />
                                        </button>
                                    </>
                                ) : (
                                    !matchedCategories.length && (
                                        <div className="text-center py-8">
                                            <p className="text-sm text-ekg-500">موردی یافت نشد</p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
