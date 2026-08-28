"use client";

import { memo, useEffect, useMemo, useState } from "react";
import SectionHeader from "@/components/ui/SectionHeader";
import ProductCardRail from "@/components/product/ProductCardRail";
import Countdown from "@/components/ui/Countdown";
import { useSpecialOffers } from "@/hooks/useProducts";
import { getPromotionCopy } from "@/lib/promotions/promotionCopy";
import { toTimestamp } from "@/lib/persian";

/**
 * Curated expert picks.
 * ============================================================================
 * Backed by the `isSpecialOffer` mechanism, but presented as an *editorial*
 * selection rather than a second sale. Previously this section and the flash
 * rail were near-identical — same layout, same card, same countdown, adjacent
 * on the page — so users had no way to tell why a product was in one and not
 * the other, and the repetition made the page feel like a sale festival.
 *
 * Now the distinction is stated in the copy («انتخاب کارشناسی» vs
 * «فرصت‌های زمان‌دار»), the two are separated on the page by the product and
 * category bands, and the countdown here is secondary rather than the headline.
 *
 * Pricing and promotion resolution moved to `ProductCard`, which fixes a real
 * inconsistency: this file used to compute `effectiveDiscount` with a different
 * rule than the flash rail, so the same product could show a different discount
 * depending on which section it appeared in.
 */
function SpecialOfferRail() {
    const { specialOffers, isLoading, error } = useSpecialOffers(10);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    const activeOffers = useMemo(
        () =>
            specialOffers.filter((product) => {
                if (!product.specialOfferEndTime) return true;
                const endsAt = toTimestamp(product.specialOfferEndTime);
                return !Number.isFinite(endsAt) || endsAt > now;
            }),
        [specialOffers, now],
    );

    const earliestExpiry = useMemo(() => {
        const timestamps = activeOffers
            .map((product) => toTimestamp(product.specialOfferEndTime))
            .filter((value) => Number.isFinite(value) && value > now);
        return timestamps.length > 0 ? Math.min(...timestamps) : undefined;
    }, [activeOffers, now]);

    if (isLoading || error || activeOffers.length === 0) return null;

    const title = getPromotionCopy("promotion.section.curated.title");

    return (
        <div className="space-y-5">
            <SectionHeader
                id="home-curated-offers"
                title={title}
                description={getPromotionCopy("promotion.section.curated.description")}
                actionHref="/products?sort=special"
                actionLabel={getPromotionCopy("promotion.action.viewAll")}
                aside={
                    earliestExpiry ? (
                        <Countdown
                            targetDate={earliestExpiry}
                            variant="pill"
                            prefix={getPromotionCopy("promotion.time.endsIn")}
                        />
                    ) : undefined
                }
            />

            <ProductCardRail
                products={activeOffers}
                railKey="special_offers"
                viewAllHref="/products?sort=special"
                label={title}
                context={getPromotionCopy("promotion.reason.curated.label")}
            />
        </div>
    );
}

export default memo(SpecialOfferRail);
