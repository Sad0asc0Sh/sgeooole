"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Category } from "@/services/categoryService";
import { trackCategoryView, trackCategoryClick } from "@/lib/categoryTracking";

interface CategoryRailProps {
    title: string;
    data: Category[];
    variant: 'circle' | 'card';
}

export default function CategoryRail({ title, data, variant }: CategoryRailProps) {
    // Track views when component mounts (for analytics)
    useEffect(() => {
        if (data && data.length > 0) {
            // Track view for first 3 visible categories
            data.slice(0, 3).forEach((category) => {
                if (category._id) {
                    trackCategoryView(category._id, "homepage", "view");
                }
            });
        }
    }, [data]);

    if (!data || data.length === 0) {
        return null;
    }

    const handleCategoryClick = (categoryId: string) => {
        trackCategoryClick(categoryId, "homepage");
    };

    return (
        <div className="py-4 bg-white border-b border-gray-100">
            <SectionTitle>{title}</SectionTitle>
            <Swiper
                modules={[FreeMode, Autoplay]}
                freeMode={true}
                loop={data.length > 5} // Only loop if enough items
                autoplay={{
                    delay: 0,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true
                }}
                speed={4000}
                spaceBetween={16}
                slidesPerView={"auto"}
                className="w-full !px-4 free-mode-slider"
                grabCursor={true}
            >
                {data.map((category) => (
                    <SwiperSlide key={category._id} style={{ width: variant === 'circle' ? '80px' : '110px' }}>
                        <Link
                            href={`/products?category=${category.slug || category._id}`}
                            onClick={() => handleCategoryClick(category._id)}
                        >
                            {/* --- VARIANT: CIRCLE (FEATURED) --- */}
                            {variant === 'circle' && (
                                <div className="flex flex-col items-center gap-2 cursor-pointer group select-none">
                                    <div className="w-20 h-20 rounded-full p-[2px] bg-gradient-to-tr from-vita-400 to-welf-300">
                                        <div className="w-full h-full bg-white rounded-full p-2 flex items-center justify-center overflow-hidden relative">
                                            {category.image?.url || category.icon?.url ? (
                                                <img
                                                    src={category.image?.url || category.icon?.url}
                                                    alt={category.name}
                                                    className="w-full h-full object-cover rounded-full"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 rounded-full" />
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-[11px] text-gray-700 font-medium text-center truncate w-full">
                                        {category.name}
                                    </span>
                                </div>
                            )}

                            {/* --- VARIANT: CARD (POPULAR) --- */}
                            {variant === 'card' && (
                                <div className="flex flex-col items-center bg-gray-50 rounded-xl p-3 cursor-pointer border border-gray-100 select-none hover:bg-gray-100 transition-colors">
                                    <div className="w-16 h-16 mb-2 relative flex items-center justify-center">
                                        {category.image?.url || category.icon?.url ? (
                                            <img
                                                src={category.image?.url || category.icon?.url}
                                                alt={category.name}
                                                className="w-full h-full object-cover rounded-lg shadow-sm"
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
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
}
