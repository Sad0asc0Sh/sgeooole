"use client";

import { memo } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Keyboard, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import ProductCard from "@/components/product/ProductCard";
import { getScrollManager } from "@/lib/scroll/ScrollManager";
import { useVelocitySnap } from "@/hooks/useVelocitySnap";
import { getPromotionCopy } from "@/lib/promotions/promotionCopy";
import type { Product } from "@/types/product";

/**
 * Horizontal product rail.
 * ============================================================================
 * The three homepage rails (`FlashOfferRail`, `SpecialOfferRail`,
 * `ProductRailContainer`) each carried their own ~120-line copy of this Swiper
 * setup, its breakpoints, its scroll-restoration wiring and its "see all" card.
 * They had already drifted apart — different `quality`, different `priority`
 * cut-offs, different arrow markup, different empty behaviour.
 *
 * Consolidating is justified here because it removes far more than it adds:
 * one rail definition replaces three, and every rail now inherits keyboard
 * support and accessible naming that none of them had.
 *
 * Kept from the original implementation because it was genuinely good:
 *   - horizontal position restoration via `ScrollManager`
 *   - `useVelocitySnap` touch tuning (deliberate one-card-per-swipe feel)
 *   - eager loading only for the first two cards
 */

type ProductCardRailProps = {
    products: Product[];
    /** Stable key for horizontal scroll restoration. */
    railKey: string;
    viewAllHref: string;
    /** Accessible name for the scroll region, e.g. «فرصت‌های زمان‌دار». */
    label: string;
    /** Passed to each card's accessible name so context is not lost. */
    context?: string;
};

function ProductCardRail({
    products,
    railKey,
    viewAllHref,
    label,
    context,
}: ProductCardRailProps) {
    const { onTouchStart, onTouchEnd } = useVelocitySnap();

    if (products.length === 0) return null;

    // Swiper requires globally unique selectors for external navigation.
    const navPrev = `rail-prev-${railKey}`;
    const navNext = `rail-next-${railKey}`;

    return (
        <div className="relative">
            <Swiper
                modules={[Navigation, Keyboard, A11y]}
                navigation={{ prevEl: `.${navPrev}`, nextEl: `.${navNext}` }}
                // Arrow-key traversal, but only once the rail itself has focus,
                // so it never hijacks page scrolling.
                keyboard={{ enabled: true, onlyInViewport: true }}
                a11y={{
                    containerRoleDescriptionMessage: "لیست افقی محصولات",
                    prevSlideMessage: "محصول قبلی",
                    nextSlideMessage: "محصول بعدی",
                }}
                onSwiper={(swiper) => {
                    const saved = getScrollManager().getHorizontal(railKey);
                    if (typeof saved === "number" && saved > 0) {
                        swiper.slideTo(saved, 0);
                    }
                }}
                onSlideChange={(swiper) => {
                    getScrollManager().saveHorizontal(railKey, swiper.activeIndex);
                }}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                shortSwipes={false}
                longSwipes={false}
                followFinger
                speed={300}
                spaceBetween={12}
                slidesPerView={2.15}
                breakpoints={{
                    480: { slidesPerView: 2.4 },
                    640: { slidesPerView: 3.2 },
                    768: { slidesPerView: 3.6 },
                    1024: { slidesPerView: 4.5 },
                    1280: { slidesPerView: 5.5 },
                    1536: { slidesPerView: 6 },
                }}
                className="product-rail-swiper w-full !pb-1"
                grabCursor
            >
                {products.map((product, index) => (
                    <SwiperSlide key={product.id} style={{ height: "auto" }}>
                        <ProductCard
                            product={product}
                            density="compact"
                            priority={index < 2}
                            context={context}
                        />
                    </SwiperSlide>
                ))}

                {/* Terminal "see all" affordance. Reads as a deliberate end to
                    the rail rather than an abrupt cut, and gives the rail a
                    second entry point into the listing. */}
                <SwiperSlide style={{ height: "auto" }}>
                    <Link
                        href={viewAllHref}
                        className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-line bg-surface-sunken px-4 py-6 text-center transition-colors hover:border-kala-300 hover:bg-surface"
                    >
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-kala-200 bg-kala-50 text-kala-700">
                            <ChevronLeft size={18} strokeWidth={2.5} aria-hidden="true" />
                        </span>
                        <span className="text-[13px] font-semibold text-ink">
                            {getPromotionCopy("promotion.action.viewAll")}
                        </span>
                        <span className="text-[11px] leading-5 text-ink-faint">{label}</span>
                    </Link>
                </SwiperSlide>
            </Swiper>

            {/* Desktop arrows. Hidden on touch, where swiping is the affordance
                and arrows only steal width from the cards.

                RTL direction is deliberate: the list begins on the right, so
                "previous" sits on the inline-start (right) edge and points
                right, and "next" sits on the inline-end (left) edge and points
                left. The rails previously had these mirrored, so the arrow you
                clicked moved the list the other way. */}
            <button
                type="button"
                aria-label={`محصولات قبلی در ${label}`}
                className={`${navPrev} absolute start-0 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/95 text-ink-muted shadow-e1 backdrop-blur-sm transition-colors hover:border-line-strong hover:text-ink md:flex`}
            >
                <ChevronLeft size={18} className="rotate-180" aria-hidden="true" />
            </button>
            <button
                type="button"
                aria-label={`محصولات بعدی در ${label}`}
                className={`${navNext} absolute end-0 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/95 text-ink-muted shadow-e1 backdrop-blur-sm transition-colors hover:border-line-strong hover:text-ink md:flex`}
            >
                <ChevronLeft size={18} aria-hidden="true" />
            </button>
        </div>
    );
}

export default memo(ProductCardRail);
