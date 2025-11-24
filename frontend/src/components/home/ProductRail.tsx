"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface ProductRailProps {
    title: string;
    products: any[];
}

export default function ProductRail({ title, products }: ProductRailProps) {
    return (
        <div className="py-4 bg-white border-b border-gray-100">
            {/* Header Section */}
            <div className="px-4 mb-4 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <h3 className="text-base font-bold text-gray-900">{title}</h3>
                    <span className="text-[11px] text-gray-400 font-medium">بر اساس سلیقه شما</span>
                </div>
                <button className="flex items-center gap-0.5 text-blue-500 text-xs font-bold hover:text-blue-600 transition-colors">
                    <span>مشاهده همه</span>
                    <ChevronLeft size={14} />
                </button>
            </div>

            <Swiper
                modules={[FreeMode]}
                freeMode={true}
                spaceBetween={12}
                slidesPerView={"auto"}
                className="w-full !px-4 !pb-4"
                grabCursor={true}
            >
                {products.map((product) => (
                    <SwiperSlide key={product.id} style={{ width: "148px", height: "auto" }}>
                        <Link href={`/product/${product.id}`} className="block h-full">
                            <div className="bg-white p-3 rounded-lg border border-gray-200 h-full flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow duration-300 relative overflow-hidden group">

                                {/* Image */}
                                <div className="aspect-square w-full mb-3 relative flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
                                    <Image
                                        src={product.image || "/placeholder.png"}
                                        alt={product.name}
                                        fill
                                        className={`object-cover group-hover:scale-105 transition-transform duration-500 ${product.countInStock === 0 ? 'grayscale opacity-60' : ''}`}
                                    />

                                    {/* OUT OF STOCK OVERLAY */}
                                    {product.countInStock === 0 && (
                                        <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                                            <span className="bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">
                                                ناموجود
                                            </span>
                                        </div>
                                    )}

                                    {/* Discount Badge (Only if in stock) */}
                                    {product.countInStock > 0 && product.discount > 0 && (
                                        <span className="absolute top-2 right-2 bg-[#ef4056] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full z-20">
                                            {product.discount}٪
                                        </span>
                                    )}
                                </div>

                                {/* Title */}
                                <h3 className={`text-[11px] font-bold leading-5 line-clamp-2 mb-2 min-h-[40px] ${product.countInStock === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
                                    {product.name}
                                </h3>

                                {/* Price Section */}
                                <div className="flex flex-col gap-1 mt-auto">
                                    {/* Row 1: Old Price (if discount and in stock) */}
                                    <div className="flex items-center justify-between h-5">
                                        {product.countInStock > 0 && product.discount > 0 ? (
                                            <span className="text-[10px] text-gray-300 line-through decoration-gray-300">
                                                {(product.price * 1.1).toLocaleString("fa-IR")}
                                            </span>
                                        ) : <div className="h-5" />}
                                    </div>

                                    {/* Row 2: Current Price */}
                                    <div className={`flex items-center justify-end gap-1 ${product.countInStock === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
                                        <span className="text-[15px] font-black tracking-tight">
                                            {product.price.toLocaleString("fa-IR")}
                                        </span>
                                        <span className={`text-[10px] font-medium ${product.countInStock === 0 ? 'text-gray-400' : 'text-gray-600'}`}>تومان</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </SwiperSlide>
                ))}

                {/* "See All" Card (Last Slide) */}
                <SwiperSlide style={{ width: "148px", height: "auto" }}>
                    <div className="bg-white h-full rounded-lg border border-gray-200 flex flex-col items-center justify-center gap-3 cursor-pointer group hover:border-gray-300 transition-colors">
                        <div className="w-10 h-10 border border-gray-200 rounded-full flex items-center justify-center text-blue-500 group-hover:bg-blue-50 transition-colors">
                            <ChevronLeft size={20} />
                        </div>
                        <span className="text-sm font-bold text-gray-700">مشاهده همه</span>
                    </div>
                </SwiperSlide>
            </Swiper>
        </div>
    );
}
