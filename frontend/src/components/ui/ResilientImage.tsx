"use client";

import Image, { type ImageProps } from "next/image";
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useMemo,
} from "react";

const MAX_RETRIES = 2; // Reduced from 5 to 2
const RETRY_DELAYS_MS = [500, 1500]; // Simplified delays
const PLACEHOLDER_SRC = "/placeholder.png";

/* ── Tiny inline SVG placeholder (gray-100) ────────────────── */
const DEFAULT_BLUR_SVG =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YzZjRmNiIvPjwvc3ZnPg==";

function getRetryDelay(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
}

function bustCache(src: string): string {
  try {
    const url = new URL(src, window.location.origin);
    url.searchParams.set("_retry", Date.now().toString());
    return url.toString();
  } catch {
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}_retry=${Date.now()}`;
  }
}

/* ── Connection warming (only on first failure) ────────────────────────────────────── */
const warmedOrigins = new Set<string>();
function warmConnection(src: string): void {
  try {
    const url = new URL(src, window.location.origin);
    const origin = url.origin;
    if (warmedOrigins.has(origin)) return;
    warmedOrigins.add(origin);
    // Simple HEAD request without aggressive retries
    fetch(src, {
      method: "HEAD",
      mode: "no-cors",
      credentials: "omit",
      cache: "default", // Changed from "no-store" to allow CDN caching
    }).catch(() => {});
  } catch {}
}

/* ── Loading state enum ────────────────────────────────────── */
type LoadPhase = "skeleton" | "loaded" | "error";

export interface ResilientImageProps extends Omit<ImageProps, "onError"> {
  fallbackSrc?: string;
  maxRetries?: number;
  onRetryExhausted?: () => void;
  showSkeleton?: boolean;
  skeletonClassName?: string;
  transitionDuration?: number;
  /**
   * Optional class for the internal wrapper. Defaults to `contents` so the
   * image behaves as a direct child of its parent. Pass a positioned class
   * (e.g. `absolute inset-0`) when `fill` is used inside a positioned box:
   * Next's fill warning inspects this wrapper, not the grandparent.
   */
  wrapperClassName?: string;
}

/**
 * ResilientImage — Optimized for CDN performance
 * ================================================
 * ✅ Reduced retries (2 instead of 5) for faster failure
 * ✅ Simplified retry delays
 * ✅ Respects CDN caching
 * ✅ Smooth fade-in on load
 * ✅ Viewport-gated retries
 */
const ResilientImage = forwardRef<HTMLImageElement, ResilientImageProps>(
  function ResilientImage(
    {
      src,
      fallbackSrc = PLACEHOLDER_SRC,
      maxRetries = MAX_RETRIES,
      onRetryExhausted,
      alt,
      showSkeleton = true,
      skeletonClassName,
      transitionDuration = 300,
      wrapperClassName,
      onLoad: onLoadProp,
      className,
      style,
      ...rest
    },
    _ref
  ) {
    const originalSrc = src;
    const [currentSrc, setCurrentSrc] = useState<ImageProps["src"]>(src);
    const [phase, setPhase] = useState<LoadPhase>("skeleton");

    const retryCount = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isInViewport = useRef(false);
    const wrapperRef = useRef<HTMLSpanElement>(null);
    const waitingForViewport = useRef(false);

    useEffect(() => {
      retryCount.current = 0;
      setCurrentSrc(src);

      const node = wrapperRef.current;
      const imgEl = node?.querySelector("img");
      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
        setPhase("loaded");
      } else {
        setPhase("skeleton");
      }
    }, [src]);

    useEffect(() => {
      const node = wrapperRef.current;
      if (!node) return;

      const imgEl = node.querySelector("img");
      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
        setPhase("loaded");
      }

      // Legacy browser fallback: no IntersectionObserver (IE11, old Safari/Chrome)
      // -> treat as visible so retries are never viewport-blocked forever.
      if (typeof IntersectionObserver === "undefined") {
        isInViewport.current = true;
        if (waitingForViewport.current) {
          waitingForViewport.current = false;
          scheduleRetry();
        }
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          isInViewport.current = entry.isIntersecting;
          if (entry.isIntersecting && waitingForViewport.current) {
            waitingForViewport.current = false;
            scheduleRetry();
          }
        },
        { rootMargin: "200px" }
      );

      observer.observe(node);
      return () => {
        observer.disconnect();
        if (timerRef.current) clearTimeout(timerRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const scheduleRetry = useCallback(() => {
      if (retryCount.current >= maxRetries) {
        setPhase("error");
        setCurrentSrc(fallbackSrc);
        onRetryExhausted?.();
        return;
      }

      const delay = getRetryDelay(retryCount.current);
      timerRef.current = setTimeout(() => {
        retryCount.current += 1;
        if (typeof originalSrc === "string") {
          // Only bust cache on second retry to respect CDN
          if (retryCount.current > 1) {
            setCurrentSrc(bustCache(originalSrc));
          } else {
            setCurrentSrc(originalSrc);
          }
        } else {
          setCurrentSrc(originalSrc);
        }
      }, delay);
    }, [maxRetries, fallbackSrc, onRetryExhausted, originalSrc]);

    const handleError = useCallback(() => {
      if (phase === "error") return;

      if (typeof originalSrc === "string" && retryCount.current === 0) {
        warmConnection(originalSrc);
      }

      if (retryCount.current >= maxRetries) {
        setPhase("error");
        setCurrentSrc(fallbackSrc);
        onRetryExhausted?.();
        return;
      }

      if (!isInViewport.current) {
        waitingForViewport.current = true;
        return;
      }

      scheduleRetry();
    }, [phase, maxRetries, fallbackSrc, onRetryExhausted, scheduleRetry, originalSrc]);

    const handleLoad = useCallback(() => {
      setPhase("loaded");
      onLoadProp?.({} as any);
    }, [onLoadProp]);

    const imageStyle = useMemo(
      () => ({
        ...style,
        transition: `opacity ${transitionDuration}ms ease-in-out`,
        // SEO: the <img> is NEVER opacity:0 in the initial/SSR style. A hidden
        // first paint made crawlers treat product photos as not rendered; the
        // skeleton below is only an overlay behind the (always visible) image.
        opacity: 1,
      }),
      [style, transitionDuration, phase]
    );

    const shouldPrioritize = Boolean(rest.priority);
    const imageProps: ImageProps = {
      ...rest,
      src: currentSrc,
      alt: alt ?? "",
      className,
      style: imageStyle,
      placeholder: rest.placeholder ?? "blur",
      blurDataURL: rest.blurDataURL ?? DEFAULT_BLUR_SVG,
      loading: rest.loading ?? (shouldPrioritize ? "eager" : "lazy"),
      fetchPriority: rest.fetchPriority ?? (shouldPrioritize ? "high" : "auto"),
      onError: handleError,
      onLoad: handleLoad,
    };

    return (
      <span ref={wrapperRef} className={wrapperClassName ?? "contents"}>
        {showSkeleton && phase === "skeleton" && (
          <span
            className={skeletonClassName || "absolute inset-0 bg-gray-100 animate-pulse"}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
            }}
          />
        )}
        <Image {...imageProps} alt={alt || ""} />
      </span>
    );
  }
);

ResilientImage.displayName = "ResilientImage";
export default ResilientImage;

/* ── Hook variant for advanced use cases ────────────────────────────────────── */
export function useResilientImage(
  originalSrc: string | null,
  fallbackSrc: string = PLACEHOLDER_SRC,
  maxRetries: number = MAX_RETRIES
) {
  const [currentSrc, setCurrentSrc] = useState(originalSrc || fallbackSrc);
  const [phase, setPhase] = useState<LoadPhase>("skeleton");
  const retryCount = useRef(0);
  const failed = useRef(false);
  const isInViewport = useRef(false);
  const waitingForViewport = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    retryCount.current = 0;
    failed.current = false;
    setCurrentSrc(originalSrc || fallbackSrc);

    if (ref.current && ref.current.complete && ref.current.naturalWidth > 0) {
      setPhase("loaded");
    } else {
      setPhase("skeleton");
    }
  }, [originalSrc, fallbackSrc]);

  useEffect(() => {
    const node = ref.current;
    if (node && node.complete && node.naturalWidth > 0) {
      setPhase("loaded");
    }
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      isInViewport.current = true;
      if (waitingForViewport.current) {
        waitingForViewport.current = false;
        doRetry();
      }
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isInViewport.current = entry.isIntersecting;
        if (entry.isIntersecting && waitingForViewport.current) {
          waitingForViewport.current = false;
          doRetry();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function doRetry() {
    if (retryCount.current >= maxRetries || failed.current) {
      failed.current = true;
      setPhase("error");
      setCurrentSrc(fallbackSrc);
      return;
    }
    const delay = getRetryDelay(retryCount.current);
    timerRef.current = setTimeout(() => {
      retryCount.current += 1;
      if (originalSrc) {
        // Only bust cache on second retry
        if (retryCount.current > 1) {
          setCurrentSrc(bustCache(originalSrc));
        } else {
          setCurrentSrc(originalSrc);
        }
      } else {
        setCurrentSrc(fallbackSrc);
      }
    }, delay);
  }

  const onError = useCallback(() => {
    if (failed.current) return;
    if (originalSrc && retryCount.current === 0) {
      warmConnection(originalSrc);
    }
    if (!isInViewport.current) {
      waitingForViewport.current = true;
      return;
    }
    doRetry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalSrc, maxRetries, fallbackSrc]);

  const onLoad = useCallback(() => {
    setPhase("loaded");
  }, []);

  return { src: currentSrc, onError, onLoad, ref, phase };
}
