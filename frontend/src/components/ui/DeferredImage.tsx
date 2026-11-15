"use client";

import { useEffect, useRef, useState } from "react";
import ResilientImage, { type ResilientImageProps } from "./ResilientImage";

// One observer serves all below-the-fold images. It also respects clipping by
// horizontal carousels, unlike a simple distance from the document's top.
const pending = new Map<Element, () => void>();
let observer: IntersectionObserver | undefined;

function observeNearViewport(element: Element, ready: () => void): () => void {
  if (typeof IntersectionObserver === "undefined") {
    ready();
    return () => {};
  }
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const callback = pending.get(entry.target);
        if (!callback) continue;
        pending.delete(entry.target);
        observer?.unobserve(entry.target);
        callback();
      }
    }, { rootMargin: "300px" });
  }
  pending.set(element, ready);
  observer.observe(element);
  return () => {
    pending.delete(element);
    observer?.unobserve(element);
  };
}

/** Defer non-critical, fill-sized images while keeping their space reserved. */
export default function DeferredImage(props: ResilientImageProps) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready || !anchor.current) return;
    return observeNearViewport(anchor.current, () => setReady(true));
  }, [ready]);

  const fallbackSrc = typeof props.src === "string"
    ? props.src
    : "default" in props.src ? props.src.default.src : props.src.src;

  return (
    <span ref={anchor} className="absolute inset-0 block">
      {ready ? (
        <ResilientImage {...props} wrapperClassName="absolute inset-0" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-gray-100" />
      )}
      <noscript>
        <img src={fallbackSrc} alt={props.alt} loading="lazy" className={props.className}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", ...props.style }} />
      </noscript>
    </span>
  );
}
