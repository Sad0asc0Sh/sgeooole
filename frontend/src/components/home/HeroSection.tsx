"use client";
import { useEffect, useState } from "react";
import ResilientImage from "@/components/ui/ResilientImage";
import { Banner, bannerService } from "@/services/bannerService";
import { resolveImageUrl, generateBannerBlurPlaceholder } from "@/lib/image";
import { useRouter } from "next/navigation";
import { canNavigateToHref, navigateHref } from "@/lib/navigateHref";
import dynamic from "next/dynamic";

// Swiper v12 is SSR-compatible: server-render the slider so the hero (LCP,
// above-the-fold) is present in the initial HTML for crawlers.
// (Phase 2 SEO: previously ssr:false forced a client-only hero.)
const SwiperSlider = dynamic(() => import("./SwiperSlider"), {
  loading: () => (
    <div className="w-full h-full bg-gray-100 animate-pulse" />
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
  const heroContainerClass = "w-[96%] md:w-[98%] max-w-screen-2xl mx-auto px-2 md:px-4";
  // IMPORTANT: strict wrapper classes must remain EXACTLY as specified
  const heroFrameClass =
    "relative w-full aspect-[21/9] md:aspect-[4/1] rounded-2xl overflow-hidden mt-4";
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
      <section className={heroContainerClass}>
        <div className="mb-4 animate-pulse">
          <div className={heroFrameClass}>
            <div className="absolute inset-0 bg-gray-200" />
          </div>
        </div>
        <div className="flex flex-col md:flex-row flex-wrap justify-center items-center gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-full md:w-[31%] xl:w-[32%] aspect-[16/5] bg-gray-200 animate-pulse rounded-xl"
            />
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
    <section className={heroContainerClass}>
      {/* === Single Banner: SSR Only === */}
      {mainBanners.length === 1 && firstBanner && (
        <div className="mb-4">
          <div className={heroFrameClass}>
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
                    className="object-cover object-center"
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
        </div>
      )}

      {/* === Multiple Banners: LCP first + Swiper for all === */}
      {mainBanners.length > 1 && (
        <div className="mb-4">
          <div className={heroFrameClass}>
            <SwiperSlider banners={mainBanners} />
          </div>
        </div>
      )}

      {/* Middle Banners — Flex, centered, responsive by count */}
      {middleBanners.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4 pb-1">
          {middleBanners.map((banner) => {
            const imageUrl = resolveImageUrl(
              (banner as any).image,
              "/placeholder-banner.png"
            );
            const bannerLink = banner.link;
            const hasLink = !!bannerLink?.trim();
            const blurPlaceholder = generateBannerBlurPlaceholder(800, 250);

            // Width per screen size, based on total count:
            // Mobile  : always full-width (stacked vertically)
            // Tablet  : 50% per banner for 2+  (2 per row, last centered if 1 remains)
            // Desktop : 33.33% per banner for 3 (all 3 in one row, centered)
            const widthClass = "w-full md:w-[31%] xl:w-[32%]";

            return (
              <div
                key={banner._id}
                className={`
                  relative aspect-[16/5] rounded-xl overflow-hidden bg-ekg-50
                  shadow-sm hover:shadow-md transition-all duration-300
                  hover:scale-[1.01] group
                  ${widthClass}
                  ${hasLink ? "cursor-pointer" : "cursor-default"}
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
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
