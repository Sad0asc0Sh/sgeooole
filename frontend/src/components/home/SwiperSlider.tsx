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
    <Swiper
      modules={[Autoplay, Pagination]}
      autoplay={{ delay: 4000, disableOnInteraction: false }}
      pagination={{ clickable: true }}
      loop={banners.length > 1}
      className="w-full rounded-xl overflow-hidden"
      dir="rtl"
    >
      {banners.map((banner, index) => {
        const imageUrl = resolveImageUrl(
          (banner as any).image,
          "/placeholder-banner.png"
        );
        const bannerLink = banner.link;
        const canNavigate = canNavigateToHref(bannerLink);
        const width =
          typeof (banner as any).image === "object" && (banner as any).image?.width
            ? (banner as any).image.width
            : 1200;
        const height =
          typeof (banner as any).image === "object" && (banner as any).image?.height
            ? (banner as any).image.height
            : 500;
        const blurPlaceholder = generateBannerBlurPlaceholder(width, height);

        return (
          <SwiperSlide key={banner._id}>
            <div
              className={`relative w-full ${canNavigate ? "cursor-pointer" : ""}`}
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
                width={width}
                height={height}
                className="w-full h-auto object-cover"
                loading={index === 0 ? "eager" : "lazy"}
                priority={index === 0}
                placeholder="blur"
                blurDataURL={blurPlaceholder}
                fallbackSrc="/placeholder-banner.png"
              />
            </div>
          </SwiperSlide>
        );
      })}
    </Swiper>
  );
}
