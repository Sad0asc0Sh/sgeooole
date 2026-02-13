"use client";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/autoplay";
import "swiper/css/pagination";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Banner, bannerService } from "@/services/bannerService";
import { resolveImageUrl } from "@/lib/image";
import { useRouter } from "next/navigation";

type HeroSectionProps = {
    initialBanners?: Banner[];
};

/**
 * ============================================================
 *  سیستم بنر تبلیغاتی حرفه‌ای - EKGKala
 * ============================================================
 * 
 *  📐 ابعاد استاندارد بنرها:
 * 
 *  ┌─────────────────────────────────────────────────────┐
 *  │  🖼️  اسلایدر اصلی (main-slider)                     │
 *  │  ──────────────────────────────────────────────────  │
 *  │  ابعاد ایده‌آل:  1200 × 500  پیکسل                   │
 *  │  نسبت تصویر:   12:5  (2.4:1)                        │
 *  │  حداقل عرض:    600 پیکسل                            │
 *  │                                                     │
 *  │  ⚠️  ناحیه امن: محتوای مهم را در 80% مرکزی          │
 *  │      تصویر قرار دهید                                 │
 *  │                                                     │
 *  │  💡 این ابعاد هم روی موبایل و هم دسکتاپ              │
 *  │     بدون بریدگی نمایش داده می‌شود                     │
 *  └─────────────────────────────────────────────────────┘
 *
 *  ┌─────────────────────────────────────────────────────┐
 *  │  📢  بنر تبلیغاتی (middle-banner)                    │
 *  │  ──────────────────────────────────────────────────  │
 *  │  ابعاد ایده‌آل:  800 × 250  پیکسل                    │
 *  │  نسبت تصویر:   16:5  (3.2:1)                        │
 *  │  حداقل عرض:    400 پیکسل                            │
 *  └─────────────────────────────────────────────────────┘
 *
 *  ┌─────────────────────────────────────────────────────┐
 *  │  🎯  بنر کمپین (campaign-banner)                     │
 *  │  ──────────────────────────────────────────────────  │
 *  │  ابعاد ایده‌آل:  1200 × 400  پیکسل                   │
 *  │  نسبت تصویر:   3:1                                  │
 *  │  حداقل عرض:    600 پیکسل                            │
 *  └─────────────────────────────────────────────────────┘
 *
 *  🔧 نکات مهم برای ادمین:
 *  ─────────────────────────
 *  ✅ تصاویر WebP یا JPG با کیفیت 80% استفاده کنید
 *  ✅ حجم فایل: زیر 500KB ایده‌آل، حداکثر 2MB
 *  ✅ متن و محتوای مهم را در مرکز تصویر قرار دهید
 *  ✅ از پس‌زمینه ساده اطراف محتوای اصلی استفاده کنید
 *  ❌ از تصاویر با متن در گوشه‌ها خودداری کنید
 *  ❌ از تصاویر خیلی باریک یا خیلی بلند استفاده نکنید
 * ============================================================
 */

export default function HeroSection({ initialBanners = [] }: HeroSectionProps) {
    const [banners, setBanners] = useState<Banner[]>(initialBanners);
    const [loading, setLoading] = useState(initialBanners.length === 0);
    const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (initialBanners.length > 0) {
            setBanners(initialBanners);
            setLoading(false);
            return;
        }

        let isMounted = true;
        const fetchBanners = async () => {
            try {
                const data = await bannerService.getAll();
                if (!isMounted) return;
                setBanners(data);
            } catch (error) {
                console.error("Failed to fetch banners:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchBanners();

        return () => {
            isMounted = false;
        };
    }, [initialBanners]);

    const mainBanners = banners.filter(b => b.position === 'main-slider');
    const middleBanners = banners.filter(b => b.position === 'middle-banner').slice(0, 3);

    if (loading) {
        return (
            <section className="flex flex-col gap-3 px-3 pt-3 sm:px-4 sm:pt-4">
                {/* اسکلتون اسلایدر اصلی */}
                <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse"
                    style={{ aspectRatio: '12/5' }}
                />
                {/* اسکلتون بنرهای میانی */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="w-full rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse"
                        style={{ aspectRatio: '16/5' }}
                    />
                    <div className="w-full rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse hidden sm:block"
                        style={{ aspectRatio: '16/5' }}
                    />
                    <div className="w-full rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse hidden lg:block"
                        style={{ aspectRatio: '16/5' }}
                    />
                </div>
            </section>
        );
    }

    const handlePointerDown = (clientX: number) => {
        dragRef.current = { startX: clientX, moved: false };
    };

    const handlePointerMove = (clientX: number) => {
        if (!dragRef.current) return;
        if (Math.abs(clientX - dragRef.current.startX) > 6) {
            dragRef.current.moved = true;
        }
    };

    const handlePointerUp = (href?: string | null) => {
        const moved = dragRef.current?.moved;
        dragRef.current = null;
        const target = href && href !== "#" ? href : null;
        if (!moved && target) {
            router.push(target);
        }
    };

    return (
        <section className="flex flex-col gap-3 px-3 pt-3 sm:px-4 sm:pt-4">
            <div className="container mx-auto">
                {/* ═══════════════════════════════════════════════════
                    اسلایدر اصلی - Main Slider
                    ابعاد بنر: 1200×500 (نسبت 12:5)
                    در موبایل و دسکتاپ بدون بریدگی نمایش داده می‌شود
                   ═══════════════════════════════════════════════════ */}
                {mainBanners.length > 0 && (
                    <div className="w-full rounded-2xl overflow-hidden shadow-md bg-gray-50">
                        <Swiper
                            modules={[Autoplay, Pagination]}
                            spaceBetween={0}
                            slidesPerView={1}
                            loop={mainBanners.length > 1}
                            speed={800}
                            pagination={{
                                clickable: true,
                                bulletClass: 'swiper-pagination-bullet !w-2.5 !h-2.5 !bg-white/60 !opacity-100',
                                bulletActiveClass: '!bg-white !w-7 !rounded-full !opacity-100',
                            }}
                            autoplay={{
                                delay: 5000,
                                disableOnInteraction: false,
                                pauseOnMouseEnter: true,
                                reverseDirection: true,
                            }}
                            dir="ltr"
                            className="hero-swiper"
                        >
                            {mainBanners.map((banner) => {
                                const imageUrl = resolveImageUrl(
                                    (banner as any).image,
                                    "/placeholder-banner.png",
                                );

                                return (
                                    <SwiperSlide key={banner._id}>
                                        <div
                                            className={`relative w-full ${banner.link ? "cursor-pointer" : ""}`}
                                            style={{ aspectRatio: '12/5' }}
                                            onMouseDown={(e) => handlePointerDown(e.clientX)}
                                            onMouseMove={(e) => handlePointerMove(e.clientX)}
                                            onMouseUp={() => handlePointerUp(banner.link)}
                                            onMouseLeave={() => (dragRef.current = null)}
                                            onTouchStart={(e) => handlePointerDown(e.touches[0].clientX)}
                                            onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
                                            onTouchEnd={() => handlePointerUp(banner.link)}
                                            role={banner.link ? "button" : undefined}
                                            aria-label={banner.title || "banner"}
                                        >
                                            <Image
                                                src={imageUrl}
                                                alt={banner.title}
                                                fill
                                                className="object-cover object-center"
                                                priority
                                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 1200px"
                                            />
                                        </div>
                                    </SwiperSlide>
                                );
                            })}
                        </Swiper>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════
                    بنرهای تبلیغاتی میانی - Middle Banners
                    ابعاد بنر: 800×250 (نسبت 16:5)
                    در موبایل: تمام‌عرض - در تبلت: ۲ تا - در دسکتاپ: ۳ تا
                   ═══════════════════════════════════════════════════ */}
                {middleBanners.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                        {middleBanners.map((banner, index) => {
                            const imageUrl = resolveImageUrl(
                                (banner as any).image,
                                "/placeholder-banner.png",
                            );

                            return (
                                <div
                                    key={banner._id}
                                    className={`
                                        relative w-full rounded-xl overflow-hidden bg-gray-50
                                        shadow-sm hover:shadow-lg transition-all duration-300
                                        hover:scale-[1.02] group
                                        ${banner.link ? "cursor-pointer" : ""}
                                        ${middleBanners.length === 2 && index === 1 ? 'sm:col-span-1' : ''}
                                        ${middleBanners.length === 1 ? 'sm:col-span-2 lg:col-span-3' : ''}
                                    `}
                                    style={{ aspectRatio: '16/5' }}
                                    onClick={() => {
                                        if (banner.link && banner.link !== '#') {
                                            router.push(banner.link);
                                        }
                                    }}
                                    role={banner.link ? "button" : undefined}
                                    aria-label={banner.title || "بنر تبلیغاتی"}
                                >
                                    <Image
                                        src={imageUrl}
                                        alt={banner.title}
                                        fill
                                        className="object-cover object-center group-hover:brightness-105 transition-all duration-300"
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════
                استایل‌های سفارشی Swiper
               ═══════════════════════════════════════════════════ */}
            <style jsx global>{`
                .hero-swiper {
                    border-radius: 1rem;
                    overflow: hidden;
                }
                .hero-swiper .swiper-pagination {
                    bottom: 12px !important;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 6px;
                }
                .hero-swiper .swiper-pagination-bullet {
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255,255,255,0.4);
                }
                .hero-swiper .swiper-pagination-bullet-active {
                    width: 28px !important;
                    border-radius: 9999px !important;
                    background: white !important;
                    border-color: transparent;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
                }
            `}</style>
        </section>
    );
}
