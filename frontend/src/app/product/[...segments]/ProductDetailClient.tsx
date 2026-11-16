"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDisableScrollRestoration } from "@/hooks/useScrollRestoration";
import ProductDetailLayout from "./ProductDetailLayout";
import type { Product, ProductColor } from "@/services/productService";
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

// Fingerprint of every field that affects the displayed price / promotion.
// Used to detect that a *new snapshot of the same product* arrived
// (e.g. Next.js served a fresh RSC payload after an admin discount edit)
// even though the product id did not change.
const pricingFingerprint = (p: Product) =>
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
        (p.variants ?? []).map((v) => [v.id, v.price, v.oldPrice ?? null, v.stock]),
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
    const [snapshot, setSnapshot] = useState<Product>(initialProduct);
    // رنگ‌های legacy محصول ساده (فیلد `colors` بک‌اند) — برای سازگاری عقب‌رو نگه داشته شد.
    const [selectedColor, setSelectedColor] = useState<ProductColor | null>(
        initialProduct.colors && initialProduct.colors.length > 0 ? initialProduct.colors[0] : null
    );
    // انتخاب محصول متغیر (سیستم جدید `attributes`/`variants`).
    const [selection, setSelection] = useState<Selection>(() =>
        initialSelection(initialProduct.variants ?? [])
    );

    // Re-render exactly at the next promotion expiry so the label disappears together
    // with the price reverting, without re-rendering the page every second.
    const boundaryInput = useMemo(() => [snapshot], [snapshot]);
    const now = usePromotionBoundary(boundaryInput);
    const product = useMemo(() => stripExpiredPromotion(snapshot, now), [snapshot, now]);

    // مشتق‌های variant: variant انتخاب‌شده + محصول نمایشی (قیمت/موجودی/تصویر variant).
    // برای محصول ساده selectedVariant همیشه undefined و viewProduct همان product است.
    const selectedVariant = useMemo(
        () => findVariant(product.variants ?? [], selection),
        [product.variants, selection]
    );
    const viewProduct = useMemo(
        () => withSelectedVariant(product, selectedVariant),
        [product, selectedVariant]
    );
    // variantOptions یکپارچه برای سبد: سیستم جدید یا رنگ‌های legacy.
    const variantOptions = useMemo(
        () =>
            (product.variants ?? []).length > 0
                ? toOptions(selection)
                : selectedColor
                    ? [{ name: "رنگ", value: selectedColor.name }]
                    : [],
        [product.variants, selection, selectedColor]
    );
    const handleVariantChange = useCallback(
        (name: string, value: string) =>
            setSelection((s) => applyChoice(product.variants ?? [], s, name, value)),
        [product.variants]
    );

    // Sync state when navigating between products AND when a newer snapshot of the SAME
    // product arrives from the server (ISR revalidation / router refresh).
    // IMPORTANT: this effect must react only to changes of `initialProduct`. It used to
    // also depend on the local state, so a fresher live snapshot fetched on the client
    // differed from `initialProduct` and was immediately overwritten by the stale SSR one.
    const lastInitialFingerprint = useRef(pricingFingerprint(initialProduct));
    useEffect(() => {
        const incomingFingerprint = pricingFingerprint(initialProduct);
        setSnapshot((prev) => {
            if (initialProduct.id !== prev.id) {
                lastInitialFingerprint.current = incomingFingerprint;
                return initialProduct;
            }
            if (incomingFingerprint !== lastInitialFingerprint.current) {
                lastInitialFingerprint.current = incomingFingerprint;
                return initialProduct;
            }
            return prev;
        });
    }, [initialProduct]);

    // Reset color/selection when navigating to another product.
    const lastProductId = useRef(initialProduct.id);
    useEffect(() => {
        if (lastProductId.current === initialProduct.id) return;
        lastProductId.current = initialProduct.id;
        setSelectedColor(initialProduct.colors && initialProduct.colors.length > 0 ? initialProduct.colors[0] : null);
        setSelection(initialSelection(initialProduct.variants ?? []));
    }, [initialProduct]);

    // Live-price guard: the SSR/ISR snapshot can be up to `revalidate` seconds old (plus
    // Next.js router cache on client-side navigation). Fetch the current snapshot right
    // after mount, whenever the tab becomes visible again, and once more right after a
    // promotion ends. Failures are ignored on purpose: the current snapshot stays visible.
    const refreshLivePriceRef = useRef<() => void>(() => {});
    useEffect(() => {
        let cancelled = false;

        const refreshLivePrice = async () => {
            try {
                const { productService } = await import("@/services/productService");
                const fresh = await productService.getById(initialProduct.id);
                if (cancelled || !fresh || fresh.id !== initialProduct.id) return;
                setSnapshot((prev) => {
                    if (prev.id !== fresh.id) return prev;
                    return pricingFingerprint(prev) === pricingFingerprint(fresh) ? prev : fresh;
                });
            } catch {
                // Keep the current snapshot when offline or when the backend is unreachable.
            }
        };

        refreshLivePriceRef.current = refreshLivePrice;
        refreshLivePrice();

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") refreshLivePrice();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            cancelled = true;
            refreshLivePriceRef.current = () => {};
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
        refreshLivePriceRef.current();
    }, [product, snapshot]);

    // انتخاب را معتبر نگه دار وقتی snapshot تازه می‌رسد (مثلاً ادمین حین باز
    // بودن صفحه متغیرها را عوض کرده): بازگشت به اولین variant موجود.
    // برای محصول ساده (بدون variants) هیچ کاری نمی‌کند.
    useEffect(() => {
        const vs = product.variants ?? [];
        if (vs.length === 0) return;
        setSelection((s) => (findVariant(vs, s) ? s : initialSelection(vs)));
    }, [product.variants]);

    return <ProductDetailLayout product={product} viewProduct={viewProduct} selection={selection} selectedVariant={selectedVariant} selectedColor={selectedColor} variantOptions={variantOptions} onVariantChange={handleVariantChange} onColorChange={setSelectedColor} />;
}
