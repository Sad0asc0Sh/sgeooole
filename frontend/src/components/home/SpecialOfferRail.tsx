"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import { PRODUCTS } from "@/lib/mock/homeData";
import { ChevronLeft, Percent } from "lucide-react";
import Link from "next/link";

export default function SpecialOfferRail() {
    return (
        // 👇👇👇 تغییر ۱: رنگ پس‌زمینه اصلی به خاکستری تیره 👇👇👇
        <div className="py-5 bg-gray-900 relative overflow-hidden touch-pan-y">
            <div className="container mx-auto">
                {/* Header Section */}
                <div className="px-4 mb-3 flex items-center justify-between">

                    {/* Right: Title & Icon */}
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 border-[1.5px] border-white rounded-full flex items-center justify-center">
                            <Percent size={12} className="text-white fill-white" />
                        </div>
                        <h2 className="text-base font-bold text-white">فروش‌ویژه</h2>
                    </div>

                    {/* Center: Timer (Boxed) */}
                    <div className="flex items-center gap-1 text-white font-bold text-xs dir-ltr">
                        {/* 👇👇👇 تغییر ۲: رنگ متن تایمرها به رنگ برند (Vita) 👇👇👇 */}
                        <div className="bg-white text-vita-600 w-7 h-7 flex items-center justify-center rounded-[4px] shadow-sm">05</div>
                        <span className="mb-1">:</span>
                        <div className="bg-white text-vita-600 w-7 h-7 flex items-center justify-center rounded-[4px] shadow-sm">18</div>
                        <span className="mb-1">:</span>
                        <div className="bg-white text-vita-600 w-7 h-7 flex items-center justify-center rounded-[4px] shadow-sm">10</div>
                    </div>

                    {/* Left: See All */}
                    <button className="flex items-center gap-0.5 text-white text-xs font-medium hover:text-white/90 transition-colors">
                        <span>همه</span>
                        <ChevronLeft size={14} />
                    </button>
                </div>

                {/* Products Slider */}
                <Swiper
                    modules={[FreeMode]}
                    freeMode={true}
                    spaceBetween={8}
                    slidesPerView={"auto"}
                    className="w-full !px-4 !pb-2"
                    grabCursor={true}
                >
                    {PRODUCTS.map((product) => (
                        <SwiperSlide key={product.id} style={{ width: "148px", height: "auto" }}>
                            <Link href={`/product/${product.id}`} className="block h-full">
                                <div className="bg-white p-3 rounded-lg h-full flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow duration-300 relative overflow-hidden group">

                                    {/* Image */}
                                    <div className="aspect-square w-full mb-3 relative flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
                                        <div className="w-full h-full bg-gray-100 group-hover:scale-105 transition-transform duration-500" />
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-[11px] font-bold text-gray-700 leading-5 line-clamp-2 mb-2 min-h-[40px]">
                                        {product.name}
                                    </h3>

                                    {/* Price Section */}
                                    <div className="flex flex-col gap-1 mt-auto">
                                        {/* Row 1: Old Price & Discount */}
                                        <div className="flex items-center justify-between h-5">
                                            {product.discount > 0 ? (
                                                <>
                                                    {/* 👇👇👇 تغییر ۳: رنگ برچسب تخفیف به رنگ برند 👇👇👇 */}
                                                    <div className="bg-vita-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                                                        {product.discount}٪
                                                    </div>
                                                    <span className="text-[10px] text-gray-300 line-through decoration-gray-300">
                                                        {(product.price * 1.1).toLocaleString("fa-IR")}
                                                    </span>
                                                </>
                                            ) : <div className="h-5" />}
                                        </div>

                                        {/* Row 2: Current Price */}
                                        <div className="flex items-center justify-end gap-1 text-gray-800">
                                            <span className="text-[15px] font-black tracking-tight">
                                                {product.price.toLocaleString("fa-IR")}
                                            </span>
                                            <span className="text-[10px] font-medium text-gray-600">تومان</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </SwiperSlide>
                    ))}

                    {/* "See All" Card (Last Slide) */}
                    <SwiperSlide style={{ width: "148px", height: "auto" }}>
                        <div className="bg-white h-full rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer group border border-transparent hover:border-gray-100">
                            {/* 👇👇👇 تغییر ۴: رنگ دکمه مشاهده همه 👇👇👇 */}
                            <div className="w-12 h-12 border border-gray-100 rounded-full flex items-center justify-center text-vita-600 group-hover:bg-gray-50 transition-colors">
                                <ChevronLeft size={24} />
                            </div>
                            <span className="text-sm font-bold text-gray-700">مشاهده همه</span>
                        </div>
                    </SwiperSlide>
                </Swiper>
            </div>
        </div>
    );
}