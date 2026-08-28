"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import ResilientImage from "@/components/ui/ResilientImage";
import ProductTimerBadge from "@/components/product/ProductTimerBadge";
import { useWishlist } from "@/hooks/useWishlist";
import { getBlurDataURL } from "@/lib/blurPlaceholder";
import { buildProductUrl } from "@/lib/paths";
import { CURRENCY_LABEL, faPercent, faPrice, faPriceLabel, faDigits } from "@/lib/persian";
import { getPromotionCopy } from "@/lib/promotions/promotionCopy";
import {
    getNextPromotionExpiry,
    resolveProductPromotion,
} from "@/lib/promotions/productPromotion";
import type { Product } from "@/types/product";

/**
 * The storefront's single product card.
 * ============================================================================
 * WHY THIS EXISTS
 *
 * Product presentation was previously implemented five times — `ProductCard`,
 * `OptimizedProductCard`, and inline copies inside `ProductRail`,
 * `FlashOfferRail` and `SpecialOfferRail`. Each had drifted:
 *
 *   - three different discount-badge colours for the same meaning
 *     (`bg-red-500`, `#ef394e`, `bg-rose-600`)
 *   - four different pricing calculations, two of which disagreed with the
 *     shared `resolveProductPromotion` resolver about which price to show
 *   - flash cards carried a 4px gradient bar + coloured header + centred timer
 *     over the product photo, so the promotion out-shouted the product
 *
 * That last point is the real UX problem. On a security-equipment store the
 * customer is matching a model number and a spec. Anything that competes with
 * product recognition costs a sale. So this card has a strict priority order:
 *
 *     photo → name → price → availability → why it's highlighted
 *
 * Promotion state is expressed only through a single small chip and a border
 * tint. Never a gradient bar, never a coloured card, never a badge over
 * the product itself.
 *
 * DENSITY
 * `density="comfortable"` — grid/listing pages, ~2 per row on mobile.
 * `density="compact"`     — horizontal rails, where cards are ~150px wide.
 * Both share one DOM structure and one pricing path, so a fix in one is a fix
 * in both. That was the whole point of consolidating.
 */

type ProductCardDensity = "comfortable" | "compact";

interface ProductCardProps {
    product: Product;
    /** Eager-load the image. Only for cards above the fold. */
    priority?: boolean;
    density?: ProductCardDensity;
    /** Rendering context, for the accessible name only. */
    context?: string;
}

export default function ProductCard({
    product,
    priority = false,
    density = "comfortable",
    context,
}: ProductCardProps) {
    const { toggleWishlist, isInWishlist } = useWishlist();
    const [, forcePromotionBoundaryRender] = useState(0);

    const isFavorite = isInWishlist(product.id);
    const isOutOfStock = product.countInStock <= 0;
    const isLowStock = product.countInStock > 0 && product.countInStock <= 3;

    const { kind: promotionKind, effectiveDiscount, displayPrice, endTime } =
        resolveProductPromotion(product, Date.now());

    // Only show a struck-through price when there is a real, higher reference
    // price. The old cards would render an empty crossed-out row, which reads
    // as a broken discount.
    const referencePrice = product.compareAtPrice || product.oldPrice;
    const showReferencePrice =
        effectiveDiscount > 0 &&
        !isOutOfStock &&
        Boolean(referencePrice) &&
        (referencePrice as number) > displayPrice;

    // Re-render exactly once, when the nearest promotion actually expires.
    // `ProductTimerBadge` owns its own ticking, so the card does not re-render
    // every second — with 10 cards per rail that used to be 10 renders/second.
    useEffect(() => {
        const nextExpiry = getNextPromotionExpiry(product, Date.now());
        if (!nextExpiry) return;

        const delay = Math.max(0, nextExpiry - Date.now()) + 50;
        const id = window.setTimeout(
            () => forcePromotionBoundaryRender((version) => version + 1),
            delay,
        );

        return () => window.clearTimeout(id);
    }, [product]);

    const isTimed = promotionKind === "flash" || promotionKind === "amazing" || promotionKind === "campaign";

    // One chip answers "why am I looking at this?". A named admin campaign wins
    // because it carries real editorial meaning; otherwise we fall back to the
    // neutral "time-limited" language rather than exposing which internal flag
    // happened to be set.
    const reasonLabel = product.campaignLabel?.trim()
        ? product.campaignLabel.trim()
        : isTimed
            ? getPromotionCopy("promotion.reason.timed.label")
            : null;

    const isCompact = density === "compact";
    const href = buildProductUrl(product);

    const handleToggleWishlist = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        toggleWishlist(product);
    };

    // The whole card is one link, so the accessible name has to carry
    // everything a sighted user gets from the layout.
    const accessibleName = [
        product.title || product.name,
        context,
        faPriceLabel(displayPrice),
        isOutOfStock ? getPromotionCopy("availability.outOfStock") : null,
        effectiveDiscount > 0 && !isOutOfStock ? `${faPercent(effectiveDiscount)} تخفیف` : null,
    ]
        .filter(Boolean)
        .join("، ");

    return (
        <article
            className={[
                "group relative flex h-full flex-col overflow-hidden rounded-xl border bg-surface",
                "transition-[border-color,box-shadow] duration-200",
                // Promotion is signalled by a warm border, not by repainting the
                // card. Keeps the photo on a neutral white ground where the
                // product's own colours stay true.
                isTimed && !isOutOfStock
                    ? "border-kala-200 hover:border-kala-300"
                    : "border-line-soft hover:border-line-strong",
                isOutOfStock ? "opacity-[0.72]" : "hover:shadow-e2",
            ].join(" ")}
        >
            {/* --- Media ------------------------------------------------------
                `object-contain` on white: product photography for cameras, NVRs
                and cables arrives on varied backgrounds at varied aspect
                ratios, and cropping them (`cover`) cuts off the connector or
                lens that identifies the model. */}
            <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-surface">
                <ResilientImage
                    src={product.image || "/placeholder.svg"}
                    alt={product.title || product.name}
                    fill
                    className={[
                        "object-contain p-2 transition-transform duration-500",
                        isOutOfStock ? "grayscale-[0.65] opacity-70" : "group-hover:scale-[1.04]",
                    ].join(" ")}
                    sizes={
                        isCompact
                            ? "(max-width: 640px) 45vw, 160px"
                            : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 22vw, 240px"
                    }
                    loading={priority ? "eager" : "lazy"}
                    priority={priority}
                    fetchPriority={priority ? "high" : "auto"}
                    quality={75}
                    placeholder="blur"
                    blurDataURL={getBlurDataURL()}
                    fallbackSrc="/placeholder.svg"
                />

                {endTime && !isOutOfStock ? <ProductTimerBadge targetDate={endTime} /> : null}

                {isOutOfStock ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/45">
                        <span className="rounded-full border border-line bg-surface/95 px-3 py-1 text-[11px] font-bold text-ink-muted shadow-e1">
                            {getPromotionCopy("availability.outOfStock")}
                        </span>
                    </div>
                ) : null}
            </div>

            {/* --- Wishlist ---------------------------------------------------
                Sits above the card link with a real 40px touch target. In the
                compact rail density it is hidden: at ~150px wide it collided
                with the product name and was mis-tapped constantly. */}
            {!isCompact ? (
                <button
                    type="button"
                    onClick={handleToggleWishlist}
                    aria-pressed={isFavorite}
                    aria-label={
                        isFavorite
                            ? `حذف ${product.title || product.name} از علاقه‌مندی‌ها`
                            : `افزودن ${product.title || product.name} به علاقه‌مندی‌ها`
                    }
                    className={[
                        "absolute top-2 end-2 z-30 flex h-10 w-10 items-center justify-center rounded-full",
                        "border bg-surface/95 backdrop-blur-sm transition-colors",
                        isFavorite
                            ? "border-signal-urgent/25 text-signal-urgent"
                            : "border-line text-ink-faint hover:border-line-strong hover:text-ink-muted",
                    ].join(" ")}
                >
                    <Heart size={17} className={isFavorite ? "fill-current" : undefined} aria-hidden="true" />
                </button>
            ) : null}

            {/* --- Body ------------------------------------------------------ */}
            <div className={`flex min-w-0 flex-1 flex-col ${isCompact ? "gap-1.5 p-2.5" : "gap-2 p-3.5"}`}>
                {/* Reason chip and stock warning share one row with a reserved
                    height, so cards in a rail keep their price lines aligned
                    whether or not they carry a promotion. */}
                {(reasonLabel || isLowStock) && !isOutOfStock ? (
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        {reasonLabel ? (
                            <span className="inline-flex max-w-full items-center truncate rounded-full border border-kala-200 bg-kala-50 px-2 py-0.5 text-[10px] font-semibold text-kala-700">
                                {reasonLabel}
                            </span>
                        ) : null}
                        {isLowStock ? (
                            <span className="inline-flex shrink-0 items-center rounded-full border border-signal-urgent/20 bg-signal-urgent-soft px-2 py-0.5 text-[10px] font-semibold text-signal-urgent">
                                {faDigits(product.countInStock)} عدد باقی‌مانده
                            </span>
                        ) : null}
                    </div>
                ) : null}

                {/* Name. `h3` because cards live under a section `h2`.
                    Two lines with a reserved minimum keeps the grid even
                    without truncating mid-model-number more than necessary. */}
                <h3
                    className={[
                        "line-clamp-2 font-semibold leading-6 text-ink",
                        isCompact ? "min-h-[3rem] text-[12px]" : "min-h-[3rem] text-[13px]",
                    ].join(" ")}
                >
                    <Link
                        href={href}
                        aria-label={accessibleName}
                        className="focus-ring-none block outline-none after:absolute after:inset-0 after:content-[''] group-focus-within:after:rounded-xl group-focus-within:after:outline group-focus-within:after:outline-2 group-focus-within:after:outline-offset-2 group-focus-within:after:outline-kala-500"
                    >
                        {product.title || product.name}
                    </Link>
                </h3>

                {/* --- Price ---------------------------------------------------
                    Reference price above, current price below. Iranian
                    convention, and it means the eye lands on what you pay.
                    `tabular-nums` stops prices jitteringas digits change. */}
                <div className="mt-auto flex flex-col gap-0.5 pt-1">
                    <div className="flex h-4 items-center gap-1.5">
                        {showReferencePrice ? (
                            <>
                                <span className="inline-flex shrink-0 items-center rounded bg-signal-urgent px-1.5 py-px text-[10px] font-bold leading-tight text-ink-inverse">
                                    {faPercent(effectiveDiscount)}
                                </span>
                                <span className="truncate text-[11px] tabular-nums text-ink-faint line-through">
                                    {faPrice(referencePrice)}
                                </span>
                            </>
                        ) : null}
                    </div>

                    <div className="flex items-baseline gap-1">
                        <span
                            className={[
                                "font-bold tabular-nums tracking-tight",
                                isCompact ? "text-[15px]" : "text-[17px]",
                                isOutOfStock ? "text-ink-faint" : "text-ink",
                            ].join(" ")}
                        >
                            {faPrice(displayPrice)}
                        </span>
                        <span className="shrink-0 text-[10px] font-medium text-ink-faint">
                            {CURRENCY_LABEL}
                        </span>
                    </div>
                </div>
            </div>
        </article>
    );
}
