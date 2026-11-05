"use client";

import { useEffect, useState } from "react";
import HeroBannerImage from "./HeroBannerImage";
import HeroBannerLink from "./HeroBannerLink";
import SwiperSlider from "./SwiperSlider";
import { Banner, bannerService } from "@/services/bannerService";
import { resolveImageUrl } from "@/lib/image";
import { bannerAltText } from "@/lib/bannerAlt";

type HeroSectionProps = {
  initialBanners?: Banner[];
};

/**
 * ============================================================
 *  Hero Banner Section — Art-Directed Responsive Hero
 * ============================================================
 *
 *  Desktop: 1911 × 430  → 22.5013% of width (4.444 : 1)
 *  Mobile : 388  × 180  (at a 428px viewport) → fixed 180px height
 *
 *  مکانیزم موبایل عیناً مانند دیجی‌کالا:
 *  - اسلاید فعال وسط‌چین با عرض ۱.۱ اسلاید (۳۸۸px در صفحهٔ ۴۲۸px)
 *  - ۲۰px از هر طرف بیرون می‌ماند، پس ۲۰px از اسلایدهای کنار «پیک» می‌زند
 *  - فاصلهٔ ۸px، گوشهٔ ۸px، ارتفاع ثابت ۱۸۰px، فاصلهٔ ۸px از بالا و ۱۲px از پایین
 *  - چرخش خودکار هر ۵ ثانیه (انیمیشن ۵۰۰ms)، لوپ بی‌نهایت، swipe
 *  - بدون فلش/نقطه در موبایل؛ فلش و نقطه فقط در دسکتاپ
 *  - دو تصویر مستقل دسکتاپ/موبایل با <picture> و source media
 *  - تصویر اول eager + fetchPriority=high برای LCP
 * ============================================================
 */

export default function HeroSection({ initialBanners = [] }: HeroSectionProps) {
  const [banners, setBanners] = useState<Banner[]>(initialBanners);
  const [loading, setLoading] = useState(initialBanners.length === 0);

  // فریم بیرونی: در موبایل تمام‌عرض با ارتفاع ثابت ۱۸۰px و فاصلهٔ ۸px از بالا
  // و ۱۲px از پایین. حاشیهٔ ۲۰px از دو طرف توسط slidesPerView: 1.1 خود
  // اسلایدر ساخته می‌شود (نه padding؛ وگرنه عرض اسلاید دوباره کم می‌شود).
  const heroFrameClass =
    "relative mt-2 mb-3 h-[180px] md:mb-0 md:h-auto md:aspect-[1911/430] md:-mt-px";
  // داخل فریم: در موبایل پس‌زمینهٔ صفحه از لای فاصلهٔ ۸px اسلایدها دیده شود،
  // در دسکتاپ پس‌زمینهٔ تیرهٔ برند.
  const heroClipClass =
    "relative h-full w-full overflow-hidden bg-transparent md:rounded-none md:bg-ekg-950";

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

  if (loading) {
    return (
      <section className="w-full max-w-[1920px] mx-auto" aria-busy="true">
        <div className={heroFrameClass}>
          <div className="mx-5 h-full md:mx-0">
            <div className={`${heroClipClass} animate-pulse rounded-lg`}>
              <div className="absolute inset-0 bg-gradient-to-r from-ekg-200 via-ekg-100 to-ekg-200" />
            </div>
          </div>
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
    <section className="w-full max-w-[1920px] mx-auto" aria-label="بنرهای اصلی فروشگاه">
      {/* === Single Banner: SSR picture, no slider overhead === */}
      {mainBanners.length === 1 && firstBanner ? (
        <div className={heroFrameClass}>
          <div className="px-5 md:px-0 h-full">
            <div className={`${heroClipClass} rounded-lg`}>
              <HeroBannerLink banner={firstBanner}>
                <HeroBannerImage
                  src={resolveImageUrl(firstBanner.image, "/placeholder.svg")}
                  mobileSrc={resolveImageUrl(firstBanner.mobileImage, "") || null}
                  alt={bannerAltText(firstBanner)}
                  width={firstImage?.width}
                  height={firstImage?.height}
                  mobileWidth={firstMobileImage?.width}
                  mobileHeight={firstMobileImage?.height}
                  priority
                  fit={firstBanner.fit === "contain" ? "contain" : "cover"}
                />
              </HeroBannerLink>
            </div>
          </div>
        </div>
      ) : null}

      {/* === Multiple Banners: Digikala-style centered peek carousel === */}
      {mainBanners.length > 1 ? (
        <div className={heroFrameClass}>
          <div className={heroClipClass}>
            <SwiperSlider banners={mainBanners} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
