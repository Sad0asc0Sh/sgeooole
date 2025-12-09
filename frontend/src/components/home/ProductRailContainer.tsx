"use client";

import { memo, useMemo } from "react";
import ProductRail from "./ProductRail";
import { Product } from "@/services/productService";
import { useNewestProducts, useBestSellers } from "@/hooks/useProducts";

interface ProductRailContainerProps {
  title: string;
  fetchType: "newest" | "bestSellers" | "discounted" | "all";
  limit?: number;
}

/**
 * Product Rail Container with SWR-based caching
 * OPTIMIZED: Uses SWR hooks for automatic caching and background revalidation
 */
function ProductRailContainer({
  title,
  fetchType,
  limit = 10,
}: ProductRailContainerProps) {
  // Use appropriate SWR hook based on fetchType
  const newestHook = useNewestProducts(fetchType === "newest" ? limit : 0);
  const bestSellersHook = useBestSellers(fetchType === "bestSellers" ? limit : 0);

  // Select the appropriate data based on fetchType
  const { products, isLoading, error } = useMemo(() => {
    switch (fetchType) {
      case "newest":
        return {
          products: newestHook.products,
          isLoading: newestHook.isLoading,
          error: newestHook.error,
        };
      case "bestSellers":
        return {
          products: bestSellersHook.products,
          isLoading: bestSellersHook.isLoading,
          error: bestSellersHook.error,
        };
      default:
        return { products: [], isLoading: false, error: null };
    }
  }, [fetchType, newestHook, bestSellersHook]);

  // Loading skeleton - optimized with CSS animations
  if (isLoading) {
    return (
      <div className="py-4 bg-white border-b border-gray-100">
        <div className="px-4 mb-4">
          <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
        </div>
        <div className="px-4 flex gap-3 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="min-w-[148px] h-[240px] bg-gray-100 rounded-lg animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state with retry button
  if (error) {
    return (
      <div className="py-4 bg-white border-b border-gray-100">
        <div className="px-4 mb-4">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
        </div>
        <div className="px-4 py-8 text-center">
          <p className="text-red-500 text-sm">خطا در بارگذاری محصولات</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
          >
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  // No products found
  if (products.length === 0) {
    return null; // Don't show empty sections
  }

  // Render ProductRail with fetched data
  return <ProductRail title={title} products={products} />;
}

// Export with memo for component-level memoization
export default memo(ProductRailContainer);
