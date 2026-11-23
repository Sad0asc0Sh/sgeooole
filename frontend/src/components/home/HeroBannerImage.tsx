import { resolveImageUrl } from "@/lib/image";
import { bannerAltText } from "@/lib/bannerAlt";
import type { Banner } from "@/services/bannerService";
import HomeImage from "./HomeImage";

export const HERO_IMAGE_BACKGROUND = "bg-gradient-to-r from-ekg-200 via-ekg-100 to-ekg-200";

export function getHeroBannerSources(banner: Banner) {
  const desktop = resolveImageUrl(banner.image, "");
  const desktopCard = typeof banner.image === "object" ? banner.image?.cardUrl?.trim() : undefined;
  const mobile = resolveImageUrl(banner.mobileImage, "");
  const mobileCard = typeof banner.mobileImage === "object" ? banner.mobileImage?.cardUrl?.trim() : undefined;
  const src = desktop || desktopCard || mobile || mobileCard || "";
  const [mobileSrc, mobileBackupSrc] = new Set([mobileCard, mobile, desktopCard].filter((url) => url && url !== src));
  return {
    src,
    mobileSrc,
    mobileBackupSrc,
    backupSources: [desktopCard, mobile, mobileCard].filter((url): url is string => Boolean(url)),
  };
}

export default function HeroBannerImage({
  banner, priority, onSettled,
}: { banner: Banner; priority: boolean; onSettled?: () => void }) {
  const image = typeof banner.image === "object" ? banner.image : null;
  return (
    <HomeImage
      {...getHeroBannerSources(banner)}
      alt={bannerAltText(banner)}
      width={image?.width || 1911}
      height={image?.height || 430}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "low"}
      onSettled={onSettled}
      className={`absolute inset-0 h-full w-full ${banner.fit === "contain" ? "object-contain" : "object-cover"}`}
    />
  );
}
