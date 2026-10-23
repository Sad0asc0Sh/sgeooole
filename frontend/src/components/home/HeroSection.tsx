"use client";

import { useEffect, useState } from "react";
import ResilientImage from "@/components/ui/ResilientImage";
import HeroBannerImage from "./HeroBannerImage";
import HeroBannerLink from "./HeroBannerLink";
import SwiperSlider from "./SwiperSlider";
import { Banner, bannerService } from "@/services/bannerService";
import { resolveImageUrl, generateBannerBlurPlaceholder } from "@/lib/image";
import { useRouter } from "next/navigation";
import { canNavigateToHref, navigateHref } from "@/lib/navigateHref";

type HeroSectionProps = {
  initialBanners?: Banner[];
};

/**
 * ============================================================
 *  Hero Banner Section — Art-Directed Responsive Hero
 * ============================================================
 *
 *  Desktop: 1911 × 430  → 22.5013% of width (4.444 : 1)
 *  Mobile : 360  × 260  → 72.2222% of width (1.385 : 1)
 *
 *  - دو تصویر مستقل (دسکتاپ/موبایل) با <picture> و source media
 *  - بدون ارتفاع ثابت؛ ارتفاع همیشه از نسبت تصویر می‌آید (بدون CLS)
 *  - تصویر اول eager + fetchPriority=high برای LCP
 *  - اسلایدر: autoplay 6s، توقف روی hover، کنترل‌های سفارشی
 * ============================================================
 */

export default function HeroSection({ initialBanners = [] }: HeroSectionProps) {
  const [banners, setBanners] = useState<Banner[]>(initialBanners);
  const [loading, setLoading] = useState(initialBanners.length === 0);
  const router = useRouter();

  const heroContainerClass = "w-full max-w-[1920px] mx-auto";
  const heroFrameClass =
    "relative w-full aspect-[360/260] md:aspect-[1911/430] overflow-hidden bg-ekg-950 mt-4 md:mt-5";

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
    .filter((b) => b.position === "main-slider")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const middleBanners = banners
    .filter((b) => b.position === "middle-banner")
    .slice(0, 3);

  if (loading) {
    return (
      <section className={heroContainerClass} aria-busy="true">
        <div className="mb-4 animate-pulse">
          <div className={heroFrameClass}>
            <div className="absolute inset-0 bg-gradient-to-r from-ekg-200 via-ekg-100 to-ekg-200" />
          </div>
        </div>
        <div className="flex flex-col md:flex-row flex-wrap justify-center items-center gap-4 px-2 md:px-4">
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

  if (mainBanners.length === 0) {
    return null;
  }

  const firstBanner = mainBanners[0];
  const firstImage =
    firstBanner && typeof firstBanner.image === "object" && firstBanner.image
      ? firstBanner.image
      : null;
  const firstMobileImage =
    firstBanner && typeof firstBanner.mobileImage === "object" && firstBanner.mobileImage
      ? firstBanner.mobileImage
      : null;

  return (
    <section className={heroContainerClass} aria-label="بنرهای اصلی فروشگاه">
      {/* === Single Banner: SSR picture, no slider overhead === */}
      {mainBanners.length === 1 && firstBanner ? (
        <div className={heroFrameClass}>
          <HeroBannerLink banner={firstBanner}>
            <HeroBannerImage
              src={resolveImageUrl(firstBanner.image, "/placeholder.svg")}
              mobileSrc={resolveImageUrl(firstBanner.mobileImage, "") || null}
              alt={firstBanner.alt || firstBanner.title || "بنر اصلی"}
              width={firstImage?.width}
              height={firstImage?.height}
              mobileWidth={firstMobileImage?.width}
              mobileHeight={firstMobileImage?.height}
              priority
              fit={firstBanner.fit === "contain" ? "contain" : "cover"}
            />
          </HeroBannerLink>
        </div>
      ) : null}

      {/* === Multiple Banners: art-directed Swiper === */}
      {mainBanners.length > 1 ? (
        <div className={heroFrameClass}>
          <SwiperSlider banners={mainBanners} />
        </div>
      ) : null}

      {/* Middle banners — unchanged responsive 16:5 layout */}
      {middleBanners.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-4 px-2 md:px-4 pt-4 pb-1">
          {middleBanners.map((banner) => {
            const imageUrl = resolveImageUrl(banner.image, "/placeholder.svg");
            const bannerLink = banner.link;
            const hasLink = canNavigateToHref(bannerLink);
            const blurPlaceholder = generateBannerBlurPlaceholder(800, 250);
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
                aria-label={hasLink ? banner.alt || banner.title || "بنر تبلیغاتی" : undefined}
              >
                <div className="absolute inset-0">
                  <ResilientImage
                    src={imageUrl}
                    alt={banner.alt || banner.title || "بنر تبلیغاتی"}
                    fill
                    style={{ objectFit: "cover", objectPosition: "center" }}
                    className="group-hover:brightness-105 transition-all duration-300"
                    loading="lazy"
                    placeholder="blur"
                    blurDataURL={blurPlaceholder}
                    fallbackSrc="/placeholder.svg"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
