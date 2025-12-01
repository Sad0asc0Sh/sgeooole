"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Heart, Share2, Star, ShieldCheck, Store, Info, AlertCircle, Loader2, Check, Minus, Plus, Trash2, X, ShoppingCart, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Zoom, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/zoom";
import "swiper/css/navigation";
import Link from "next/link";
import Image from "next/image";
import { productService, Product, ProductColor } from "@/services/productService";
import CountdownTimer from "@/components/ui/CountdownTimer";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";

import { useHistoryStore } from "@/store/historyStore";
import ProductTabs from "@/components/product/ProductTabs";

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);
    const [addingToCart, setAddingToCart] = useState(false);
    const [addedToCart, setAddedToCart] = useState(false);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [initialSlide, setInitialSlide] = useState(0);
    const [swiperInstance, setSwiperInstance] = useState<any>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const { addToCart, updateQuantity, removeFromCart, itemCount, cartItems } = useCart();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const { addToHistory } = useHistoryStore();

    // Calculate quantity for the SPECIFIC selected variant
    const quantity = product ? (cartItems.find(item => {
        if (item.id !== product.id) return false;

        // If product has colors, match the selected color
        if (selectedColor) {
            const variantOptions = item.variantOptions || [];
            return variantOptions.some(v => v.name === "رنگ" && v.value === selectedColor.name);
        }

        // If product has no colors, match item with no variants (or ignore variants)
        return true;
    })?.qty || 0) : 0;

    const isFavorite = product ? isInWishlist(product.id) : false;

    useEffect(() => {
        const loadProduct = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await productService.getById(id);
                setProduct(data);

                // Add to history
                addToHistory({
                    _id: data.id,
                    title: data.title,
                    price: data.price,
                    image: data.images?.[0] || '',
                    slug: data.slug || data.id,
                    discount: data.discount,
                    finalPrice: data.price
                });

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

    const handleAddToCart = async () => {
        if (!product) return;

        try {
            setAddingToCart(true);
            const variantOptions = selectedColor ? [{ name: "رنگ", value: selectedColor.name }] : [];
            await addToCart(product, 1, variantOptions);
            setAddedToCart(true);
            setTimeout(() => setAddedToCart(false), 2000);
        } catch (err: any) {
            console.error("Error adding to cart:", err);
            alert(`Error: ${err.message || "Unknown error"}`);
        } finally {
            setAddingToCart(false);
        }
    };

    const handleIncrement = async () => {
        if (!product) return;
        try {
            const variantOptions = selectedColor ? [{ name: "رنگ", value: selectedColor.name }] : [];
            await updateQuantity(product.id, quantity + 1, variantOptions);
        } catch (err) {
            console.error("Error incrementing:", err);
        }
    };

    const handleDecrement = async () => {
        if (!product) return;
        try {
            const variantOptions = selectedColor ? [{ name: "رنگ", value: selectedColor.name }] : [];
            if (quantity > 1) {
                await updateQuantity(product.id, quantity - 1, variantOptions);
            } else {
                await removeFromCart(product.id, variantOptions);
            }
        } catch (err) {
            console.error("Error decrementing:", err);
        }
    };

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
            <div className="fixed top-0 left-0 w-full z-20 flex justify-between items-center p-4 pointer-events-none">
                {/* Right: Close Button */}
                <button
                    onClick={() => router.back()}
                    className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm hover:bg-white pointer-events-auto"
                >
                    <X size={24} />
                </button>

                {/* Left: Actions (Favorites, Cart, Search) - Visual LTR */}
                <div className="flex gap-3 pointer-events-auto" dir="ltr">
                    {/* Favorites */}
                    <button
                        onClick={() => product && toggleWishlist(product)}
                        className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm hover:text-red-500 transition-colors"
                    >
                        <Heart size={20} className={isFavorite ? "fill-red-500 text-red-500" : ""} />
                    </button>

                    {/* Cart */}
                    <Link href="/cart" className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm hover:text-vita-600 transition-colors relative">
                        <ShoppingCart size={20} />
                        {itemCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-vita-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                                {itemCount}
                            </span>
                        )}
                    </Link>

                    {/* Search */}
                    <button className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-sm hover:text-vita-600 transition-colors">
                        <Search size={20} />
                    </button>
                </div>
            </div>

            {/* Gallery Slider */}
            <div className="relative bg-gray-50 w-full pb-10">
                <div className="h-[380px] w-full">
                    <Swiper
                        modules={[Pagination]}
                        pagination={{ clickable: true }}
                        className="h-full"
                        onSwiper={setSwiperInstance}
                        onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                    >
                        {product.images.map((img, index) => (
                            <SwiperSlide key={index} className="flex items-center justify-center">
                                <div
                                    className="w-full h-full flex items-center justify-center text-gray-300 relative cursor-zoom-in"
                                    onClick={() => {
                                        setInitialSlide(index);
                                        setIsGalleryOpen(true);
                                    }}
                                >
                                    <Image
                                        src={img}
                                        alt={`${product.title} - ${index + 1}`}
                                        fill
                                        className="object-contain p-8"
                                    />
                                    {product.campaignLabel && (
                                        <div className="absolute top-20 left-4 z-20">
                                            <span className={`text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm ${product.campaignTheme === 'gold-red' || product.campaignTheme === 'gold' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                                                product.campaignTheme === 'red-purple' || product.campaignTheme === 'fire' || product.campaignTheme === 'red' ? 'bg-gradient-to-r from-rose-500 to-purple-700' :
                                                    product.campaignTheme === 'lime-orange' || product.campaignTheme === 'lime' ? 'bg-gradient-to-r from-lime-400 to-green-500' :
                                                        'bg-gradient-to-r from-blue-400 to-indigo-500' // Default to Blue
                                                }`}>
                                                {product.campaignLabel}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>

                {/* Thumbnails */}
                <div className="flex gap-3 px-4 overflow-x-auto no-scrollbar mt-2 pb-4">
                    {product.images.map((img, index) => (
                        <button
                            key={index}
                            onClick={() => swiperInstance?.slideTo(index)}
                            className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${activeIndex === index
                                ? "border-vita-500 shadow-md scale-105"
                                : "border-transparent opacity-60 hover:opacity-100"
                                }`}
                        >
                            <Image
                                src={img}
                                alt={`Thumbnail ${index + 1}`}
                                fill
                                className="object-cover"
                            />
                        </button>
                    ))}
                </div>
            </div>

            {/* Full Screen Gallery Modal */}
            <AnimatePresence>
                {isGalleryOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-black/95 flex flex-col"
                    >
                        {/* Gallery Header */}
                        <div className="flex items-center justify-between p-4 text-white z-10">
                            <span className="text-sm font-medium">
                                {product.images.length} / <span id="current-slide">1</span>
                            </span>
                            <button
                                onClick={() => setIsGalleryOpen(false)}
                                className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Zoomable Swiper */}
                        <div className="flex-1 h-full w-full overflow-hidden">
                            <Swiper
                                modules={[Zoom, Navigation, Pagination]}
                                zoom={true}
                                navigation={false}
                                pagination={{
                                    type: 'fraction',
                                    el: '#current-slide', // Custom pagination element
                                    formatFractionCurrent: (number) => number,
                                    formatFractionTotal: (number) => number,
                                    renderFraction: (currentClass, totalClass) => {
                                        return `<span class="${currentClass}"></span>`;
                                    }
                                }}
                                initialSlide={initialSlide}
                                className="h-full w-full"
                                onSlideChange={(swiper) => {
                                    const el = document.getElementById('current-slide');
                                    if (el) el.innerText = (swiper.realIndex + 1).toString();
                                }}
                            >
                                {product.images.map((img, index) => (
                                    <SwiperSlide key={index} className="flex items-center justify-center">
                                        <div className="swiper-zoom-container w-full h-full flex items-center justify-center">
                                            <div className="relative w-full h-full max-w-4xl max-h-[80vh]">
                                                <Image
                                                    src={img}
                                                    alt={`${product.title} - ${index + 1}`}
                                                    fill
                                                    className="object-contain"
                                                    priority={index === initialSlide}
                                                />
                                            </div>
                                        </div>
                                    </SwiperSlide>
                                ))}
                            </Swiper>
                        </div>

                        {/* Gallery Footer (Thumbnails could go here) */}
                        <div className="p-4 text-center text-white/50 text-xs">
                            برای بزرگنمایی دو بار ضربه بزنید
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Info Section */}
            <div className="px-4 py-6 -mt-6 relative bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-10">

                {/* Title & Rating */}
                <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                        {product.categoryPath && product.categoryPath.length > 0 ? (
                            <div className="flex items-center gap-1 text-xs font-medium text-vita-600 mb-1">
                                {product.categoryPath.map((cat, index) => (
                                    <span key={cat.id} className="flex items-center">
                                        {index > 0 && <span className="mx-1 text-gray-400">/</span>}
                                        <Link
                                            href={`/products?category=${cat.slug}${index === 0 && product.categoryPath!.length > 1 ? '&includeChildren=true' : ''}`}
                                            className="hover:underline hover:text-vita-700 transition-colors"
                                        >
                                            {cat.name}
                                        </Link>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            product.category && (
                                <span className="text-xs font-medium text-vita-600 mb-1 block">
                                    {product.category}
                                </span>
                            )
                        )}
                        <h1 className="text-lg font-bold text-gray-900 leading-snug">{product.title}</h1>
                        {product.enTitle && (
                            <span className="text-xs text-gray-400 font-mono mt-1">{product.enTitle}</span>
                        )}
                    </div>
                </div>

                {/* Timer for Special Offers */}
                {(product.flashDealEndTime || product.specialOfferEndTime) && (
                    <div className="mb-4">
                        <div className={`p-3 rounded-xl flex items-center justify-between ${product.campaignTheme === 'gold-red' || product.campaignTheme === 'gold' ? 'bg-amber-50 text-amber-700' :
                                product.campaignTheme === 'red-purple' || product.campaignTheme === 'fire' || product.campaignTheme === 'red' ? 'bg-rose-50 text-rose-700' :
                                    product.campaignTheme === 'lime-orange' || product.campaignTheme === 'lime' ? 'bg-lime-50 text-lime-700' :
                                        'bg-blue-50 text-blue-700'
                            }`}>
                            <span className="text-sm font-bold flex items-center gap-2">
                                <Store size={16} />
                                {product.campaignLabel || 'پیشنهاد ویژه'}
                            </span>
                            <div className="flex items-center gap-2" dir="ltr">
                                <CountdownTimer
                                    targetDate={product.flashDealEndTime || product.specialOfferEndTime}
                                    className="text-sm font-bold"
                                />
                            </div>
                        </div>
                    </div>
                )}

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

                {/* Product Tabs (Description, Specs, Reviews) */}
                <ProductTabs product={product} />

            </div>

            {/* Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-[100] flex items-center justify-between gap-4 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
                <div className="flex flex-col">
                    {product.oldPrice && (
                        <div className="flex items-center gap-2 mb-1">
                            {product.discount > 0 && (
                                <div className={`text-white text-[11px] font-bold px-2 py-0.5 rounded-full ${product.campaignTheme === 'gold-red' || product.campaignTheme === 'gold' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                                    product.campaignTheme === 'red-purple' || product.campaignTheme === 'fire' || product.campaignTheme === 'red' ? 'bg-gradient-to-r from-rose-500 to-purple-700' :
                                        product.campaignTheme === 'lime-orange' || product.campaignTheme === 'lime' ? 'bg-gradient-to-r from-lime-400 to-green-500' :
                                            product.campaignLabel ? 'bg-gradient-to-r from-blue-400 to-indigo-500' : 'bg-[#ef394e]'
                                    }`}>
                                    {product.discount.toLocaleString("fa-IR")}٪
                                </div>
                            )}
                            <span className="text-[12px] text-gray-400 line-through decoration-gray-300 decoration-1">
                                {product.oldPrice.toLocaleString("fa-IR")}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-1">
                        <span className="text-xl font-black text-black">
                            {product.price.toLocaleString("fa-IR")}
                        </span>
                        <span className="text-xs text-gray-500">تومان</span>
                    </div>
                </div>
                <div className="flex-1 h-[50px] relative flex justify-end">
                    <AnimatePresence mode="wait" initial={false}>
                        {quantity > 0 ? (
                            <motion.div
                                key="quantity-controls"
                                initial={{ opacity: 0, width: "100%" }}
                                animate={{ opacity: 1, width: "160px" }}
                                exit={{ opacity: 0, width: "100%" }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="h-full flex items-center justify-between bg-white border border-gray-200 rounded-lg shadow-sm px-1"
                            >
                                <motion.button
                                    whileTap={{ scale: 0.8 }}
                                    onClick={handleDecrement}
                                    className="w-10 h-10 flex items-center justify-center text-amber-700 rounded-full hover:bg-amber-50 transition-colors"
                                >
                                    {quantity === 1 ? <Trash2 size={20} /> : <Minus size={20} />}
                                </motion.button>

                                <motion.span
                                    key={quantity}
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="text-lg font-bold text-amber-700 w-8 text-center"
                                >
                                    {quantity.toLocaleString("fa-IR")}
                                </motion.span>

                                <motion.button
                                    whileTap={{ scale: 0.8 }}
                                    onClick={handleIncrement}
                                    className="w-10 h-10 flex items-center justify-center text-amber-700 rounded-full hover:bg-amber-50 transition-colors"
                                >
                                    <Plus size={20} />
                                </motion.button>
                            </motion.div>
                        ) : (
                            <motion.button
                                key="add-to-cart"
                                initial={{ opacity: 0, width: "160px" }}
                                animate={{ opacity: 1, width: "100%" }}
                                exit={{ opacity: 0, width: "160px" }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleAddToCart}
                                disabled={product.countInStock === 0 || addingToCart}
                                className={`h-full font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all ${product.countInStock === 0
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                    : "bg-amber-600 text-white hover:bg-amber-700 shadow-amber-100"
                                    }`}
                            >
                                {product.countInStock === 0 ? (
                                    "ناموجود"
                                ) : addingToCart ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>...</span>
                                    </>
                                ) : (
                                    "افزودن به سبد خرید"
                                )}
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
