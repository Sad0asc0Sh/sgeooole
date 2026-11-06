"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDisableScrollRestoration } from "@/hooks/useScrollRestoration";
import { Star, ShieldCheck, Store, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { Product, ProductColor } from "@/services/productService";
import ProductTabs from "@/components/product/ProductTabs";
import ProductPromotionBanner from "@/components/promotion/ProductPromotionBanner";
import ProductHeader from "./ProductHeader";
import ProductGallery from "./ProductGallery";
import ColorSelector from "./ColorSelector";
import VariantSelector from "./VariantSelector";
import ProductActions from "./ProductActions";
import ProductHistoryTracker from "./ProductHistoryTracker";
import ProductSocialActions from "./ProductSocialActions";
import { useLayoutState } from "@/providers/LayoutStateProvider";
import { usePromotionBoundary } from "@/hooks/usePromotionBoundary";
import { stripExpiredPromotion } from "@/lib/promotions/productPromotion";
import { getServerNow } from "@/lib/serverClock";
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

    // Memoize flash deal status
    const isFlashDealActive = useMemo(() =>
        Boolean(
            product.isFlashDeal &&
            product.flashDealEndTime &&
            new Date(product.flashDealEndTime).getTime() > getServerNow()
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [product.isFlashDeal, product.flashDealEndTime, now]
    );

    const _showCampaignBadge = useMemo(() =>
        Boolean(
            product.campaignLabel &&
            !(product.campaignLabel.includes('فلش') && !isFlashDealActive)
        ),
        [product.campaignLabel, isFlashDealActive]
    );

    // انتخاب را معتبر نگه دار وقتی snapshot تازه می‌رسد (مثلاً ادمین حین باز
    // بودن صفحه متغیرها را عوض کرده): بازگشت به اولین variant موجود.
    // برای محصول ساده (بدون variants) هیچ کاری نمی‌کند.
    useEffect(() => {
        const vs = product.variants ?? [];
        if (vs.length === 0) return;
        setSelection((s) => (findVariant(vs, s) ? s : initialSelection(vs)));
    }, [product.variants]);

    // Memoize color change handler
    const _handleColorChange = useCallback((color: ProductColor) => {
        setSelectedColor(color);
    }, []);

    return (
        <div className="min-h-screen bg-white pb-24 pt-14 md:pt-0">
            {/* Track product view */}
            <ProductHistoryTracker product={product} />

            {/* Header (Transparent/Floating) - Only show on mobile */}
            <div className="lg:hidden">
                <ProductHeader product={product} />
            </div>


            {/* Mobile Layout - Unchanged */}
            <div className="lg:hidden">
                {/* Gallery Slider - Compact */}
                <ProductGallery product={viewProduct} />

                {/* Info Section - Seamless connection with gallery */}
                <div className="px-4 py-2 relative bg-white z-10">

                    {/* === Digikala-style Category Navigation === */}

                    {/* Row 1: Full Category Path (EkgKala > Main Category > Subcategory) */}
                    <div className="space-y-1.5 mb-2">
                        {product.categoryPath && product.categoryPath.length > 0 && (
                            <div className="flex items-center gap-1 text-xs font-medium text-gray-500 flex-wrap">
                                {/* Site Name as first breadcrumb item */}
                                <Link
                                    href="/"
                                    className="text-kala-600 hover:underline hover:text-kala-700 transition-colors"
                                >
                                    ای‌کا‌جی کالا
                                </Link>
                                {product.categoryPath.map((cat, index) => (
                                    <span key={cat.id} className="flex items-center">
                                        <span className="mx-1 text-gray-400">&lt;</span>
                                        <Link
                                            href={`/products?category=${cat.slug}${index < product.categoryPath!.length - 1 ? '&includeChildren=true' : ''}`}
                                            className={`hover:underline transition-colors ${index === product.categoryPath!.length - 1
                                                ? 'text-red-500 hover:text-red-600'
                                                : 'text-gray-600 hover:text-kala-700'
                                                }`}
                                        >
                                            {cat.name}
                                        </Link>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Row 2: Brand + Product's Last Category */}
                        {product.brand && product.categoryPath && product.categoryPath.length > 0 && (
                            <div className="flex items-center gap-1 text-xs font-medium text-gray-500">
                                <Link
                                    href={`/products?brand=${product.brandSlug || encodeURIComponent(product.brand)}`}
                                    className="text-gray-600 hover:underline hover:text-kala-700 transition-colors"
                                >
                                    {product.brand}
                                </Link>
                                <span className="mx-1 text-gray-400">&lt;</span>
                                <span className="text-gray-700 font-semibold">
                                    {/* Product type in this category */}
                                    {product.categoryPath[product.categoryPath.length - 1].name} {product.brand}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Title & Rating */}
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex flex-col">
                            <h1 className="text-base font-bold text-gray-900 leading-snug">{product.title}</h1>
                            {product.enTitle && (
                                <span className="text-xs text-gray-400 font-mono mt-1">{product.enTitle}</span>
                            )}
                        </div>
                    </div>

                    {/* Countdown banner — same scheme source as the desktop banner
                        and the product card. */}
                    <ProductPromotionBanner product={viewProduct} compact />

                    {/* Rating Section */}
                    {product.rating > 0 && (
                        <div className="flex items-center gap-1 mb-4">
                            <Star size={14} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-sm font-bold text-gray-800">{product.rating}</span>
                            <span className="text-xs text-gray-400">
                                ({product.reviewCount} {product.reviewCount === 0 ? "" : "دیدگاه"})
                            </span>
                        </div>
                    )}

                    {/* Wishlist & Share Actions */}
                    <ProductSocialActions product={product} />

                    <hr className="border-gray-100 mb-6" />

                    {/* Variant Selector (سیستم جدید attributes/variants) */}
                    <VariantSelector
                        attributes={product.attributes ?? []}
                        variants={product.variants ?? []}
                        selection={selection}
                        selectedVariant={selectedVariant}
                        onChange={handleVariantChange}
                    />

                    {/* Legacy color selector — فقط برای محصول ساده‌ی دارای `colors` */}
                    {(product.variants ?? []).length === 0 && (
                        <ColorSelector
                            colors={product.colors || []}
                            selectedColor={selectedColor}
                            onColorChange={setSelectedColor}
                        />
                    )}

                    {/* Features (Stock, Brand) */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-6">
                        {product.brand && (
                            <>
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                    <ShieldCheck size={18} className="text-gray-400" />
                                    <span>برند: {product.brand}</span>
                                </div>
                                <div className="h-px bg-gray-200 w-full" />
                            </>
                        )}
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                            <Store size={18} className={viewProduct.countInStock > 0 ? "text-kala-500" : "text-red-500"} />
                            <span>
                                {viewProduct.countInStock > 0 ? "موجود در انبار" : "ناموجود"}
                            </span>
                        </div>
                    </div>

                    {/* Low Stock Warning - Only show when stock is 1, 2, or 3 */}
                    {viewProduct.countInStock > 0 && viewProduct.countInStock <= 3 && (
                        <div className="mb-6 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex items-center gap-3 animate-pulse">
                            <div className="p-2 bg-amber-100 rounded-lg">
                                <AlertTriangle size={20} className="text-amber-600" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-amber-800">
                                    تنها {viewProduct.countInStock} عدد باقی مانده!
                                </span>
                                <span className="text-xs text-amber-600">
                                    قبل از اتمام موجودی اقدام کنید
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Product Tabs (Description, Specs, Reviews) */}
                    <ProductTabs product={product} />

                </div>

                {/* Sticky Action Bar */}
                <ProductActions product={viewProduct} variantOptions={variantOptions} />
            </div>

            {/* Desktop Two-Column Layout - With proper header clearance */}
            <div className="hidden lg:block max-w-7xl mx-auto px-6 pb-8 pt-8">
                <div className="flex flex-row-reverse gap-10 min-w-0">
                    {/* Right Column - Gallery + Breadcrumb + Title (all sticky together) */}
                    <div className="w-[45%] max-w-[45%] min-w-0 flex-shrink self-start sticky top-36 will-change-transform flex flex-col max-h-[calc(100vh-theme(spacing.36)-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-theme(spacing.36)-2rem)] [@media(pointer:coarse)]:max-h-[calc(100svh-theme(spacing.36)-2.5rem)]">
                        <ProductGallery product={viewProduct} />

                        {/* Breadcrumb - Below Gallery */}
                        <div className="shrink-0 space-y-1.5 mt-5">
                            {product.categoryPath && product.categoryPath.length > 0 && (
                                <div className="flex items-center gap-1 text-sm font-medium text-gray-500 flex-wrap">
                                    <Link
                                        href="/"
                                        className="text-kala-600 hover:underline hover:text-kala-700 transition-colors"
                                    >
                                        ای‌کا‌جی کالا
                                    </Link>
                                    {product.categoryPath.map((cat, index) => (
                                        <span key={cat.id} className="flex items-center">
                                            <span className="mx-1 text-gray-400">&lt;</span>
                                            <Link
                                                href={`/products?category=${cat.slug}${index < product.categoryPath!.length - 1 ? '&includeChildren=true' : ''}`}
                                                className={`hover:underline transition-colors ${index === product.categoryPath!.length - 1
                                                    ? 'text-red-500 hover:text-red-600'
                                                    : 'text-gray-600 hover:text-kala-700'
                                                    }`}
                                            >
                                                {cat.name}
                                            </Link>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {product.brand && product.categoryPath && product.categoryPath.length > 0 && (
                                <div className="flex items-center gap-1 text-sm font-medium text-gray-500">
                                    <Link
                                        href={`/products?brand=${product.brandSlug || encodeURIComponent(product.brand)}`}
                                        className="text-gray-600 hover:underline hover:text-kala-700 transition-colors"
                                    >
                                        {product.brand}
                                    </Link>
                                    <span className="mx-1 text-gray-400">&lt;</span>
                                    <span className="text-gray-700 font-semibold">
                                        {product.categoryPath[product.categoryPath.length - 1].name} {product.brand}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Title - Below Breadcrumb */}
                        <div className="shrink-0 mt-4">
                            <h1 className="text-xl font-bold text-gray-900 leading-snug mb-1">{product.title}</h1>
                            {product.enTitle && (
                                <span className="text-sm text-gray-400 font-mono">{product.enTitle}</span>
                            )}
                        </div>
                    </div>

                    {/* Left Column - Product Info */}
                    <div className="flex-1 min-w-0">

                        {/* Rating Section */}
                        {product.rating > 0 && (
                            <div className="flex items-center gap-2 mb-4">
                                <Star size={16} className="text-yellow-400 fill-yellow-400" />
                                <span className="text-base font-bold text-gray-800">{product.rating}</span>
                                <span className="text-sm text-gray-400">
                                    ({product.reviewCount} {product.reviewCount === 0 ? "" : "دیدگاه"})
                                </span>
                            </div>
                        )}

                        {/* Countdown banner — colours shared with the product card
                            (lib/campaignTheme.ts), so «پیشنهاد لحظه‌ای» keeps its
                            amber→orange→red gradient on the detail page too. */}
                        <ProductPromotionBanner product={viewProduct} />

                        {/* Wishlist & Share Actions */}
                        <ProductSocialActions product={product} />

                        <hr className="border-gray-100 my-6" />

                        {/* Variant Selector (سیستم جدید attributes/variants) */}
                        <VariantSelector
                            attributes={product.attributes ?? []}
                            variants={product.variants ?? []}
                            selection={selection}
                            selectedVariant={selectedVariant}
                            onChange={handleVariantChange}
                        />

                        {/* Legacy color selector — فقط برای محصول ساده‌ی دارای `colors` */}
                        {(product.variants ?? []).length === 0 && (
                            <ColorSelector
                                colors={product.colors || []}
                                selectedColor={selectedColor}
                                onColorChange={setSelectedColor}
                            />
                        )}

                        {/* Features (Stock, Brand) */}
                        <div className="bg-gray-50 rounded-xl p-5 space-y-4 mb-6">
                            {product.brand && (
                                <>
                                    <div className="flex items-center gap-3 text-sm text-gray-600">
                                        <ShieldCheck size={20} className="text-gray-400" />
                                        <span>برند: {product.brand}</span>
                                    </div>
                                    <div className="h-px bg-gray-200 w-full" />
                                </>
                            )}
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                                <Store size={20} className={viewProduct.countInStock > 0 ? "text-kala-500" : "text-red-500"} />
                                <span>
                                    {viewProduct.countInStock > 0 ? "موجود در انبار" : "ناموجود"}
                                </span>
                            </div>
                        </div>

                        {/* Low Stock Warning */}
                        {viewProduct.countInStock > 0 && viewProduct.countInStock <= 3 && (
                            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex items-center gap-3 animate-pulse">
                                <div className="p-2 bg-amber-100 rounded-lg">
                                    <AlertTriangle size={22} className="text-amber-600" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-base font-bold text-amber-800">
                                        تنها {viewProduct.countInStock} عدد باقی مانده!
                                    </span>
                                    <span className="text-sm text-amber-600">
                                        قبل از اتمام موجودی اقدام کنید
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Desktop Price & Add to Cart Box */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
                            <ProductActions product={viewProduct} variantOptions={variantOptions} isDesktop={true} />
                        </div>

                        {/* Product Tabs */}
                        <ProductTabs product={product} />
                    </div>
                </div>
            </div>

        </div>
    );
}
