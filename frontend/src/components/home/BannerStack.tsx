"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Banner, bannerService } from "@/services/bannerService";
import { resolveImageUrl } from "@/lib/image";

export default function BannerStack() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return null;
    }

    if (banners.length === 0) {
        return null;
    }

    return (
        <div className="container mx-auto">
            <div className="flex flex-wrap justify-center gap-2 p-4">
                {banners.map((banner) => (
                    <Link
                        key={banner._id}
                        href={banner.link || '#'}
                        className={`w-full md:w-[calc(50%-4px)] lg:w-[calc(33.333%-6px)] aspect-[4/1] md:aspect-[3/1] rounded-xl overflow-hidden bg-gray-100 relative block ${!banner.link ? 'pointer-events-none' : ''}`}
                    >
                        <div className="w-full h-full relative">
                            <Image
                                src={resolveImageUrl((banner as any).image, "/placeholder-banner.png")}
                                alt={banner.title}
                                fill
                                className="object-cover"
                            />
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
