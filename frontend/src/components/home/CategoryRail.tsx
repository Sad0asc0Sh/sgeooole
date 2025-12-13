"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Category } from "@/services/categoryService";
import { trackCategoryView, trackCategoryClick } from "@/lib/categoryTracking";

interface CategoryRailProps {
    title: string;
    data: Category[];
    variant: 'circle' | 'card';
}

export default function CategoryRail({ title, data, variant }: CategoryRailProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isPausedRef = useRef(false);
    const isEndedRef = useRef(false);

    // Pause duration (6 seconds)
    const PAUSE_DURATION = 6000;
    // Item width + gap
    const ITEM_WIDTH = variant === 'circle' ? 96 : 126; // 80px/110px + 16px gap

    // Track views when component mounts
    useEffect(() => {
        if (data && data.length > 0) {
            data.slice(0, 3).forEach((category) => {
                if (category._id) {
                    trackCategoryView(category._id, "homepage", "view");
                }
            });
        }
    }, [data]);

    // Auto-scroll logic
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !data || data.length === 0) return;

        const scrollOneItem = () => {
            if (isPausedRef.current || isEndedRef.current || !containerRef.current) return;

            const el = containerRef.current;
            const maxScroll = el.scrollWidth - el.clientWidth;
            const currentScroll = el.scrollLeft;

            // Check if we've reached the end (with small tolerance)
            if (currentScroll >= maxScroll - 10) {
                isEndedRef.current = true;
                return;
            }

            // Scroll one item to the left (increase scrollLeft in RTL means moving left visually)
            el.scrollBy({
                left: ITEM_WIDTH,
                behavior: 'smooth'
            });

            // Schedule next scroll
            scheduleNextScroll();
        };

        const scheduleNextScroll = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

            if (isPausedRef.current || isEndedRef.current) return;

            timerRef.current = setTimeout(scrollOneItem, PAUSE_DURATION);
        };

        // Start auto-scroll after initial delay
        const initialTimer = setTimeout(() => {
            scheduleNextScroll();
        }, PAUSE_DURATION);

        return () => {
            clearTimeout(initialTimer);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [data, ITEM_WIDTH, PAUSE_DURATION]);

    // Mouse handlers
    const handleMouseEnter = () => {
        isPausedRef.current = true;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleMouseLeave = () => {
        isPausedRef.current = false;
        if (!isEndedRef.current && containerRef.current) {
            // Resume scrolling
            if (timerRef.current) clearTimeout(timerRef.current);

            const el = containerRef.current;
            const maxScroll = el.scrollWidth - el.clientWidth;

            if (el.scrollLeft < maxScroll - 10) {
                timerRef.current = setTimeout(() => {
                    if (!isPausedRef.current && !isEndedRef.current && containerRef.current) {
                        containerRef.current.scrollBy({
                            left: ITEM_WIDTH,
                            behavior: 'smooth'
                        });
                        // Continue the cycle
                        handleMouseLeave();
                    }
                }, PAUSE_DURATION);
            }
        }
    };

    if (!data || data.length === 0) {
        return null;
    }

    const handleCategoryClick = (categoryId: string) => {
        trackCategoryClick(categoryId, "homepage");
    };

    return (
        <div
            className="py-4 bg-white border-b border-gray-100"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <SectionTitle>{title}</SectionTitle>
            <div
                ref={containerRef}
                className="flex gap-4 overflow-x-auto px-4 scroll-smooth scrollbar-hide"
                style={{
                    scrollBehavior: 'smooth',
                    WebkitOverflowScrolling: 'touch',
                    scrollSnapType: 'x mandatory'
                }}
            >
                {data.map((category) => (
                    <div
                        key={category._id}
                        className="flex-shrink-0"
                        style={{
                            width: variant === 'circle' ? '80px' : '110px',
                            scrollSnapAlign: 'start'
                        }}
                    >
                        <Link
                            href={`/products?category=${category.slug || category._id}&includeChildren=true`}
                            onClick={() => handleCategoryClick(category._id)}
                        >
                            {/* --- VARIANT: CIRCLE (FEATURED) --- */}
                            {variant === 'circle' && (
                                <div className="flex flex-col items-center gap-2 cursor-pointer group select-none">
                                    <div className="w-20 h-20 rounded-full p-[2px] bg-gradient-to-tr from-vita-400 to-welf-300 transition-transform duration-300 group-hover:scale-105">
                                        <div className="w-full h-full bg-white rounded-full p-2 flex items-center justify-center overflow-hidden relative">
                                            {category.image?.url || category.icon?.url ? (
                                                <img
                                                    src={category.image?.url || category.icon?.url}
                                                    alt={category.name}
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 rounded-full" />
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-[11px] text-gray-700 font-medium text-center truncate w-full group-hover:text-vita-600 transition-colors duration-200">
                                        {category.name}
                                    </span>
                                </div>
                            )}

                            {/* --- VARIANT: CARD (POPULAR) --- */}
                            {variant === 'card' && (
                                <div className="flex flex-col items-center bg-gray-50 rounded-xl p-3 cursor-pointer border border-gray-100 select-none hover:bg-gray-100 hover:border-vita-200 hover:shadow-md transition-all duration-300">
                                    <div className="w-16 h-16 mb-2 relative flex items-center justify-center transition-transform duration-300 hover:scale-105">
                                        {category.image?.url || category.icon?.url ? (
                                            <img
                                                src={category.image?.url || category.icon?.url}
                                                alt={category.name}
                                                className="w-full h-full object-contain rounded-lg"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-white rounded-lg shadow-sm" />
                                        )}
                                    </div>
                                    <span className="text-[10px] text-gray-600 text-center font-bold leading-tight line-clamp-2 h-8 flex items-center justify-center">
                                        {category.name}
                                    </span>
                                </div>
                            )}
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}
