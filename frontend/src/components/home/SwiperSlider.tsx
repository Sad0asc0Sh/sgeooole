"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/autoplay";
import ResilientImage from "@/components/ui/ResilientImage";
import { useRouter } from "next/navigation";
import { Banner } from "@/services/bannerService";
import { resolveImageUrl, generateBannerBlurPlaceholder } from "@/lib/image";
import { canNavigateToHref, navigateHref } from "@/lib/navigateHref";

type SwiperSliderProps = {
  banners: Banner[];
};

export default function SwiperSlider({ banners }: SwiperSliderProps) {
  const router = useRouter();

  return (
    <div className="relative w-full h-full">
      <Swiper
        modules={[Autoplay, Pagination]}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        loop={banners.length > 1}
        className="w-full h-full hero-swiper"
        dir="rtl"
      >
        {banners.map((banner, index) => {
          const imageUrl = resolveImageUrl(
            (banner as any).image,
            "/placeholder-banner.png"
          );
          const bannerLink = banner.link;
          const canNavigate = canNavigateToHref(bannerLink);
          const blurPlaceholder = generateBannerBlurPlaceholder(1200, 500);

          return (
            <SwiperSlide key={banner._id} className="relative w-full h-full">
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
                aria-label={canNavigate ? (banner.title || "banner") : undefined}
              >
                <ResilientImage
                  src={imageUrl}
                  alt={banner.title || "بنر تبلیغاتی"}
                  fill
                  className="object-cover object-center md:object-right"
                  loading={index === 0 ? "eager" : "lazy"}
                  priority={index === 0}
                  placeholder="blur"
                  blurDataURL={blurPlaceholder}
                  fallbackSrc="/placeholder-banner.png"
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 90vw, 1280px"
                />
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
