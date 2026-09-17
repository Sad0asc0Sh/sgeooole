"use client";

import { memo } from "react";
import ProductRail from "./ProductRail";
import HomeProductRail from "./HomeProductRail";
import { useNewestProducts, useBestSellers } from "@/hooks/useProducts";

interface ProductRailContainerProps {
  title: string;
  fetchType: "newest" | "bestSellers" | "discounted" | "all";
  limit?: number;
}

function ProductRailContainer({ title, fetchType, limit = 10 }: ProductRailContainerProps) {
  const newest = useNewestProducts(fetchType === "newest" ? limit : 0);
  const bestSellers = useBestSellers(fetchType === "bestSellers" ? limit : 0);
  const source = fetchType === "newest" ? newest : fetchType === "bestSellers" ? bestSellers : null;
  if (!source) return null;

  const { products, isLoading, error, refresh } = source;
  const viewAllHref = fetchType === "newest" ? "/products?sort=newest" : "/products?sort=bestSelling";
  const description = fetchType === "newest" ? "تازه‌ترین محصولات فروشگاه" : "انتخاب‌های پرطرفدار خریداران";

  if (products.length === 0 && (isLoading || error)) {
    return <HomeProductRail title={title} description={description} products={[]} viewAllHref={viewAllHref}
      railKey={`rail_${title}`} now={Date.now()} loading={isLoading} error={Boolean(error)} onRetry={() => { void refresh(); }} />;
  }
  if (products.length === 0) return null;
  return <ProductRail title={title} description={description} products={products} viewAllHref={viewAllHref} />;
}

export default memo(ProductRailContainer);
