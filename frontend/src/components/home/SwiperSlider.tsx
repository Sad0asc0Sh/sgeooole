"use client";

import { useCallback, useMemo, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, A11y, Keyboard } from "swiper/modules";
import type { Swiper as SwiperClass } from "swiper";
import "swiper/css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import HeroBannerImage from "./HeroBannerImage";
import HeroBannerLink from "./HeroBannerLink";
import { resolveImageUrl } from "@/lib/image";
import type { Banner } from "@/services/bannerService";

type SwiperSliderProps = {
  banners: Banner[];
};

export default function SwiperSlider({ banners }: SwiperSliderProps) {
  const [swiper, setSwiper] = useState<SwiperClass | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const slides = useMemo(() => banners.filter(Boolean), [banners]);
  // Swiper's loop mode needs enough slides to build its duplicate ring.
  // With only two slides it can start on the duplicated last slide, so use
  // rewind instead (same UX: continuous rotation, correct first slide).
  const useLoop = slides.length > 2;

  const goTo = useCallback(
    (index: number) => {
      if (!swiper) return;
      if (useLoop) swiper.slideToLoop(index);
      else swiper.slideTo(index);
      setActiveIndex(index);
    },
    [swiper, useLoop]
  );

  if (slides.length === 0) return null;

  return (
    <div className="relative h-full w-full">
      <Swiper
        modules={[Autoplay, A11y, Keyboard]}
        onSwiper={setSwiper}
        onSlideChange={(instance) => setActiveIndex(instance.realIndex)}
        initialSlide={0}
        loop={useLoop}
        rewind={!useLoop && slides.length > 1}
        speed={700}
        slidesPerView={1}
        spaceBetween={0}
        autoplay={
          slides.length > 1
            ? {
                delay: 6000,
                disableOnInteraction: false,
                pauseOnMouseEnter: true,
              }
            : false
        }
        keyboard={{ enabled: true }}
        a11y={{
          enabled: true,
          prevSlideMessage: "اسلاید قبلی",
          nextSlideMessage: "اسلاید بعدی",
          firstSlideMessage: "اولین اسلاید",
          lastSlideMessage: "آخرین اسلاید",
        }}
        dir="rtl"
        className="hero-swiper h-full w-full"
      >
        {slides.map((banner, index) => {
          const src = resolveImageUrl(banner.image, "");
          const mobileSrc = resolveImageUrl(banner.mobileImage, "");
          if (!src) return null;

          return (
            <SwiperSlide key={banner._id} className="relative h-full w-full">
              <HeroBannerLink banner={banner}>
                <HeroBannerImage
                  src={src}
                  mobileSrc={mobileSrc || null}
                  alt={banner.alt || banner.title || "بنر اصلی"}
                  width={banner.image && typeof banner.image === "object" ? banner.image.width : undefined}
                  height={banner.image && typeof banner.image === "object" ? banner.image.height : undefined}
                  mobileWidth={
                    banner.mobileImage && typeof banner.mobileImage === "object"
                      ? banner.mobileImage.width
                      : undefined
                  }
                  mobileHeight={
                    banner.mobileImage && typeof banner.mobileImage === "object"
                      ? banner.mobileImage.height
                      : undefined
                  }
                  priority={index === 0}
                  fit={banner.fit === "contain" ? "contain" : "cover"}
                />
              </HeroBannerLink>
            </SwiperSlide>
          );
        })}
      </Swiper>

      {slides.length > 1 ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-black/40 via-black/10 to-transparent"
          />

          <div className="absolute bottom-3 end-3 z-20 flex items-center gap-2 rounded-full bg-black/25 px-3 py-2 backdrop-blur-md md:bottom-5 md:end-6">
            {slides.map((banner, index) => (
              <button
                key={banner._id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`رفتن به اسلاید ${index + 1}`}
                aria-current={activeIndex === index ? "true" : undefined}
                className={`h-2 rounded-full transition-all duration-300 ${
                  activeIndex === index
                    ? "w-7 bg-white"
                    : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>

          <div className="absolute bottom-3 start-3 z-20 hidden items-center gap-2 md:bottom-5 md:start-6 md:flex">
            <button
              type="button"
              onClick={() => swiper?.slidePrev()}
              aria-label="اسلاید قبلی"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/30"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => swiper?.slideNext()}
              aria-label="اسلاید بعدی"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/30"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
