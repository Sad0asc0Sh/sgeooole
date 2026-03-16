"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Banner, bannerService } from "@/services/bannerService";
import { resolveImageUrl } from "@/lib/image";
import { useRouter } from "next/navigation";
import { navigateHref } from "@/lib/navigateHref";

export default function BannerStack() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        bannerService.getByPosition('middle-banner')
            .then(setBanners)
            .catch((e) => console.error("Failed to fetch middle banners:", e))
            .finally(() => setLoading(false));
    }, []);

    if (loading || banners.length === 0) return null;

    return (
        <div className="container mx-auto px-3 sm:px-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {banners.map((banner) => {
                    const hasLink = !!banner.link?.trim();
                    return (
                        <div
                            key={banner._id}
                            className={`
                                relative w-full rounded-xl overflow-hidden bg-gray-50
                                shadow-sm hover:shadow-lg transition-all duration-300
                                hover:scale-[1.02] group
                                ${hasLink ? 'cursor-pointer' : 'cursor-default'}
                            `}
                            style={{ aspectRatio: '16/5' }}
                            onClick={() => hasLink && navigateHref(router, banner.link)}
                            role={hasLink ? "button" : undefined}
                            tabIndex={hasLink ? 0 : undefined}
                            onKeyDown={(e) => {
                                if (hasLink && (e.key === 'Enter' || e.key === ' ')) {
                                    navigateHref(router, banner.link);
                                }
                            }}
                            aria-label={hasLink ? (banner.title || "بنر تبلیغاتی") : undefined}
                        >
                            <Image
                                src={resolveImageUrl((banner as any).image, "/placeholder-banner.png")}
                                alt={banner.title}
                                fill
                                className="object-cover object-center group-hover:brightness-105 transition-all duration-300 pointer-events-none"
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

