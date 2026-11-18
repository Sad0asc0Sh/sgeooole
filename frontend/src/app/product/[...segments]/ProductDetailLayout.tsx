"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, ChevronLeft, Headphones, ShieldCheck, Star, Store, Truck } from "lucide-react";
import type { Product, ProductColor, ProductVariant, ProductVariantOption } from "@/types/product";
import { colorHexFor, isColorAttribute, type Selection } from "@/lib/variants";
import { resolveProductPromotion } from "@/lib/promotions/productPromotion";
import ProductTabs from "@/components/product/ProductTabs";
import ProductPromotionBanner from "@/components/promotion/ProductPromotionBanner";
import ResilientImage from "@/components/ui/ResilientImage";
import ProductGallery from "./ProductGallery";
import ProductHeader from "./ProductHeader";
import ProductHistoryTracker from "./ProductHistoryTracker";
import ProductSocialActions from "./ProductSocialActions";
import ProductActions from "./ProductActions";
import VariantSelector from "./VariantSelector";
import ColorSelector from "./ColorSelector";
import "./product-detail.css";

type Props = {
    product: Product;
    viewProduct: Product;
    now: number;
    selection: Selection;
    selectedVariant: ProductVariant | undefined;
    selectedColor: ProductColor | null;
    variantOptions: ProductVariantOption[];
    onVariantChange: (name: string, value: string) => void;
    onColorChange: (color: ProductColor) => void;
};

export default function ProductDetailLayout({ product, viewProduct, now, selection, selectedVariant, selectedColor, variantOptions, onVariantChange, onColorChange }: Props) {
    const [detailsTab, setDetailsTab] = useState<"desc" | "specs" | "reviews">(product.specs?.length ? "specs" : "desc");
    const inStock = viewProduct.countInStock > 0;
    const colorAttribute = product.attributes?.find(isColorAttribute);
    const promotion = resolveProductPromotion(viewProduct, now);
    return (
        <div className="product-detail" dir="rtl">
            <ProductHistoryTracker product={product} />
            <div className="md:hidden"><ProductHeader /></div>
            <div className="product-detail__container">
                {product.categoryPath && product.categoryPath.length > 0 && (
                    <nav className="product-detail__breadcrumbs" aria-label="مسیر محصول">
                        <Link href="/">ای‌کا‌جی کالا</Link>
                        {product.categoryPath.map((cat, index) => (
                            <span key={cat.id}>
                                <ChevronLeft size={13} aria-hidden="true" />
                                <Link href={`/products?category=${cat.slug}${index < product.categoryPath!.length - 1 ? '&includeChildren=true' : ''}`}>{cat.name}</Link>
                            </span>
                        ))}
                    </nav>
                )}
                <div className="product-detail__main">
                    <div className="product-detail__gallery">
                        <ProductGallery product={viewProduct} promotion={promotion} />
                        <div className="product-detail__social"><ProductSocialActions product={product} /></div>
                    </div>
                    <div className="product-detail__info">
                        <div className="product-detail__brand-row">
                            {product.brand && <Link className="product-detail__brand" href={`/products?brand=${product.brandSlug || encodeURIComponent(product.brand)}`}>{product.brand}</Link>}
                        </div>
                        <div className="product-detail__identity">
                            <h1>{product.title}</h1>
                            {product.enTitle && <p className="product-detail__english" dir="ltr">{product.enTitle}</p>}
                            <div className="product-detail__rating">
                                <Star size={16} fill="currentColor" aria-hidden="true" />
                                <span>{product.rating > 0 ? product.rating.toLocaleString("fa-IR") : "بدون امتیاز"}</span>
                                <span className="product-detail__muted product-detail__rating-count">({(product.reviewCount || 0).toLocaleString("fa-IR")} دیدگاه)</span>
                                <a className="product-detail__reviews-link" href="#product-details" onClick={() => setDetailsTab("reviews")}>
                                    {(product.reviewCount || 0).toLocaleString("fa-IR")} دیدگاه <ChevronLeft size={14} aria-hidden="true" />
                                </a>
                            </div>
                            <div className="product-detail__divider" />
                        </div>
                        <div className="product-detail__promotion"><ProductPromotionBanner product={viewProduct} promotion={promotion} now={now} /></div>
                        <div className="product-detail__options">
                            <VariantSelector attributes={product.attributes ?? []} variants={product.variants ?? []} selection={selection} selectedVariant={selectedVariant} onChange={onVariantChange} />
                            {(product.variants ?? []).length === 0 && <ColorSelector colors={product.colors || []} selectedColor={selectedColor} onColorChange={onColorChange} />}
                        </div>
                        {product.specs && product.specs.length > 0 && (
                            <div className="product-detail__highlights">
                                <h2>ویژگی‌های محصول</h2>
                                <a className="product-details__mobile-only" href="#product-details" onClick={() => setDetailsTab("specs")}>
                                    مشاهده مشخصات محصول <ChevronLeft size={15} aria-hidden="true" />
                                </a>
                                <dl>{product.specs.slice(0, 4).map((spec, index) => <div key={`${spec.label}-${index}`}><dt>{spec.label}<span className="product-detail__spec-separator">:</span></dt><dd dir="auto">{spec.value}</dd></div>)}</dl>
                                <a className="product-details__desktop-only" href="#product-info">
                                    مشاهده مشخصات محصول <ChevronLeft size={15} />
                                </a>
                            </div>
                        )}
                    </div>
                    <aside className="product-detail__purchase" aria-label="اطلاعات فروش و خرید">
                        <h2 className="product-detail__seller-heading">فروشنده</h2>
                        <div className="product-detail__offer">
                            <div className="product-detail__seller"><Store size={20} aria-hidden="true" /><div><strong>ای‌کا‌جی کالا</strong><span>فروشنده</span></div></div>
                            <div className="product-detail__purchase-row" data-in-stock={inStock}><Truck size={19} aria-hidden="true" /><span>{inStock ? "موجود در انبار" : "در حال حاضر ناموجود"}</span></div>
                            {product.guarantee && <div className="product-detail__purchase-row"><ShieldCheck size={19} aria-hidden="true" /><span>{product.guarantee}</span></div>}
                            {inStock && viewProduct.countInStock <= 3 && <p className="product-detail__stock">تنها {viewProduct.countInStock.toLocaleString("fa-IR")} عدد در انبار باقی مانده</p>}
                        </div>
                        <div className="product-detail__desktop-action"><ProductActions product={viewProduct} promotion={promotion} variantOptions={variantOptions} isDesktop /></div>
                    </aside>
                </div>
                <div className="product-detail__services" aria-label="خدمات فروشگاه">
                    <div><Truck size={22} /><span>ارسال سفارش</span></div>
                    <div><ShieldCheck size={22} /><span>خرید مطمئن</span></div>
                    <div><Headphones size={22} /><span>پشتیبانی خرید</span></div>
                    <div><BadgeCheck size={22} /><span>محصولات متنوع</span></div>
                </div>
                <ProductTabs
                    key={product.id}
                    product={product}
                    activeTab={detailsTab}
                    onTabChange={setDetailsTab}
                    purchaseSummary={
                        <div className="product-details__purchase-card">
                            <div className="product-details__purchase-product">
                                <ResilientImage src={viewProduct.image || "/placeholder.svg"} alt="" width={108} height={108} loading="lazy" />
                                <div>
                                    <p>{product.title}</p>
                                    {variantOptions.length > 0 && (
                                        <ul className="product-details__purchase-options" aria-label="گزینه‌های انتخاب‌شده">
                                            {variantOptions.map(({ name, value }) => {
                                                const swatch = colorAttribute?.name === name
                                                    ? colorHexFor(value, colorAttribute.swatches)
                                                    : name === "رنگ" ? selectedColor?.hex : undefined;
                                                return (
                                                    <li key={name}>
                                                        {swatch && <span className="product-details__purchase-swatch" aria-hidden="true" style={{ backgroundColor: swatch }} />}
                                                        <span>{name}: <bdi>{value}</bdi></span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div className="product-details__purchase-seller">
                                <p><Store size={18} aria-hidden="true" /> ای‌کا‌جی کالا</p>
                                <p data-in-stock={inStock}><Truck size={16} aria-hidden="true" /> {inStock ? "موجود در انبار" : "در حال حاضر ناموجود"}</p>
                            </div>
                            {product.guarantee && <p className="product-details__purchase-guarantee"><ShieldCheck size={18} aria-hidden="true" /> {product.guarantee}</p>}
                            {viewProduct.countInStock > 0 && viewProduct.countInStock <= 3 && (
                                <p className="product-detail__stock">تنها {viewProduct.countInStock.toLocaleString("fa-IR")} عدد در انبار باقی مانده</p>
                            )}
                            <div className="product-detail__desktop-action product-details__purchase-action">
                                <ProductActions product={viewProduct} promotion={promotion} variantOptions={variantOptions} isDesktop />
                            </div>
                        </div>
                    }
                />
            </div>
            <div className="product-detail__mobile-action lg:hidden"><ProductActions product={viewProduct} promotion={promotion} variantOptions={variantOptions} /></div>
        </div>
    );
}
