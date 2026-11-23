"use client";

import HeroBannerImage, { getHeroBannerSources, HERO_IMAGE_BACKGROUND } from "./HeroBannerImage";
import HeroBannerLink from "./HeroBannerLink";
import { HOME_MOBILE_IMAGE_MEDIA } from "./HomeImage";
import SwiperSlider from "./SwiperSlider";
import { useHomeBanners } from "@/hooks/useHomeBanners";
import type { Banner } from "@/services/bannerService";

const SECTION = "w-full max-w-[1920px] mx-auto";
const FRAME = "relative mt-2 mb-3 h-[180px] md:mb-0 md:h-auto md:aspect-[1911/430] md:-mt-px";
const CLIP = "relative h-full w-full overflow-hidden rounded-lg md:rounded-none";

export function HeroPlaceholder() {
  return (
    <section className={SECTION} aria-busy="true">
      <div className={FRAME}>
        <div className="mx-5 h-full md:mx-0">
          <div className={`${CLIP} ${HERO_IMAGE_BACKGROUND}`} />
        </div>
      </div>
    </section>
  );
}

export default function HeroSection({ initialBanners = null }: { initialBanners?: Banner[] | null }) {
  const { banners, loading } = useHomeBanners(initialBanners);
  const mainBanners = banners
    .filter((banner) => banner.position === "main-slider" && getHeroBannerSources(banner).src)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const first = mainBanners[0];

  if (loading) return <HeroPlaceholder />;
  if (!first) return null;

  const { src, mobileSrc } = getHeroBannerSources(first);
  return (
    <section className={SECTION} aria-label="بنرهای اصلی فروشگاه">
      {mobileSrc && (
        <>
          <link rel="preload" as="image" href={mobileSrc} media={HOME_MOBILE_IMAGE_MEDIA} fetchPriority="high" />
          <link rel="preload" as="image" href={src} media={`not all and ${HOME_MOBILE_IMAGE_MEDIA}`} fetchPriority="high" />
        </>
      )}
      <div className={FRAME}>
        {mainBanners.length === 1 ? (
          <div className="mx-5 h-full md:mx-0">
            <div className={`${CLIP} ${HERO_IMAGE_BACKGROUND}`}>
              <HeroBannerLink banner={first}>
                <HeroBannerImage banner={first} priority />
              </HeroBannerLink>
            </div>
          </div>
        ) : (
          <SwiperSlider banners={mainBanners} />
        )}
      </div>
    </section>
  );
}
