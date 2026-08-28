"use client";

import SectionHeader from "@/components/ui/SectionHeader";
import ProductCardRail from "@/components/product/ProductCardRail";
import type { Product } from "@/types/product";

interface ProductRailProps {
    title: string;
    /** One factual sentence, or omitted. */
    description?: string;
    products: Product[];
    viewAllHref?: string;
    /** `h3` when the rail is nested inside an already-titled section. */
    headingLevel?: "h2" | "h3";
}

/**
 * Titled horizontal product rail.
 * ============================================================================
 * Was ~310 lines containing an inline card implementation with its own
 * `headerConfig` block that mapped `campaignTheme` values to four different
 * gradient bars (`gold-red`, `red-purple`, `lime-orange`, `fire`). That produced
 * cards in lime green and purple sitting next to navy-and-brass cards — the
 * single largest source of visual incoherence on the homepage.
 *
 * The campaign *label* is preserved and still shown (as a chip on the card, via
 * `ProductCard`), so the admin's editorial input survives. Only the arbitrary
 * per-campaign colour theming is dropped, because a theme system that lets any
 * campaign repaint the product grid cannot produce a consistent brand.
 *
 * Also removed: the "محصولات منتخب برای شما" subtitle that was hardcoded under
 * every rail title regardless of what the rail actually contained.
 */
export default function ProductRail({
    title,
    description,
    products,
    viewAllHref = "/products",
    headingLevel = "h2",
}: ProductRailProps) {
    if (!products || products.length === 0) return null;

    const railKey = `rail_${title}`;

    return (
        <div className="space-y-5">
            <SectionHeader
                title={title}
                description={description}
                actionHref={viewAllHref}
                actionLabel="مشاهده همه"
                as={headingLevel}
            />

            <ProductCardRail
                products={products}
                railKey={railKey}
                viewAllHref={viewAllHref}
                label={title}
            />
        </div>
    );
}
