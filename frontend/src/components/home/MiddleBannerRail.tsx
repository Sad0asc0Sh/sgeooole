"use client";

import HomeImage from "./HomeImage";
import HeroBannerLink from "./HeroBannerLink";
import { useHomeBanners } from "@/hooks/useHomeBanners";
import type { Banner } from "@/services/bannerService";
import { resolveImageUrl } from "@/lib/image";
import { bannerAltText } from "@/lib/bannerAlt";

type MiddleBannerRailProps = {
  /** Active banners fetched by the homepage server component. */
  initialBanners?: Banner[] | null;
};

const ROW = "mx-auto flex w-full max-w-screen-2xl flex-col items-center gap-3 px-4 py-4 md:flex-row md:justify-center md:gap-4 md:py-5";
const TILE = "aspect-[16/5] w-full overflow-hidden rounded-2xl border bg-ekg-50 md:w-[31%] xl:w-[32%]";

export function MiddleBannerPlaceholder() {
  return (
    <section className="w-full bg-white" aria-busy="true" aria-label="در حال بارگذاری بنرهای تبلیغاتی">
      <div className={ROW}>
        {[0, 1, 2].map((index) => <div key={index} className={`${TILE} border-ekg-100`} />)}
      </div>
    </section>
  );
}

export default function MiddleBannerRail({
  initialBanners = null,
}: MiddleBannerRailProps) {
  const { banners, loading } = useHomeBanners(initialBanners);
  const middleBanners = banners
    .filter((banner) => banner.position === "middle-banner")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .slice(0, 3);

  if (loading) return <MiddleBannerPlaceholder />;
  if (middleBanners.length === 0) return null;

  return (
    <section className="w-full bg-white" aria-label="بنرهای تبلیغاتی میانی">
      <div className={ROW}>
        {middleBanners.map((banner) => {
          const original = resolveImageUrl(banner.image, "");
          const card = typeof banner.image === "object" ? banner.image?.cardUrl?.trim() : undefined;
          const label = bannerAltText(banner, "بنر تبلیغاتی ای کا جی کالا");

          return (
            <div
              key={banner._id}
              className={`${TILE} group relative border-ekg-200/60 shadow-sm transition-shadow duration-300 hover:shadow-[0_18px_40px_-30px_rgba(28,25,23,0.55)]`}
            >
              <HeroBannerLink banner={banner} className="absolute inset-0 block">
                <HomeImage
                  src={card || original}
                  backupSources={[original]}
                  alt={label}
                  width={960}
                  height={300}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.015]"
                />
              </HeroBannerLink>
            </div>
          );
        })}
      </div>
    </section>
  );
}
