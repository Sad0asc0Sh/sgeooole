"use client";

import { memo } from "react";

interface SkeletonProps {
    className?: string;
    animate?: boolean;
}

/**
 * Base Skeleton component with shimmer effect
 */
export const Skeleton = memo(function Skeleton({
    className = "",
    animate = true
}: SkeletonProps) {
    return (
        <div
            className={`
        bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200
        ${animate ? "animate-shimmer" : ""}
        ${className}
      `}
            style={{
                backgroundSize: "200% 100%",
            }}
        />
    );
});

/**
 * Product Card Skeleton for loading states
 */
export const ProductCardSkeleton = memo(function ProductCardSkeleton({
    index = 0
}: { index?: number }) {
    return (
        <div
            className="min-w-[148px] h-[240px] bg-white rounded-lg p-3 flex flex-col"
            style={{ animationDelay: `${index * 50}ms` }}
        >
            {/* Image skeleton */}
            <Skeleton className="aspect-square w-full rounded-md mb-3" />
            {/* Title skeleton */}
            <Skeleton className="h-4 w-full rounded mb-2" />
            <Skeleton className="h-4 w-3/4 rounded mb-3" />
            {/* Price skeleton */}
            <div className="mt-auto">
                <Skeleton className="h-3 w-1/2 rounded mb-2" />
                <Skeleton className="h-5 w-2/3 rounded" />
            </div>
        </div>
    );
});

/**
 * Product Rail Skeleton
 */
export const ProductRailSkeleton = memo(function ProductRailSkeleton({
    title = "Loading...",
    count = 5
}: { title?: string; count?: number }) {
    return (
        <div className="py-4 bg-white border-b border-gray-100">
            <div className="px-4 mb-4">
                <Skeleton className="h-5 w-32 rounded" />
            </div>
            <div className="px-4 flex gap-3 overflow-hidden">
                {Array.from({ length: count }).map((_, i) => (
                    <ProductCardSkeleton key={i} index={i} />
                ))}
            </div>
        </div>
    );
});

/**
 * Hero Section Skeleton
 */
export const HeroSkeleton = memo(function HeroSkeleton() {
    return (
        <section className="flex flex-col gap-2 p-4">
            <Skeleton className="w-full aspect-[2/1] rounded-2xl" />
            <div className="grid grid-cols-1 gap-2">
                <Skeleton className="w-full aspect-[4/1] rounded-xl" />
                <Skeleton className="w-full aspect-[4/1] rounded-xl" />
                <Skeleton className="w-full aspect-[4/1] rounded-xl" />
            </div>
        </section>
    );
});

/**
 * Category Rail Skeleton
 */
export const CategoryRailSkeleton = memo(function CategoryRailSkeleton() {
    return (
        <div className="py-4 bg-white border-b border-gray-100">
            <div className="px-4 mb-4">
                <Skeleton className="h-4 w-24 rounded" />
            </div>
            <div className="flex gap-3 px-4 overflow-hidden">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                        <Skeleton className="w-16 h-16 rounded-full" />
                        <Skeleton className="h-3 w-12 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
});

export default Skeleton;
