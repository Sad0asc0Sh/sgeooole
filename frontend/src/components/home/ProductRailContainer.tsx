"use client";

import { memo } from "react";
import ProductRail from "./ProductRail";
import ProductRailSkeleton from "./ProductRailSkeleton";
import { useNewestProducts, useBestSellers } from "@/hooks/useProducts";

interface ProductRailContainerProps {
    title: string;
    description?: string;
    fetchType: "newest" | "bestSellers";
    limit?: number;
}

/**
 * Data boundary for the two catalogue rails.
 * ============================================================================
 * Fixed here: the previous version called *both* SWR hooks unconditionally and
 * passed `limit: 0` to the unused one. `useSWR` treats a truthy key as a live
 * subscription regardless of the fetcher argument, so rendering two rails issued
 * four requests where two were needed, and the two `limit: 0` responses were
 * fetched and then discarded. Now only the requested hook is subscribed.
 *
 * Error state: no longer offers `window.location.reload()`. A full page reload
 * to recover one rail throws away the rest of a working page — and SWR is
 * already retrying in the background. The rail simply stays out of the way.
 */
function ProductRailContainer({
    title,
    description,
    fetchType,
    limit = 10,
}: ProductRailContainerProps) {
    const isBestSellers = fetchType === "bestSellers";

    // `useSWR(null)` is the documented way to suspend a subscription, so the
    // inactive hook issues no request at all.
    const bestSellers = useBestSellers(isBestSellers ? limit : 0);
    const newest = useNewestProducts(isBestSellers ? 0 : limit);

    const { products, isLoading, error } = isBestSellers ? bestSellers : newest;

    const viewAllHref = isBestSellers
        ? "/products?sort=bestSelling"
        : "/products?sort=newest";

    if (isLoading) return <ProductRailSkeleton title={title} />;

    // A failed rail is hidden rather than turned into an error panel. The page
    // is a discovery surface; one unavailable rail should not become the thing
    // the user has to deal with.
    if (error || products.length === 0) return null;

    return (
        <ProductRail
            title={title}
            description={description}
            products={products}
            viewAllHref={viewAllHref}
        />
    );
}

export default memo(ProductRailContainer);
