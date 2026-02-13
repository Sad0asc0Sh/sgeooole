"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Banner, bannerService } from "@/services/bannerService";
import { resolveImageUrl } from "@/lib/image";
import { useRouter } from "next/navigation";

/**
 * بنرهای تبلیغاتی میانی
 * ابعاد ایده‌آل: 800×250 پیکسل (نسبت 16:5)
 */
export default function BannerStack() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                const data = await bannerService.getByPosition('middle-banner');
                setBanners(data);
            } catch (error) {
                console.error("Failed to fetch middle banners:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBanners();
    }, []);

    if (loading || banners.length === 0) {
        return null;
    }

    return (
        <div className="container mx-auto px-3 sm:px-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {banners.map((banner) => (
                    <div
                        key={banner._id}
                        className={`
                            relative w-full rounded-xl overflow-hidden bg-gray-50
                            shadow-sm hover:shadow-lg transition-all duration-300
                            hover:scale-[1.02] group
                            ${banner.link ? 'cursor-pointer' : ''}
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
                            src={resolveImageUrl((banner as any).image, "/placeholder-banner.png")}
                            alt={banner.title}
                            fill
                            className="object-cover object-center group-hover:brightness-105 transition-all duration-300"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
