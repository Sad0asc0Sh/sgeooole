"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, Heart, Share2, Star, ShieldCheck, Store, Info, AlertCircle, Loader2 } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import Link from "next/link";
import Image from "next/image";
import { productService, Product, ProductColor } from "@/services/productService";

export default function ProductDetailPage() {
    const params = useParams();
    const id = params.id as string;

    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);

    useEffect(() => {
        const loadProduct = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await productService.getById(id);
                setProduct(data);

                if (data.colors && data.colors.length > 0) {
                    setSelectedColor(data.colors[0]);
                }
            } catch (err) {
                console.error("Failed to load product:", err);
                setError("محصول مورد نظر یافت نشد یا خطایی رخ داده است.");
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            loadProduct();
        }
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white pb-24">
                <div className="fixed top-0 left-0 w-full z-20 flex justify-between items-center p-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                    <div className="flex gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                        <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                    </div>
                </div>
                <div className="relative bg-gray-100 h-[380px] w-full animate-pulse" />
                <div className="px-4 py-6 -mt-6 relative bg-white rounded-t-3xl">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-4 animate-pulse" />
                    <div className="h-12 bg-gray-100 rounded-xl mb-6 animate-pulse" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
                        ))}
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center mt-8 gap-3">
                    <Loader2 className="animate-spin text-vita-500" size={32} />
                    <span className="text-sm text-gray-500">در حال دریافت اطلاعات محصول...</span>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-6 px-4">
                <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center">
                    <AlertCircle className="text-red-500" size={40} />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">خطا در نمایش محصول</h2>
                    <p className="text-gray-500 text-sm">{error || "محصول مورد نظر یافت نشد"}</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/" className="px-6 py-3 bg-gray-100 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">
                        بازگشت به فروشگاه
                    </Link>
                    <button onClick={() => window.location.reload()} className="px-6 py-3 bg-vita-500 text-white rounded-xl text-sm font-bold hover:bg-vita-600 transition-colors">
                        تلاش مجدد
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white pb-24">

            {/* Header (Transparent/Floating) */}
            <div className="fixed top-0 left-0 w-full z-20 flex justify-between items-center p-4">
                <Link href="/" className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm hover:bg-white">
                    <ChevronLeft />
                </Link>
                <div className="flex gap-3">
                    <button className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm hover:text-red-500">
                        <Heart size={20} />
                    </button>
                    <button className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm">
                        <Share2 size={20} />
                    </button>
                </div>
            </div>

            {/* Gallery Slider */}
            <div className="relative bg-gray-50 h-[380px] w-full">
                <Swiper modules={[Pagination]} pagination={{ clickable: true }} className="h-full">
                    {product.images.map((img, index) => (
                        <SwiperSlide key={index} className="flex items-center justify-center">
                            <div className="w-full h-full flex items-center justify-center text-gray-300 relative">
                                <Image
                                    src={img}
                                    alt={`${product.title} - ${index + 1}`}
                                    fill
                                    className="object-contain p-8"
                                />
                            </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>

            {/* Info Section */}
            <div className="px-4 py-6 -mt-6 relative bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-10">

                {/* Title & Rating */}
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold text-gray-900 leading-snug">{product.title}</h1>
                        {product.enTitle && (
                            <span className="text-xs text-gray-400 font-mono mt-1">{product.enTitle}</span>
                        )}
                    </div>
                </div>

                {/* Rating Section */}
                {product.rating > 0 && (
                    <div className="flex items-center gap-1 mb-6">
                        <Star size={14} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-sm font-bold text-gray-800">{product.rating}</span>
                        <span className="text-xs text-gray-400">
                            ({product.reviewCount} {product.reviewCount === 0 ? "" : "دیدگاه"})
                        </span>
                    </div>
                )}

                <hr className="border-gray-100 mb-6" />

                {/* Color Selector (if colors available) */}
                {product.colors && product.colors.length > 0 && selectedColor && (
                    <div className="mb-6">
                        <span className="text-sm font-bold text-gray-800 block mb-3">
                            رنگ: {selectedColor.name}
                        </span>
                        <div className="flex gap-3">
                            {product.colors.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedColor(c)}
                                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${selectedColor.id === c.id ? "border-vita-500" : "border-gray-200"
                                        }`}
                                >
                                    <span
                                        className="w-6 h-6 rounded-full border border-gray-100"
                                        style={{ backgroundColor: c.hex }}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Features (Stock, Brand) */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-6">
                    {product.brand && (
                        <>
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                                <ShieldCheck size={18} className="text-gray-400" />
                                <span>برند: {product.brand}</span>
                            </div>
                            <div className="h-px bg-gray-200 w-full" />
                        </>
                    )}
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Store size={18} className={product.countInStock > 0 ? "text-vita-500" : "text-red-500"} />
                        <span>
                            {product.countInStock > 0
                                ? `موجود در انبار (${product.countInStock} عدد)`
                                : "ناموجود"}
                        </span>
                    </div>
                </div>

                {/* Description Section */}
                {product.description && (
                    <div className="mb-6">
                        <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <Info size={18} className="text-vita-600" /> توضیحات محصول
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
                    </div>
                )}

                {/* Specifications Section */}
                {product.specs && product.specs.length > 0 ? (
                    <div className="mb-4">
                        <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <Info size={18} className="text-vita-600" /> مشخصات فنی
                        </h3>
                        <div className="space-y-2">
                            {product.specs.map((spec, i) => (
                                <div
                                    key={i}
                                    className="flex justify-between py-2 border-b border-gray-50 text-xs"
                                >
                                    <span className="text-gray-500">{spec.label}</span>
                                    <span className="text-gray-800 font-medium">{spec.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mb-4 p-4 bg-gray-50 rounded-xl text-center">
                        <p className="text-sm text-gray-500">مشخصات فنی این محصول ثبت نشده است</p>
                    </div>
                )}

            </div>

            {/* Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-50 flex items-center justify-between gap-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
                <div className="flex flex-col">
                    {product.oldPrice && (
                        <span className="text-[10px] text-gray-400 line-through decoration-red-400 decoration-1 text-left pl-1">
                            {product.oldPrice.toLocaleString("fa-IR")}
                        </span>
                    )}
                    <div className="flex items-center gap-1">
                        <span className="text-xl font-black text-black">
                            {product.price.toLocaleString("fa-IR")}
                        </span>
                        <span className="text-xs text-gray-500">تومان</span>
                    </div>
                </div>
                <button
                    disabled={product.countInStock === 0}
                    className={`flex-1 font-bold py-3.5 rounded-xl shadow-md active:scale-95 transition-transform ${product.countInStock === 0
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-gradient-to-r from-vita-500 to-vita-600 text-white shadow-vita-200"
                        }`}
                >
                    {product.countInStock === 0 ? "ناموجود" : "افزودن به سبد خرید"}
                </button>
            </div>

        </div>
    );
}
