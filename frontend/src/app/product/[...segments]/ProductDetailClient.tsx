"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDisableScrollRestoration } from "@/hooks/useScrollRestoration";
import ProductDetailLayout from "./ProductDetailLayout";
import type { Product, ProductVariant } from "@/types/product";
import { useLayoutState } from "@/providers/LayoutStateProvider";
import { usePromotionBoundary } from "@/hooks/usePromotionBoundary";
import { stripExpiredPromotion } from "@/lib/promotions/productPromotion";
import {
    applyChoice,
    findVariant,
    initialSelection,
    toOptions,
    withSelectedVariant,
    type Selection,
} from "@/lib/variants";

type ProductDetailClientProps = {
    product: Product;
};

const noVariants: ProductVariant[] = [];

// Same-id updates can change what is selectable or photographed without changing the price.
const catalogFingerprint = (p: Product) =>
    JSON.stringify([
        p.price,
        p.oldPrice ?? null,
        p.compareAtPrice ?? null,
        p.discount ?? 0,
        p.campaignLabel ?? null,
        p.campaignTheme ?? null,
        Boolean(p.isFlashDeal),
        p.flashDealEndTime ?? null,
        Boolean(p.isSpecialOffer),
        p.specialOfferEndTime ?? null,
        p.countInStock ?? null,
        p.productType ?? "simple",
        p.sku,
        p.image,
        p.images,
        p.cardImage,
        p.cardImages,
        p.colors,
        p.attributes,
        p.variants,
    ]);

export default function ProductDetailClient({ product: initialProduct }: ProductDetailClientProps) {
    // Disable scroll restoration for product detail pages - always start at top
    useDisableScrollRestoration();

    const { setIsProductPage } = useLayoutState();

    useEffect(() => {
        setIsProductPage(true);
        return () => setIsProductPage(false);
    }, [setIsProductPage]);

    // `snapshot` is the latest data received from the server (SSR/ISR or live refetch).
    // `product` (below) is what the UI renders: the snapshot with any promotion whose
    // countdown has already ended stripped out (label, badge, discount, old price).
    const [savedSnapshot, setSnapshot] = useState<Product>(initialProduct);
    const snapshot = savedSnapshot.id === initialProduct.id ? savedSnapshot : initialProduct;
    const incomingFingerprint = useMemo(() => catalogFingerprint(initialProduct), [initialProduct]);
    const lastServerSnapshot = useRef({ id: initialProduct.id, fingerprint: incomingFingerprint });
    const latestRequest = useRef(0);

    // Re-render exactly at the next promotion expiry so the label disappears together
    // with the price reverting, without re-rendering the page every second.
    const boundaryInput = useMemo(() => [snapshot], [snapshot]);
    const now = usePromotionBoundary(boundaryInput);
    const product = useMemo(() => {
        const current = stripExpiredPromotion(snapshot, now);
        if (current === snapshot || !current.variants?.length) return current;

        // Price hints and the chooser use the same post-expiry prices as the purchase bar.
        const variants = current.variants.map((variant) => {
            const { price, oldPrice } = withSelectedVariant(current, variant);
            return { ...variant, price, oldPrice };
        });
        return { ...current, variants };
    }, [snapshot, now]);

    // Check incoming server props independently of client refreshes so an old
    // server-rendered snapshot cannot replace a live update during a re-render.
    useEffect(() => {
        const previous = lastServerSnapshot.current;
        if (previous.id === initialProduct.id && previous.fingerprint === incomingFingerprint) return;
        lastServerSnapshot.current = { id: initialProduct.id, fingerprint: incomingFingerprint };
        latestRequest.current += 1;
        setSnapshot(initialProduct);
    }, [initialProduct, incomingFingerprint]);

    // Live-price guard: the SSR/ISR snapshot can be up to `revalidate` seconds old (plus
    // Next.js router cache on client-side navigation). Fetch the current snapshot right
    // after mount, whenever the tab becomes visible again, and once more right after a
    // promotion ends. Failures are ignored on purpose: the current snapshot stays visible.
    const refreshLiveProductRef = useRef<() => void>(() => {});
    useEffect(() => {
        let cancelled = false;

        const refreshLiveProduct = async () => {
            const request = ++latestRequest.current;
            try {
                const { productService } = await import("@/services/productService");
                const fresh = await productService.getById(initialProduct.id);
                if (!fresh || fresh.id !== initialProduct.id) return;
                setSnapshot((prev) => {
                    if (cancelled || request !== latestRequest.current || prev.id !== fresh.id) return prev;
                    return catalogFingerprint(prev) === catalogFingerprint(fresh) ? prev : fresh;
                });
            } catch {
                // Keep the current snapshot when offline or when the backend is unreachable.
            }
        };

        refreshLiveProductRef.current = refreshLiveProduct;
        void refreshLiveProduct();

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") void refreshLiveProduct();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            cancelled = true;
            refreshLiveProductRef.current = () => {};
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [initialProduct.id]);

    // When a promotion has just ended (the rendered product differs from the snapshot),
    // ask the server for the authoritative state once per distinct end time. The key
    // guard prevents a loop if a cached response still carries the expired promotion.
    const expiryRefetchKey = useRef<string | null>(null);
    useEffect(() => {
        if (product === snapshot) return;
        const key = `${snapshot.id}|${snapshot.flashDealEndTime ?? ""}|${snapshot.specialOfferEndTime ?? ""}`;
        if (expiryRefetchKey.current === key) return;
        expiryRefetchKey.current = key;
        refreshLiveProductRef.current();
    }, [product, snapshot]);

    return <ProductDetailSelection key={product.id} product={product} now={now} />;
}

function ProductDetailSelection({ product, now }: { product: Product; now: number }) {
    const variants = product.variants ?? noVariants;
    const [requestedSelection, setRequestedSelection] = useState<Selection>(() => initialSelection(variants));
    const [colorId, setColorId] = useState<number>();
    const colors = product.colors ?? [];
    const selectedColor = colors.find((color) => color.id === colorId) ?? colors[0] ?? null;

    // Resolve against the current catalog during render so every section uses a
    // valid selection even on the first frame after a live catalog update.
    const matchedVariant = findVariant(variants, requestedSelection);
    const selection = matchedVariant ? requestedSelection : initialSelection(variants);
    const selectedVariant = matchedVariant ?? findVariant(variants, selection);
    const viewProduct = selectedVariant
        ? withSelectedVariant(product, selectedVariant)
        : variants.length ? { ...product, countInStock: 0 } : product;
    const variantOptions = variants.length
        ? toOptions(selection)
        : selectedColor ? [{ name: "رنگ", value: selectedColor.name }] : [];

    useEffect(() => {
        setRequestedSelection((previous) => findVariant(variants, previous) ? previous : initialSelection(variants));
    }, [variants]);

    const handleVariantChange = useCallback((name: string, value: string) => {
        setRequestedSelection((previous) => {
            const current = findVariant(variants, previous) ? previous : initialSelection(variants);
            const next = applyChoice(variants, current, name, value);
            return findVariant(variants, next) ? next : previous;
        });
    }, [variants]);

    return (
        <ProductDetailLayout
            product={product}
            viewProduct={viewProduct}
            now={now}
            selection={selection}
            selectedVariant={selectedVariant}
            selectedColor={selectedColor}
            variantOptions={variantOptions}
            onVariantChange={handleVariantChange}
            onColorChange={(color) => setColorId(color.id)}
        />
    );
}
