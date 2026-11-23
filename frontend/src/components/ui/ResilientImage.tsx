"use client";

import Image, { type ImageProps } from "next/image";
import { forwardRef, useCallback, useEffect, useRef, useState, type Ref } from "react";

const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [500, 1500];
const LOAD_TIMEOUT_MS = 20_000;
const PLACEHOLDER_SRC = "/placeholder.svg";
const DEFAULT_BLUR_SVG =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YzZjRmNiIvPjwvc3ZnPg==";

type ImageSource = ImageProps["src"];
type ImageRequest = {
  index: number;
  src: ImageSource;
  phase: "loading" | "failed" | "loaded" | "fallback";
};

function sourceUrl(src: ImageSource | null | undefined): string {
  if (!src) return "";
  if (typeof src === "string") return src;
  return "default" in src ? src.default.src : src.src;
}

function retrySource(src: ImageSource, index: number): ImageSource {
  if (typeof src !== "string") return src;
  try {
    const url = new URL(src, document.baseURI);
    if (!/^https?:$/.test(url.protocol) || /[?&](?:signature|x-amz-signature|x-goog-signature)=/i.test(url.search)) return src;
    url.searchParams.set("_retry", `${Date.now()}-${index}`);
    return src.startsWith("/") && !src.startsWith("//") ? `${url.pathname}${url.search}${url.hash}` : url.href;
  } catch {
    return src;
  }
}

export interface ResilientImageProps extends Omit<ImageProps, "onError"> {
  fallbackSrc?: string;
  /** Full-resolution photo used if its smaller variant fails. */
  backupSrc?: string;
  maxRetries?: number;
  onRetryExhausted?: () => void;
  showSkeleton?: boolean;
  skeletonClassName?: string;
  transitionDuration?: number;
  /** Position this wrapper when using `fill`, for example `absolute inset-0`. */
  wrapperClassName?: string;
}

function ImageRequestView({
  src,
  alt,
  backupSrc,
  fallbackSrc = PLACEHOLDER_SRC,
  maxRetries = MAX_RETRIES,
  onRetryExhausted,
  showSkeleton = true,
  skeletonClassName,
  transitionDuration = 300,
  wrapperClassName,
  onLoad,
  imageRef,
  style,
  ...rest
}: ResilientImageProps & { imageRef: Ref<HTMLImageElement> }) {
  const [request, setRequest] = useState<ImageRequest>({ index: 0, src, phase: "loading" });
  const [nearViewport, setNearViewport] = useState(false);
  const nodeRef = useRef<HTMLImageElement>(null);
  const notified = useRef(false);
  const initialUrl = rest.overrideSrc ?? sourceUrl(src);
  const backup = backupSrc && backupSrc !== initialUrl && backupSrc !== fallbackSrc ? backupSrc : undefined;
  const retryLimit = Number.isFinite(maxRetries) ? Math.max(0, Math.floor(maxRetries)) : MAX_RETRIES;
  const prioritized = Boolean(rest.priority || rest.preload);
  const requestedLoading = rest.loading ?? (prioritized ? "eager" : "lazy");
  const readyToLoad = requestedLoading === "eager" || nearViewport;

  const attachImage = useCallback((image: HTMLImageElement | null) => {
    nodeRef.current = image;
    if (typeof imageRef === "function") {
      const cleanup = imageRef(image);
      if (typeof cleanup === "function") {
        return () => {
          nodeRef.current = null;
          cleanup();
        };
      }
    } else if (imageRef) {
      imageRef.current = image;
    }
  }, [imageRef]);

  useEffect(() => {
    if (readyToLoad) return;
    const image = nodeRef.current;
    if (!image) return;
    if (typeof IntersectionObserver !== "function") {
      setNearViewport(true);
      return;
    }

    // The default wrapper uses display:contents, so observe the image itself.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setNearViewport(true);
    }, { rootMargin: "200px" });
    observer.observe(image);
    return () => observer.disconnect();
  }, [readyToLoad, request.index]);

  const settle = useCallback((phase: "loaded" | "failed") => {
    setRequest((current) => {
      if (current.index !== request.index) return current;
      if (current.phase === "loading" || (current.phase === "failed" && phase === "loaded")) {
        return { ...current, phase };
      }
      return current;
    });
  }, [request.index]);

  useEffect(() => {
    if (request.phase !== "loading") return;
    const image = nodeRef.current;
    if (!image) return;

    // Reconcile loads and errors that finished before hydration attached the handlers.
    if (image.complete && (image.naturalWidth > 0 || image.currentSrc)) {
      settle(image.naturalWidth > 0 ? "loaded" : "failed");
      return;
    }
    // Lazy images outside the viewport can legitimately sit idle for a long time.
    if (!readyToLoad) return;
    const timeout = window.setTimeout(() => {
      settle(image.complete && image.naturalWidth > 0 ? "loaded" : "failed");
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [readyToLoad, request.phase, settle]);

  useEffect(() => {
    if (request.phase !== "failed") return;
    const advance = (nextSrc: ImageSource, phase: ImageRequest["phase"] = "loading") => {
      setRequest((current) => current === request ? { index: current.index + 1, src: nextSrc, phase } : current);
    };

    if (request.index === 0 && backup) {
      advance(backup);
      return;
    }

    const retries = request.index - (backup ? 1 : 0);
    if (retries >= retryLimit || initialUrl === fallbackSrc) {
      advance(fallbackSrc, "fallback");
      return;
    }
    if (!readyToLoad) return;

    const retry = window.setTimeout(() => {
      const image = nodeRef.current;
      if (image?.complete && image.naturalWidth > 0) {
        settle("loaded");
        return;
      }
      const source = backup && retries % 2 === 1 ? backup : src;
      advance(retrySource(source, request.index + 1));
    }, RETRY_DELAYS_MS[Math.min(retries, RETRY_DELAYS_MS.length - 1)]);
    return () => window.clearTimeout(retry);
  }, [backup, fallbackSrc, initialUrl, readyToLoad, request, retryLimit, settle, src]);

  useEffect(() => {
    if (request.phase !== "fallback" || notified.current) return;
    notified.current = true;
    onRetryExhausted?.();
  }, [onRetryExhausted, request.phase]);

  const unoptimized = rest.unoptimized ?? true;
  return (
    <span className={wrapperClassName ?? "contents"}>
      {showSkeleton && (request.phase === "loading" || request.phase === "failed") && (
        <span
          aria-hidden="true"
          className={skeletonClassName || "absolute inset-0 bg-gray-100 animate-pulse"}
          style={{ position: "absolute", inset: 0, zIndex: 0 }}
        />
      )}
      <Image
        {...rest}
        key={request.index}
        ref={attachImage}
        src={request.src}
        alt={alt ?? ""}
        overrideSrc={request.index === 0 ? rest.overrideSrc : undefined}
        unoptimized={unoptimized}
        placeholder={unoptimized ? "empty" : (rest.placeholder ?? "blur")}
        blurDataURL={unoptimized ? undefined : (rest.blurDataURL ?? DEFAULT_BLUR_SVG)}
        decoding={rest.decoding ?? "async"}
        loading={readyToLoad ? "eager" : requestedLoading}
        fetchPriority={rest.fetchPriority ?? (prioritized ? "high" : "auto")}
        style={{ ...style, transition: `opacity ${transitionDuration}ms ease-in-out`, opacity: 1 }}
        onError={(event) => {
          if (event.currentTarget === nodeRef.current) settle("failed");
        }}
        onLoad={(event) => {
          if (event.currentTarget !== nodeRef.current || event.currentTarget.naturalWidth === 0) return;
          settle("loaded");
          onLoad?.(event);
        }}
      />
    </span>
  );
}

const ResilientImage = forwardRef<HTMLImageElement, ResilientImageProps>(function ResilientImage(props, ref) {
  // A different product/variant must start with fresh state, including during navigation.
  const originalUrl = sourceUrl(props.src);
  const src = originalUrl ? props.src : (props.backupSrc || props.fallbackSrc || PLACEHOLDER_SRC);
  const key = JSON.stringify([sourceUrl(src), props.overrideSrc, props.backupSrc, props.fallbackSrc]);
  return <ImageRequestView key={key} {...props} src={src} imageRef={ref} />;
});

export default ResilientImage;
