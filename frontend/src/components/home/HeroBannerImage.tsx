"use client";

import { getImageProps } from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImageOff } from "lucide-react";

const DESKTOP_WIDTH = 1911;
const DESKTOP_HEIGHT = 430;
// اسلاید موبایل در ویوپورت ۴۲۸px برابر ۳۸۸×۱۸۰ است؛ فایل ۲x یعنی ۷۸۰×۳۶۰.
const MOBILE_WIDTH = 780;
const MOBILE_HEIGHT = 360;
const MOBILE_BREAKPOINT = "(max-width: 767px)";
const HERO_SIZES = "(max-width: 767px) calc(100vw - 40px), 100vw";

type HeroBannerImageProps = {
  /** تصویر دسکتاپ (اجباری) */
  src: string;
  /** تصویر مستقل موبایل؛ در صورت نبود، تصویر دسکتاپ استفاده می‌شود. */
  mobileSrc?: string | null;
  alt: string;
  /** ابعاد واقعی تصویر برای ساخت srcset بهتر (اختیاری) */
  width?: number;
  height?: number;
  mobileWidth?: number;
  mobileHeight?: number;
  /** اولین اسلاید = LCP */
  priority?: boolean;
  /** cover پیش‌فرض؛ contain برای نمایش کامل تصویر */
  fit?: "cover" | "contain";
  className?: string;
};

const isAnimatedOrVector = (src: string) =>
  /\.(gif|svg)(\?|#|$)/i.test(src) || /^data:image\/(gif|svg\+xml)/i.test(src);

const toDimension = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
};

/**
 * تصویر بنر اصلی با Art Direction واقعی:
 * - دسکتاپ و موبایل منبع مستقل دارند.
 * - مرورگر فقط یکی از دو تصویر را دانلود می‌کند (برخلاف رندر هم‌زمان هر دو).
 * - از getImageProps استفاده می‌کند تا بهینه‌سازی/فرمت‌های Next.js حفظ شود.
 */
export default function HeroBannerImage({
  src,
  mobileSrc,
  alt,
  width,
  height,
  mobileWidth,
  mobileHeight,
  priority = false,
  fit = "cover",
  className = "",
}: HeroBannerImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src, mobileSrc]);

  // SSR images can finish downloading before React attaches onLoad.
  // Check `complete` on mount so the banner never stays invisible.
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const sync = () => {
      if (img.complete && img.naturalWidth > 0) setLoaded(true);
    };

    sync();
    const timer = window.setTimeout(sync, 1200);
    return () => window.clearTimeout(timer);
  }, [src, mobileSrc]);

  const desktop = useMemo(() => {
    const imageWidth = toDimension(width, DESKTOP_WIDTH);
    const imageHeight = toDimension(height, DESKTOP_HEIGHT);
    try {
      return getImageProps({
        src,
        alt,
        width: imageWidth,
        height: imageHeight,
        sizes: HERO_SIZES,
        quality: 80,
        unoptimized: isAnimatedOrVector(src),
      });
    } catch (error) {
      console.warn("[HERO] Failed to build desktop image props", error);
      return null;
    }
  }, [src, alt, width, height]);

  const mobile = useMemo(() => {
    if (!mobileSrc) return null;
    const imageWidth = toDimension(mobileWidth, MOBILE_WIDTH);
    const imageHeight = toDimension(mobileHeight, MOBILE_HEIGHT);
    try {
      return getImageProps({
        src: mobileSrc,
        alt,
        width: imageWidth,
        height: imageHeight,
        sizes: HERO_SIZES,
        quality: 80,
        unoptimized: isAnimatedOrVector(mobileSrc),
      });
    } catch (error) {
      console.warn("[HERO] Failed to build mobile image props", error);
      return null;
    }
  }, [mobileSrc, alt, mobileWidth, mobileHeight]);

  if (!desktop || failed) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-ekg-900 via-ekg-800 to-ekg-950 text-white/70"
        role="img"
        aria-label={alt}
      >
        <div className="flex flex-col items-center gap-2">
          <ImageOff className="h-8 w-8" aria-hidden="true" />
          <span className="text-xs font-medium">{alt || "بنر"}</span>
        </div>
      </div>
    );
  }

  const { props: desktopProps } = desktop;
  const mobileSrcSet = mobile?.props?.srcSet || mobile?.props?.src;

  return (
    <>
      <picture className="absolute inset-0 block h-full w-full">
        {mobileSrcSet ? (
          <source media={MOBILE_BREAKPOINT} srcSet={mobileSrcSet} sizes={HERO_SIZES} />
        ) : null}
        <img
          {...desktopProps}
          ref={imgRef}
          alt={alt}
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          } ${className}`}
          style={{
            ...(desktopProps.style || {}),
            width: "100%",
            height: "100%",
            objectFit: fit,
            objectPosition: "center",
          }}
        />
      </picture>

      {!loaded ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-gradient-to-r from-ekg-200 via-ekg-100 to-ekg-200"
        />
      ) : null}
    </>
  );
}
