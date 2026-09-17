"use client";

import { memo } from "react";
import { useFlashDeals } from "@/hooks/useProducts";
import { usePromotionBoundary } from "@/hooks/usePromotionBoundary";
import { resolveProductPromotion } from "@/lib/promotions/productPromotion";
import { getPromotionCopy } from "@/lib/promotions/promotionCopy";
import HomeProductRail from "./HomeProductRail";

function FlashOfferRail() {
  const { flashDeals, isLoading } = useFlashDeals(10);
  const now = usePromotionBoundary(flashDeals);
  const products = flashDeals.filter((product) => resolveProductPromotion(product, now).isFlashDealActive);

  if (!isLoading && products.length === 0) return null;

  return (
    <HomeProductRail
      title={getPromotionCopy("promotion.section.timed.title")}
      description={getPromotionCopy("promotion.section.timed.description")}
      viewAllHref="/products?sort=flash"
      railKey="flash_deals"
      tone="promotion"
      products={products}
      now={now}
      loading={isLoading}
    />
  );
}

export default memo(FlashOfferRail);
