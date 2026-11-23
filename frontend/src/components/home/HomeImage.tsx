"use client";

import { useCallback, useRef, useState } from "react";

export const HOME_MOBILE_IMAGE_MEDIA = "(max-width: 767px)";

const PLACEHOLDER = "/placeholder.svg";

function matchesSource(image: HTMLImageElement, src: string) {
  try {
    return image.currentSrc === new URL(src, image.baseURI).href;
  } catch {
    return false;
  }
}

type HomeImageProps = {
  src: string;
  backupSources?: readonly string[];
  mobileSrc?: string;
  mobileBackupSrc?: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  onSettled?: () => void;
};

function HomeImageContent({
  src, backupSources = [], mobileSrc, mobileBackupSrc, alt, width, height,
  className, loading = "lazy", fetchPriority, onSettled,
}: HomeImageProps) {
  const [failed, setFailed] = useState<string[]>([]);
  const notified = useRef(false);
  const desktop = [src, ...backupSources, PLACEHOLDER].find((url) => url && !failed.includes(url));
  const mobile = [mobileSrc, mobileBackupSrc].find((url) => url && url !== desktop && !failed.includes(url));

  const settle = useCallback(() => {
    if (notified.current) return;
    notified.current = true;
    onSettled?.();
  }, [onSettled]);

  const handleLoad = useCallback((image: HTMLImageElement) => {
    image.setAttribute("data-home-image-loaded", "");
    settle();
  }, [settle]);

  const handleError = useCallback((image: HTMLImageElement) => {
    const current = image.currentSrc;
    const mobileSelected = mobile && (current
      ? matchesSource(image, mobile)
      : window.matchMedia?.(HOME_MOBILE_IMAGE_MEDIA).matches);
    const url = mobileSelected ? mobile : desktop;
    if (!url || (current && !matchesSource(image, url))) return;
    if (url === PLACEHOLDER) settle();
    setFailed((attempts) => attempts.includes(url) ? attempts : [...attempts, url]);
  }, [desktop, mobile, settle]);

  const checkServerImage = useCallback((image: HTMLImageElement | null) => {
    // A cached image or a 404 can finish before React attaches its handlers.
    if (!image?.complete || !image.currentSrc) return;
    if (image.naturalWidth > 0) handleLoad(image);
    else handleError(image);
  }, [handleLoad, handleError]);

  if (!desktop && !mobile) return null;

  // ParsPack already serves resized variants. Keep the real URL in the HTML
  // and let the browser schedule the request, including before hydration.
  /* eslint-disable @next/next/no-img-element -- Use native picture and direct storage URLs. */
  const image = (
    <img
      ref={checkServerImage}
      data-home-image=""
      suppressHydrationWarning
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      onLoad={(event) => handleLoad(event.currentTarget)}
      onError={(event) => handleError(event.currentTarget)}
      src={desktop}
    />
  );
  /* eslint-enable @next/next/no-img-element */

  return mobile ? (
    <picture>
      <source media={HOME_MOBILE_IMAGE_MEDIA} srcSet={mobile} />
      {image}
    </picture>
  ) : image;
}

export default function HomeImage(props: HomeImageProps) {
  return <HomeImageContent key={`${props.src}\n${props.mobileSrc ?? ""}`} {...props} />;
}
