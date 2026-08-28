"use client";

import { memo, useEffect, useMemo, useState } from "react";
import SectionHeader from "@/components/ui/SectionHeader";
import ProductCardRail from "@/components/product/ProductCardRail";
import Countdown from "@/components/ui/Countdown";
import { useFlashDeals } from "@/hooks/useProducts";
import { getPromotionCopy } from "@/lib/promotions/promotionCopy";
import { toTimestamp } from "@/lib/persian";

/**
 * Time-limited opportunities.
 * ============================================================================
 * Was ~250 lines: its own Swiper config, its own card markup, its own pricing
 * arithmetic that disagreed with `resolveProductPromotion` about which price to
 * display. All of that now lives in `ProductCardRail` / `ProductCard`, so this
 * file does only what belongs to it: decide which products are still live, and
 * headline the window they close in.
 *
 * The section-level countdown shows the *earliest* expiry, because that is the
 * first moment the section's contents change. Showing the latest would be a
 * false promise.
 */
function FlashOfferRail() {
    const { flashDeals, isLoading } = useFlashDeals(10);
    const [now, setNow] = useState(() => Date.now());

    // A minute is enough: this only needs to drop expired products from the
    // list. Per-card remaining time is owned by each card's own countdown, so
    // there is no reason to re-render the whole rail every second.
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    const activeDeals = useMemo(
        () =>
            flashDeals.filter((product) => {
                if (!product.isFlashDeal || !product.flashDealEndTime) return false;
                const endsAt = toTimestamp(product.flashDealEndTime);
                return Number.isFinite(endsAt) && endsAt > now;
            }),
        [flashDeals, now],
    );

    const earliestExpiry = useMemo(() => {
        const timestamps = activeDeals
            .map((product) => toTimestamp(product.flashDealEndTime))
            .filter((value) => Number.isFinite(value));
        return timestamps.length > 0 ? Math.min(...timestamps) : undefined;
    }, [activeDeals]);

    // Render nothing rather than an empty shell. A promotion section with no
    // promotions is worse than no section.
    if (isLoading || activeDeals.length === 0) return null;

    const title = getPromotionCopy("promotion.section.timed.title");

    return (
        <div className="space-y-5">
            <SectionHeader
                id="home-timed-offers"
                title={title}
                description={getPromotionCopy("promotion.section.timed.description")}
                actionHref="/products?sort=flash"
                actionLabel={getPromotionCopy("promotion.action.viewAll")}
                aside={
                    earliestExpiry ? (
                        <Countdown
                            targetDate={earliestExpiry}
                            variant="panel"
                            prefix={getPromotionCopy("promotion.time.endsIn")}
                        />
                    ) : undefined
                }
            />

            <ProductCardRail
                products={activeDeals}
                railKey="flash_deals"
                viewAllHref="/products?sort=flash"
                label={title}
                context={getPromotionCopy("promotion.reason.timed.label")}
            />
        </div>
    );
}

export default memo(FlashOfferRail);
