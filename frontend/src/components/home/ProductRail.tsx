"use client";

import type { Product } from "@/types/product";
import { usePromotionBoundary } from "@/hooks/usePromotionBoundary";
import HomeProductRail from "./HomeProductRail";

interface ProductRailProps {
  title: string;
  products: Product[];
  viewAllHref?: string;
  description?: string;
}

export default function ProductRail({ title, products, viewAllHref = "/products", description = "محصولات منتخب برای شما", onExpire }: ProductRailProps & { onExpire?: () => void }) {
  const now = usePromotionBoundary(products, onExpire);
  return <HomeProductRail title={title} description={description} products={products} viewAllHref={viewAllHref} railKey={`rail_${title}`} now={now} />;
}
