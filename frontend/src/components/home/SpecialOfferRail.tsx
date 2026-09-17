"use client";

import { memo } from "react";
import { useSpecialOffers } from "@/hooks/useProducts";
import { usePromotionBoundary } from "@/hooks/usePromotionBoundary";
import { resolveProductPromotion } from "@/lib/promotions/productPromotion";
import { getPromotionCopy } from "@/lib/promotions/promotionCopy";
import Countdown from "@/components/ui/Countdown";
import HomeProductRail from "./HomeProductRail";

function SpecialOfferRail() {
  const { specialOffers, isLoading } = useSpecialOffers(10);
  const now = usePromotionBoundary(specialOffers);
  const products = specialOffers.filter((product) => resolveProductPromotion(product, now).isSpecialOfferActive);
  const earliestEndTime = products.length
    ? Math.min(...products.map((product) => Date.parse(product.specialOfferEndTime!)))
    : undefined;

  if (!isLoading && products.length === 0) return null;

  return (
    <HomeProductRail
      title={getPromotionCopy("promotion.section.curated.title")}
      description={getPromotionCopy("promotion.section.curated.description")}
      viewAllHref="/products?sort=special"
      railKey="special_offers"
      tone="promotion"
      products={products}
      now={now}
      loading={isLoading}
      countdown={earliestEndTime ? <Countdown targetDate={earliestEndTime} variant="compact" /> : undefined}
    />
  );
}

export default memo(SpecialOfferRail);
