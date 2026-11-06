"use client";
import ResilientImage from "@/components/ui/ResilientImage";
import { useEffect, useState } from "react";
import { Banner, bannerService } from "@/services/bannerService";
import { resolveImageUrl } from "@/lib/image";
import { bannerAltText } from "@/lib/bannerAlt";
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
                <div className="flex flex-col md:flex-row flex-wrap justify-center items-center gap-4 w-full">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="w-full md:w-[31%] xl:w-[32%] aspect-[16/5] rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer"
                            style={{ backgroundSize: '200% 100%' }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row flex-wrap justify-center items-center gap-4 w-full">
                {banners.map((banner) => {
                    const hasLink = !!banner.link?.trim();
                    // نسخه‌ی کارت سبک برای بنرهای میانی + fallback به نسخه‌ی کامل
                    const cardUrl =
                        banner.image && typeof banner.image === "object"
                            ? (banner.image as { cardUrl?: string }).cardUrl
                            : undefined;
                    const imgSrc = resolveImageUrl(
                        cardUrl ? { url: cardUrl } : banner.image,
                        "/placeholder-banner.png"
                    );
                    const backupSrc = resolveImageUrl(banner.image, "");
                    return (
                        <div
                            key={banner._id}
                            className={`
                                relative w-full md:w-[31%] xl:w-[32%] aspect-[16/5] rounded-xl overflow-hidden bg-gray-50
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
                                    src={imgSrc}
                                    backupSrc={backupSrc && backupSrc !== imgSrc ? backupSrc : undefined}
                                    alt={bannerAltText(banner, "بنر تبلیغاتی ای کا جی کالا")}
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
