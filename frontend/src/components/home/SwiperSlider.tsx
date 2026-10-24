"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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

type RingSlide = {
  banner: Banner;
  realIndex: number;
  copy: number;
  ringIndex: number;
  isClone: boolean;
};

/**
 * اسلایدر بنر اصلی — مکانیزم مشابه دیجی‌کالا
 *
 * موبایل (زیر ۷۶۸px):
 *   - slidesPerView 1.1 و centeredSlides → اسلاید فعال ۳۸۸px در صفحهٔ ۴۲۸px
 *     (۲۰px از هر طرف بیرون می‌ماند و ۲۰px از اسلایدهای کنار دیده می‌شود)
 *   - فاصلهٔ ۸px، گوشهٔ ۸px، ارتفاع ثابت ۱۸۰px (از فریم والد)
 *   - بدون فلش و نقطه؛ فقط swipe + چرخش خودکار ۵ ثانیه‌ای
 *   - لوپ بی‌نهایت با انیمیشن ۵۰۰ms
 *
 * دسکتاپ (۷۶۸px به بالا):
 *   - یک اسلاید تمام‌عرض (نسبت 1911/430) با همان زمان‌بندی
 *   - فلش‌ها و نقطه‌های سفارشی
 *
 * چرا حلقهٔ دستی چندنسخه‌ای؟
 *   Swiper 12 در حالت loop با `centeredSlides` و `slidesPerView: 1.1` در RTL
 *   اسلایدها را بازچینش می‌کند و اسلایدهای کنارِ سمت چپ را از دست می‌دهد
 *   (در ۴ اسلاید، فقط پیک سمت راست دیده می‌شد).
 *
 *   یک رینگ تک‌کلونی هم مشکل دیگری داشت: در swipe سریع، کاربر به کلون انتهایی
 *   می‌رسید و چون اسلایدی بعد از آن نبود، «انتهای بنرها» (فضای خالی) دیده
 *   می‌شد تا پرش بعد از پایان انیمیشن انجام شود. راه‌حل: چند نسخه از کل
 *   اسلایدها رندر می‌شود (۳ نسخه، برای ۲ اسلاید ۵ نسخه) و همیشه در نسخهٔ
 *   میانی شروع می‌کنیم. به‌محض اینکه اسلاید فعال از نسخهٔ میانی خارج شد،
 *   با speed=0 به اسلاید هم‌شکل در نسخهٔ میانی برمی‌گردیم. بنابراین در هر
 *   لحظه چند اسلاید پشت و جلوی فعال وجود دارد و فضای خالی/انتهای رینگ
 *   هرگز دیده نمی‌شود؛ حتی در swipeهای پشت‌سرهم و سریع.
 */
export default function SwiperSlider({ banners }: SwiperSliderProps) {
  const [swiper, setSwiper] = useState<SwiperClass | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const jumpingRef = useRef(false);

  const slides = useMemo(() => banners.filter(Boolean), [banners]);
  const slideCount = slides.length;
  // با ۲ اسلاید، ۵ نسخه تا هنگام swipe سریع هم فضای خالی دیده نشود.
  const copies = slideCount <= 2 ? 5 : 3;
  const middleCopy = Math.floor(copies / 2);
  const middleStart = middleCopy * slideCount;

  const ring = useMemo<RingSlide[]>(() => {
    if (slideCount === 0) return [];
    if (slideCount === 1) {
      return [{ banner: slides[0], realIndex: 0, copy: 0, ringIndex: 0, isClone: false }];
    }

    const items: RingSlide[] = [];
    for (let copy = 0; copy < copies; copy += 1) {
      slides.forEach((banner, realIndex) => {
        items.push({
          banner,
          realIndex,
          copy,
          ringIndex: copy * slideCount + realIndex,
          isClone: copy !== middleCopy,
        });
      });
    }
    return items;
  }, [slides, slideCount, copies, middleCopy]);

  // بدون loop خود Swiper؛ حلقه را رینگ چندنسخه‌ای می‌سازد.
  const initialSlide = slideCount > 1 ? middleStart : 0;

  const goTo = useCallback(
    (realIndex: number) => {
      if (!swiper) return;
      if (slideCount < 2) {
        swiper.slideTo(0);
      } else {
        // نزدیک‌ترین نسخه از همان اسلاید واقعی در نسخهٔ فعلی
        const currentCopy = Math.floor(swiper.activeIndex / slideCount);
        const target = Math.min(
          Math.max(currentCopy * slideCount + realIndex, 0),
          copies * slideCount - 1
        );
        swiper.slideTo(target);
      }
      setActiveIndex(realIndex);
    },
    [swiper, slideCount, copies]
  );

  /**
   * بعد از هر ترنزیشن، اگر اسلاید فعال از نسخهٔ میانی خارج شده باشد،
   * بی‌درنگ به اسلاید هم‌شکل در نسخهٔ میانی می‌پریم. چون تصویر همان
   * تصویر است، کاربر پرش نمی‌بیند؛ اما همیشه چند اسلاید پشت و جلو
   * وجود دارد و «انتهای بنرها» دیده نمی‌شود.
   */
  const handleTransitionEnd = useCallback(
    (instance: SwiperClass) => {
      if (slideCount < 2 || jumpingRef.current) return;
      const index = instance.activeIndex;
      const copy = Math.floor(index / slideCount);
      if (copy === middleCopy) return;

      const target = index - (copy - middleCopy) * slideCount;
      jumpingRef.current = true;
      instance.slideTo(target, 0, false);
      setActiveIndex(((index % slideCount) + slideCount) % slideCount);
      instance.autoplay?.start();
      window.setTimeout(() => {
        jumpingRef.current = false;
      }, 80);
    },
    [slideCount, middleCopy]
  );

  const handleSlideChange = useCallback(
    (instance: SwiperClass) => {
      if (slideCount < 2) {
        setActiveIndex(0);
        return;
      }
      const total = copies * slideCount;
      const index = instance.activeIndex;
      const realIndex = ((index % slideCount) + slideCount) % slideCount;

      // لبهٔ مطلق رینگ (اولین/آخرین اسلاید کل نسخه‌ها): قبل از اینکه
      // فضای خالی دیده شود یا swipe بعدی قفل شود، بلافاصله به اسلاید
      // هم‌شکل در نسخهٔ میانی می‌پریم. تصویر همان تصویر است، پس کاربر
      // فقط ادامهٔ چرخش را می‌بیند، نه انتهای بنرها.
      if (index === 0 || index === total - 1) {
        const target = index === 0 ? middleStart : middleStart + slideCount - 1;
        jumpingRef.current = true;
        instance.slideTo(target, 0, false);
        setActiveIndex(realIndex);
        instance.autoplay?.start();
        window.setTimeout(() => {
          jumpingRef.current = false;
        }, 80);
        return;
      }

      setActiveIndex(realIndex);
    },
    [slideCount, copies, middleStart]
  );

  if (slides.length === 0) return null;

  return (
    <div className="relative h-full w-full">
      <Swiper
        modules={[Autoplay, A11y, Keyboard]}
        onSwiper={setSwiper}
        onSlideChange={handleSlideChange}
        onTransitionEnd={handleTransitionEnd}
        initialSlide={initialSlide}
        loop={false}
        rewind={false}
        speed={500}
        slidesPerView={1.1}
        spaceBetween={8}
        centeredSlides
        breakpoints={{
          768: {
            slidesPerView: 1,
            spaceBetween: 0,
            centeredSlides: false,
          },
        }}
        autoplay={
          slides.length > 1
            ? {
                delay: 5000,
                disableOnInteraction: false,
                pauseOnMouseEnter: true,
                waitForTransition: true,
                stopOnLastSlide: false,
              }
            : false
        }
        keyboard={{ enabled: true }}
        grabCursor
        a11y={{
          enabled: true,
          prevSlideMessage: "اسلاید قبلی",
          nextSlideMessage: "اسلاید بعدی",
          firstSlideMessage: "اولین اسلاید",
          lastSlideMessage: "آخرین اسلاید",
          paginationBulletMessage: "رفتن به اسلاید {{index}}",
        }}
        dir="rtl"
        className="hero-swiper h-full w-full"
      >
        {ring.map(({ banner, realIndex, copy, isClone }) => {
          const src = resolveImageUrl(banner.image, "");
          const mobileSrc = resolveImageUrl(banner.mobileImage, "");
          if (!src) return null;

          return (
            <SwiperSlide
              key={`${banner._id}-${copy}-${realIndex}`}
              className="relative h-full w-full overflow-hidden rounded-lg md:rounded-none"
              aria-hidden={isClone ? "true" : undefined}
            >
              <HeroBannerLink banner={banner} tabIndex={isClone ? -1 : undefined}>
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
                  priority={!isClone && realIndex === 0}
                  fit={banner.fit === "contain" ? "contain" : "cover"}
                />
              </HeroBannerLink>
            </SwiperSlide>
          );
        })}
      </Swiper>

      {slides.length > 1 ? (
        <>
          {/* سایهٔ پایین فقط در دسکتاپ؛ در موبایل تصویر باید تمیز بماند */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden h-24 bg-gradient-to-t from-black/40 via-black/10 to-transparent md:block"
          />

          <div className="absolute bottom-3 end-3 z-20 hidden items-center gap-2 rounded-full bg-black/25 px-3 py-2 backdrop-blur-md md:bottom-5 md:end-6 md:flex">
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
