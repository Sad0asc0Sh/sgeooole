"use client";
import { useEffect, useState } from "react";
import ResilientImage from "@/components/ui/ResilientImage";
import { Banner, bannerService } from "@/services/bannerService";
import { resolveImageUrl, generateBannerBlurPlaceholder } from "@/lib/image";
import { useRouter } from "next/navigation";
import { canNavigateToHref, navigateHref } from "@/lib/navigateHref";
import dynamic from "next/dynamic";

// Lazy load Swiper component — no SSR, loads after hydration
const SwiperSlider = dynamic(() => import("./SwiperSlider"), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-[16/9] sm:aspect-[21/9] bg-gray-100 animate-pulse rounded-2xl" />
  ),
});

type HeroSectionProps = {
  initialBanners?: Banner[];
};

/**
 * ============================================================
 *  Hero Banner Section - Modern E-commerce Layout
 * ============================================================
 *
 *  Layout Architecture:
 *  - Container: max-w-7xl with horizontal padding
 *  - Aspect Ratios: Mobile 16:9, Desktop 21:9 (ultrawide)
 *  - Border Radius: rounded-2xl with overflow-hidden
 *  - Top Margin: mt-4 for header separation
 *
 *  Image Handling:
 *  - Next.js Image with fill + object-fit: cover
 *  - Strict aspect ratio enforcement prevents vertical stretch
 *  - No fixed heights — responsive by design
 *
 *  Performance:
 *  - LCP optimized with priority loading on first banner
 *  - Swiper lazy-loaded client-side
 * ============================================================
 */

export default function HeroSection({ initialBanners = [] }: HeroSectionProps) {
  const [banners, setBanners] = useState<Banner[]>(initialBanners);
  const [loading, setLoading] = useState(initialBanners.length === 0);
  const router = useRouter();

  // Fetch banners on mount if not provided
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

  // Get main sliders and middle banners
  const mainBanners = banners
    .filter((b) => b.position === "main-slider")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const middleBanners = banners
    .filter((b) => b.position === "middle-banner")
    .slice(0, 3);

  if (loading) {
    return (
      <section className="w-full max-w-7xl mx-auto px-4 mt-4">
        <div className="w-full aspect-[16/9] sm:aspect-[21/9] bg-gray-200 animate-pulse rounded-2xl mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-full aspect-[16/5] bg-gray-200 animate-pulse rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!mainBanners || mainBanners.length === 0) {
    return null;
  }

  // First slide (LCP element - SSR)
  const firstBanner = mainBanners[0];

  return (
    <section className="w-full max-w-7xl mx-auto px-4 mt-4">
      {/* === Single Banner: SSR Only === */}
      {mainBanners.length === 1 && firstBanner && (
        <div
          className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-2xl overflow-hidden bg-gray-50 shadow-md mb-4"
        >
          {(() => {
            const imageUrl = resolveImageUrl(
              (firstBanner as any).image,
              "/placeholder-banner.png"
            );
            const bannerLink = firstBanner.link;
            const canNavigate = canNavigateToHref(bannerLink);
            const blurPlaceholder = generateBannerBlurPlaceholder(1200, 500);

            return (
              <div
                className={`absolute inset-0 ${canNavigate ? "cursor-pointer" : ""}`}
                onClick={() => canNavigate && navigateHref(router, bannerLink)}
                role={canNavigate ? "button" : undefined}
                tabIndex={canNavigate ? 0 : undefined}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && canNavigate) {
                    navigateHref(router, bannerLink);
                  }
                }}
                aria-label={canNavigate ? (firstBanner.title || "banner") : undefined}
              >
                <ResilientImage
                  src={imageUrl}
                  alt={firstBanner.title || "بنر اصلی"}
                  fill
                  style={{ objectFit: "cover", objectPosition: "center" }}
                  priority
                  fetchPriority="high"
                  loading="eager"
                  placeholder="blur"
                  blurDataURL={blurPlaceholder}
                  fallbackSrc="/placeholder-banner.png"
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 90vw, 1280px"
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* === Multiple Banners: LCP first + Swiper for all === */}
      {mainBanners.length > 1 && (
        <div className="mb-4">
          <SwiperSlider banners={mainBanners} />
        </div>
      )}

      {/* Middle Banners Grid */}
      {middleBanners.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {middleBanners.map((banner, index) => {
            const imageUrl = resolveImageUrl(
              (banner as any).image,
              "/placeholder-banner.png"
            );
            const bannerLink = banner.link;
            const hasLink = !!bannerLink?.trim();
            const blurPlaceholder = generateBannerBlurPlaceholder(800, 250);

            return (
              <div
                key={banner._id}
                className={`
                  relative w-full aspect-[16/5] rounded-xl overflow-hidden bg-gray-50
                  shadow-md hover:shadow-lg transition-all duration-300
                  hover:scale-[1.02] group
                  ${hasLink ? "cursor-pointer" : "cursor-default"}
                  ${middleBanners.length === 2 && index === 1 ? "sm:col-span-1" : ""}
                  ${middleBanners.length === 1 ? "sm:col-span-2 lg:col-span-3" : ""}
                `}
                onClick={() => hasLink && navigateHref(router, bannerLink)}
                role={hasLink ? "button" : undefined}
                tabIndex={hasLink ? 0 : undefined}
                onKeyDown={(e) => {
                  if (hasLink && (e.key === "Enter" || e.key === " ")) {
                    navigateHref(router, bannerLink);
                  }
                }}
                aria-label={hasLink ? (banner.title || "بنر تبلیغاتی") : undefined}
              >
                <div className="absolute inset-0">
                  <ResilientImage
                    src={imageUrl}
                    alt={banner.title || "بنر تبلیغاتی"}
                    fill
                    style={{ objectFit: "cover", objectPosition: "center" }}
                    className="group-hover:brightness-105 transition-all duration-300"
                    loading="lazy"
                    placeholder="blur"
                    blurDataURL={blurPlaceholder}
                    fallbackSrc="/placeholder-banner.png"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
