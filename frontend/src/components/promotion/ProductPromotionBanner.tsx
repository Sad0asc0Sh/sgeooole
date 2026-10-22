"use client";

import { Store } from "lucide-react";
import CountdownTimer from "@/components/ui/CountdownTimer";
import {
    getPromotionThemeScheme,
    type PromotionSurfaceKind,
} from "@/lib/campaignTheme";
import { resolveProductPromotion } from "@/lib/promotions/productPromotion";
import { getServerNow } from "@/lib/serverClock";
import type { Product } from "@/types/product";

/**
 * Product-detail countdown banner for every live promotion
 * (flash deal, named campaign, «شگفت‌انگیز»).
 *
 * The colours come from lib/campaignTheme.ts — the same scheme the product card
 * paints — so a «پیشنهاد لحظه‌ای» carries the amber→orange→red gradient from the
 * card rail into the product page instead of a separate gold/pastel treatment.
 * One component serves both layouts, which is what keeps the mobile and desktop
 * banners identical.
 */

const DEFAULT_LABEL: Record<Exclude<PromotionSurfaceKind, "none">, string> = {
    flash: "پیشنهاد لحظه‌ای",
    campaign: "فروش ویژه",
    amazing: "پیشنهاد شگفت‌انگیز",
};

type ProductPromotionBannerProps = {
    product: Product;
    /** Compact density for the mobile layout. */
    compact?: boolean;
};

export default function ProductPromotionBanner({ product, compact = false }: ProductPromotionBannerProps) {
    // Same resolver the cards and the price box use: a promotion whose countdown
    // already ended resolves to "none" and simply disappears here.
    const now = getServerNow();
    const promotion = resolveProductPromotion(product, now);
    // A named campaign can carry an end time without the special-offer flag, so
    // resolve a live boundary explicitly — never render an expired countdown.
    const endTime = promotion.endTime;
    const endTimestamp = endTime ? Date.parse(endTime) : NaN;
    if (promotion.kind === "none" || !endTime || !Number.isFinite(endTimestamp) || endTimestamp <= now) {
        return null;
    }

    const scheme = getPromotionThemeScheme(promotion.kind, product.campaignTheme);
    const label = product.campaignLabel?.trim() || DEFAULT_LABEL[promotion.kind];

    return (
        <div className={compact ? "mb-4" : "mb-6"}>
            <div
                className={`flex items-center justify-between gap-3 rounded-xl ${compact ? "p-3" : "p-4"} ${scheme.banner}`}
                data-promotion-banner={promotion.kind}
            >
                <span className={`flex min-w-0 items-center gap-2 font-bold ${compact ? "text-sm" : "text-base"}`}>
                    <Store size={compact ? 16 : 18} aria-hidden className="shrink-0" />
                    <span className="truncate">{label}</span>
                </span>
                <div className={`flex shrink-0 items-center gap-2 ${scheme.bannerChip}`} dir="ltr">
                    <CountdownTimer
                        targetDate={endTime}
                        className={compact ? "text-sm font-bold" : "text-base font-bold"}
                    />
                </div>
            </div>
        </div>
    );
}
