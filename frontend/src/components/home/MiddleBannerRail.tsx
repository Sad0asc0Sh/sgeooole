"use client";

import { useEffect, useMemo, useState } from "react";
import ResilientImage from "@/components/ui/ResilientImage";
import HeroBannerLink from "./HeroBannerLink";
import { Banner, bannerService } from "@/services/bannerService";
import { generateBannerBlurPlaceholder, resolveImageUrl } from "@/lib/image";
import { bannerAltText } from "@/lib/bannerAlt";

type MiddleBannerRailProps = {
  /** Active banners fetched by the homepage server component. */
  initialBanners?: Banner[];
};

/**
 * The three `middle-banner` creatives.
 *
 * They used to sit inside HeroSection directly under the main slider. The
 * homepage now places them *below* the timed offers, so this component owns
 * the row (including its own client-side recovery when the server fetch was
 * empty) and keeps the same 16:5 creative contract.
 */
export default function MiddleBannerRail({
  initialBanners = [],
}: MiddleBannerRailProps) {
  const [banners, setBanners] = useState<Banner[]>(initialBanners);
  const [loading, setLoading] = useState(initialBanners.length === 0);

  useEffect(() => {
    if (initialBanners.length > 0) {
      setBanners(initialBanners);
      setLoading(false);
      return;
    }

    let isMounted = true;
    bannerService
      .getByPosition("middle-banner")
      .then((data) => {
        if (isMounted) setBanners(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error("Failed to fetch middle banners:", error);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialBanners]);

  const middleBanners = useMemo(
    () =>
      banners
        .filter((banner) => banner.position === "middle-banner")
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .slice(0, 3),
    [banners]
  );

  if (loading) {
    return (
      <section
        className="w-full bg-white"
        aria-busy="true"
        aria-label="در حال بارگذاری بنرهای تبلیغاتی"
      >
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col items-center gap-3 px-4 py-4 md:flex-row md:justify-center md:gap-4 md:py-5">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="aspect-[16/5] w-full animate-pulse rounded-2xl border border-ekg-100 bg-gradient-to-r from-ekg-100 via-ekg-50 to-ekg-100 md:w-[31%] xl:w-[32%]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (middleBanners.length === 0) {
    return null;
  }

  return (
    <section className="w-full bg-white" aria-label="بنرهای تبلیغاتی میانی">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col items-center gap-3 px-4 py-4 md:flex-row md:justify-center md:gap-4 md:py-5">
        {middleBanners.map((banner) => {
          const imageUrl = resolveImageUrl(banner.image, "/placeholder.svg");
          const label = bannerAltText(banner, "بنر تبلیغاتی ای کا جی کالا");

          return (
            <div
              key={banner._id}
              className="group relative aspect-[16/5] w-full overflow-hidden rounded-2xl border border-ekg-200/60 bg-ekg-50 shadow-sm transition-shadow duration-300 hover:shadow-[0_18px_40px_-30px_rgba(28,25,23,0.55)] md:w-[31%] xl:w-[32%]"
            >
              <HeroBannerLink banner={banner} className="absolute inset-0 block">
                <ResilientImage
                  src={imageUrl}
                  alt={label}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 32vw"
                  quality={80}
                  loading="lazy"
                  placeholder="blur"
                  blurDataURL={generateBannerBlurPlaceholder(800, 250)}
                  fallbackSrc="/placeholder.svg"
                  wrapperClassName="absolute inset-0"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.015]"
                />
              </HeroBannerLink>
            </div>
          );
        })}
      </div>
    </section>
  );
}
