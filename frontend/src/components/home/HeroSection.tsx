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
import { canNavigateToHref, navigateHref } from "@/lib/navigateHref";

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

    const mainBanners = banners
        .filter(b => b.position === 'main-slider')
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const middleBanners = banners.filter(b => b.position === 'middle-banner').slice(0, 3);

    if (loading) {
        return (
            <section className="flex flex-col gap-3 px-3 pt-3 sm:px-4 sm:pt-4">
                <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse"
                    style={{ aspectRatio: '12/5' }}
                />
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
        if (!moved && canNavigateToHref(href)) {
            navigateHref(router, href);
        }
    };

    return (
        <section className="flex flex-col gap-3 px-3 pt-3 sm:px-4 sm:pt-4">
            <div className="container mx-auto">
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
                            }}
                            dir="rtl"
                            className="hero-swiper"
                        >
                            {mainBanners.map((banner) => {
                                const imageUrl = resolveImageUrl(
                                    (banner as any).image,
                                    "/placeholder-banner.png",
                                );
                                const bannerLink = banner.link;
                                const canNavigate = canNavigateToHref(bannerLink);

                                return (
                                    <SwiperSlide key={banner._id}>
                                        <div
                                            className={`relative w-full ${canNavigate ? "cursor-pointer" : ""}`}
                                            style={{}}
                                            onMouseDown={(e) => handlePointerDown(e.clientX)}
                                            onMouseMove={(e) => handlePointerMove(e.clientX)}
                                            onMouseUp={() => handlePointerUp(bannerLink)}
                                            onMouseLeave={() => (dragRef.current = null)}
                                            onTouchStart={(e) => handlePointerDown(e.touches[0].clientX)}
                                            onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
                                            onTouchEnd={() => handlePointerUp(bannerLink)}
                                            role={canNavigate ? "button" : undefined}
                                            tabIndex={canNavigate ? 0 : undefined}
                                            onKeyDown={(e) => {
                                                if ((e.key === 'Enter' || e.key === ' ') && canNavigate) {
                                                    navigateHref(router, bannerLink);
                                                }
                                            }}
                                            aria-label={canNavigate ? (banner.title || "banner") : undefined}
                                        >
                                            <Image
                                                src={imageUrl}
                                                alt={banner.title}
                                                width={typeof (banner as any).image === 'object' && (banner as any).image?.width ? (banner as any).image.width : 1200}
                                                height={typeof (banner as any).image === 'object' && (banner as any).image?.height ? (banner as any).image.height : 500}
                                                className="w-full h-auto pointer-events-none"
                                                priority
                                            />
                                        </div>
                                    </SwiperSlide>
                                );
                            })}
                        </Swiper>
                    </div>
                )}

                {middleBanners.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                        {middleBanners.map((banner, index) => {
                            const imageUrl = resolveImageUrl(
                                (banner as any).image,
                                "/placeholder-banner.png",
                            );
                            const bannerLink = banner.link;
                            const hasLink = !!bannerLink?.trim();

                            return (
                                <div
                                    key={banner._id}
                                    className={`
                                        relative w-full rounded-xl overflow-hidden bg-gray-50
                                        shadow-sm hover:shadow-lg transition-all duration-300
                                        hover:scale-[1.02] group
                                        ${hasLink ? 'cursor-pointer' : 'cursor-default'}
                                        ${middleBanners.length === 2 && index === 1 ? 'sm:col-span-1' : ''}
                                        ${middleBanners.length === 1 ? 'sm:col-span-2 lg:col-span-3' : ''}
                                    `}
                                    style={{}}
                                    onClick={() => hasLink && navigateHref(router, bannerLink)}
                                    role={hasLink ? "button" : undefined}
                                    tabIndex={hasLink ? 0 : undefined}
                                    onKeyDown={(e) => {
                                        if (hasLink && (e.key === 'Enter' || e.key === ' ')) {
                                            navigateHref(router, bannerLink);
                                        }
                                    }}
                                    aria-label={hasLink ? (banner.title || "بنر تبلیغاتی") : undefined}
                                >
                                    <Image
                                        src={imageUrl}
                                        alt={banner.title}
                                        width={typeof (banner as any).image === 'object' && (banner as any).image?.width ? (banner as any).image.width : 800}
                                        height={typeof (banner as any).image === 'object' && (banner as any).image?.height ? (banner as any).image.height : 250}
                                        className="w-full h-auto group-hover:brightness-105 transition-all duration-300 pointer-events-none"
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
