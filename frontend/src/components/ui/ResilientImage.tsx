"use client";

import Image, { ImageProps } from "next/image";
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
} from "react";

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const PLACEHOLDER_SRC = "/placeholder.png";

function getRetryDelay(attempt: number): number {
  const exponential = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = exponential * 0.3 * Math.random();
  return Math.min(exponential + jitter, MAX_DELAY_MS);
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

export interface ResilientImageProps extends Omit<ImageProps, "onError"> {
  fallbackSrc?: string;
  maxRetries?: number;
  onRetryExhausted?: () => void;
}

/**
 * ResilientImage
 * ==============
 * A drop-in replacement for next/image that automatically retries failed
 * image loads with exponential backoff, but *only* when the image is
 * inside the viewport (Intersection Observer).
 *
 * Features:
 * - Auto-retry on onerror with exponential backoff + jitter
 * - Viewport-gated retries via IntersectionObserver
 * - Cache-busting query param on each retry
 * - Configurable max retries (default 10)
 * - Falls back to a placeholder after all retries are exhausted
 */
const ResilientImage = forwardRef<HTMLImageElement, ResilientImageProps>(
  function ResilientImage(
    {
      src,
      fallbackSrc = PLACEHOLDER_SRC,
      maxRetries = MAX_RETRIES,
      onRetryExhausted,
      alt,
      ...rest
    },
    _ref
  ) {
    const originalSrc = src;
    const [currentSrc, setCurrentSrc] = useState<ImageProps["src"]>(src);
    const [failed, setFailed] = useState(false);

    const retryCount = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isInViewport = useRef(false);
    const wrapperRef = useRef<HTMLSpanElement>(null);
    const waitingForViewport = useRef(false);

    useEffect(() => {
      retryCount.current = 0;
      setCurrentSrc(src);
      setFailed(false);
    }, [src]);

    useEffect(() => {
      const node = wrapperRef.current;
      if (!node) return;

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
        setFailed(true);
        setCurrentSrc(fallbackSrc);
        onRetryExhausted?.();
        return;
      }

      const delay = getRetryDelay(retryCount.current);
      timerRef.current = setTimeout(() => {
        retryCount.current += 1;
        if (typeof originalSrc === "string") {
          setCurrentSrc(bustCache(originalSrc));
        } else {
          setCurrentSrc(originalSrc);
        }
      }, delay);
    }, [maxRetries, fallbackSrc, onRetryExhausted, originalSrc]);

    const handleError = useCallback(() => {
      if (failed) return;

      if (retryCount.current >= maxRetries) {
        setFailed(true);
        setCurrentSrc(fallbackSrc);
        onRetryExhausted?.();
        return;
      }

      if (!isInViewport.current) {
        waitingForViewport.current = true;
        return;
      }

      scheduleRetry();
    }, [failed, maxRetries, fallbackSrc, onRetryExhausted, scheduleRetry]);

    const imageProps: ImageProps = {
      ...rest,
      src: currentSrc,
      alt: alt ?? "",
      onError: handleError,
    };

    return (
      <span ref={wrapperRef} className="contents">
        <Image {...imageProps} />
      </span>
    );
  }
);

export default ResilientImage;

/**
 * useResilientImg
 * ===============
 * A hook for plain <img> tags (e.g. category icons) that provides the
 * same retry-with-backoff logic without requiring next/image.
 *
 * Usage:
 *   const { src, onError, ref } = useResilientImg(originalUrl);
 *   <img ref={ref} src={src} onError={onError} />
 */
export function useResilientImg(
  originalSrc: string | undefined,
  fallbackSrc: string = PLACEHOLDER_SRC,
  maxRetries: number = MAX_RETRIES
) {
  const [currentSrc, setCurrentSrc] = useState(originalSrc || fallbackSrc);
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
  }, [originalSrc, fallbackSrc]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

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
      setCurrentSrc(fallbackSrc);
      return;
    }
    const delay = getRetryDelay(retryCount.current);
    timerRef.current = setTimeout(() => {
      retryCount.current += 1;
      setCurrentSrc(originalSrc ? bustCache(originalSrc) : fallbackSrc);
    }, delay);
  }

  const onError = useCallback(() => {
    if (failed.current) return;
    if (!isInViewport.current) {
      waitingForViewport.current = true;
      return;
    }
    doRetry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalSrc, maxRetries, fallbackSrc]);

  return { src: currentSrc, onError, ref };
}
