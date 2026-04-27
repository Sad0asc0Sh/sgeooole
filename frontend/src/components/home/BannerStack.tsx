"use client";
import ResilientImage from "@/components/ui/ResilientImage";
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

    if (banners.length === 0 && !loading) return null;

    if (loading) {
        return (
            <div className="w-full max-w-7xl mx-auto px-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="w-full aspect-[16/5] rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer"
                            style={{ backgroundSize: '200% 100%' }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {banners.map((banner) => {
                    const hasLink = !!banner.link?.trim();
                    return (
                        <div
                            key={banner._id}
                            className={`
                                relative w-full aspect-[16/5] rounded-xl overflow-hidden bg-gray-50
                                shadow-md hover:shadow-lg transition-all duration-300
                                hover:scale-[1.02] group
                                ${hasLink ? 'cursor-pointer' : 'cursor-default'}
                            `}
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
                            <div className="absolute inset-0">
                                <ResilientImage
                                    src={resolveImageUrl((banner as any).image, "/placeholder-banner.png")}
                                    alt={banner.title}
                                    fill
                                    style={{ objectFit: "cover", objectPosition: "center" }}
                                    className="group-hover:brightness-105 transition-all duration-300 pointer-events-none"
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    fallbackSrc="/placeholder-banner.png"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
