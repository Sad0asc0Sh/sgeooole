"use client";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/autoplay";
import "swiper/css/pagination";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Banner, bannerService } from "@/services/bannerService";
import { resolveImageUrl } from "@/lib/image";
import { useRouter } from "next/navigation";

type HeroSectionProps = {
    initialBanners?: Banner[];
};

export default function HeroSection({ initialBanners = [] }: HeroSectionProps) {
    const [banners, setBanners] = useState<Banner[]>(initialBanners);
    const [loading, setLoading] = useState(initialBanners.length === 0);
    const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);
    const router = useRouter();

    useEffect(() => {
        // If we already have banners from the server, skip fetching.
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
            <section className="flex flex-col gap-2 p-4 animate-pulse">
                <div className="w-full aspect-[2/1] bg-gray-200 rounded-2xl"></div>
                <div className="grid grid-cols-1 gap-2">
                    <div className="w-full aspect-[4/1] bg-gray-200 rounded-xl"></div>
                    <div className="w-full aspect-[4/1] bg-gray-200 rounded-xl"></div>
                    <div className="w-full aspect-[4/1] bg-gray-200 rounded-xl"></div>
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
        <section className="flex flex-col gap-2 p-4">
            <div className="container mx-auto">
                {/* Main Slider - standard autoplay with 3s pause */}
                {mainBanners.length > 0 && (
                    <div className="w-full rounded-2xl overflow-hidden shadow-sm md:h-[400px] lg:h-[450px]">
                        <Swiper
                            modules={[Autoplay, Pagination]}
                            spaceBetween={10}
                            slidesPerView={1}
                            loop={true}
                            speed={800}
                            pagination={{ clickable: true }}
                            autoplay={{
                                delay: 5000,
                                disableOnInteraction: false,
                                pauseOnMouseEnter: true,
                                reverseDirection: true,
                            }}
                            className="w-full aspect-[2/1] md:h-full"
                            dir="ltr"
                        >
                            {mainBanners.map((banner) => {
                                const imageUrl = resolveImageUrl(
                                    (banner as any).image,
                                    "/placeholder-banner.png",
                                );

                                return (
                                    <SwiperSlide
                                        key={banner._id}
                                        className="relative w-full h-full bg-gray-200"
                                    >
                                        <div
                                            className={`w-full h-full relative ${banner.link ? "cursor-pointer" : ""}`}
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
                                                className="object-cover"
                                                priority
                                            />
                                        </div>
                                    </SwiperSlide>
                                );
                            })}
                        </Swiper>
                    </div>
                )}

                {/* Static Banners (Middle Banners) */}
                {middleBanners.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                        {middleBanners.map((banner) => {
                            const imageUrl = resolveImageUrl(
                                (banner as any).image,
                                "/placeholder-banner.png",
                            );

                            return (
                                <Link
                                    key={banner._id}
                                    href={banner.link || "#"}
                                    className={`w-full md:w-[calc(50%-4px)] lg:w-[calc(33.333%-6px)] aspect-[4/1] md:aspect-[3/1] rounded-xl overflow-hidden bg-gray-100 relative block ${!banner.link ? "pointer-events-none" : ""
                                        }`}
                                >
                                    <div className="w-full h-full relative">
                                        <Image
                                            src={imageUrl}
                                            alt={banner.title}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
