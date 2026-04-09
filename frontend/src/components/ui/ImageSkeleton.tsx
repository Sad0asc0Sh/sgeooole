"use client";

import { memo } from "react";

interface ImageSkeletonProps {
  className?: string;
  aspectRatio?: string;
  rounded?: boolean;
}

/**
 * Shimmer skeleton specifically sized for image placeholders.
 * Use as a sibling/overlay inside the image container while ResilientImage loads.
 */
const ImageSkeleton = memo(function ImageSkeleton({
  className = "",
  aspectRatio,
  rounded = true,
}: ImageSkeletonProps) {
  return (
    <div
      className={`
        bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200
        animate-shimmer
        ${rounded ? "rounded-lg" : ""}
        ${className}
      `}
      style={{
        backgroundSize: "200% 100%",
        aspectRatio: aspectRatio || undefined,
      }}
      aria-hidden
    />
  );
});

export default ImageSkeleton;
