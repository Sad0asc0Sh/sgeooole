"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, ChevronLeft, Headphones, ShieldCheck, Star, Store, Truck } from "lucide-react";
import type { Product, ProductColor, ProductVariant, ProductVariantOption } from "@/types/product";
import type { Selection } from "@/lib/variants";
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
    selection: Selection;
    selectedVariant: ProductVariant | undefined;
    selectedColor: ProductColor | null;
    variantOptions: ProductVariantOption[];
    onVariantChange: (name: string, value: string) => void;
    onColorChange: (color: ProductColor) => void;
};

export default function ProductDetailLayout({ product, viewProduct, selection, selectedVariant, selectedColor, variantOptions, onVariantChange, onColorChange }: Props) {
    const [detailsTab, setDetailsTab] = useState<"desc" | "specs" | "reviews">(product.specs?.length ? "specs" : "desc");
    return (
        <div className="product-detail" dir="rtl">
            <ProductHistoryTracker product={product} />
            <div className="lg:hidden"><ProductHeader product={product} /></div>
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
                        <ProductGallery key={`${product.id}-${selectedVariant?.id ?? "simple"}`} product={viewProduct} />
                        <ProductSocialActions product={product} />
                    </div>
                    <div className="product-detail__info">
                        {product.brand && <Link className="product-detail__brand" href={`/products?brand=${product.brandSlug || encodeURIComponent(product.brand)}`}>{product.brand}</Link>}
                        <h1>{product.title}</h1>
                        {product.enTitle && <p className="product-detail__english" dir="ltr">{product.enTitle}</p>}
                        <div className="product-detail__rating">
                            <Star size={16} fill="currentColor" />
                            <span>{product.rating > 0 ? product.rating.toLocaleString("fa-IR") : "بدون امتیاز"}</span>
                            <span className="product-detail__muted">({(product.reviewCount || 0).toLocaleString("fa-IR")} دیدگاه)</span>
                        </div>
                        <div className="product-detail__divider" />
                        <ProductPromotionBanner product={viewProduct} />
                        <VariantSelector attributes={product.attributes ?? []} variants={product.variants ?? []} selection={selection} selectedVariant={selectedVariant} onChange={onVariantChange} />
                        {(product.variants ?? []).length === 0 && <ColorSelector colors={product.colors || []} selectedColor={selectedColor} onColorChange={onColorChange} />}
                        {product.specs && product.specs.length > 0 && (
                            <div className="product-detail__highlights">
                                <h2>ویژگی‌های محصول</h2>
                                <dl>{product.specs.slice(0, 4).map((spec, index) => <div key={`${spec.label}-${index}`}><dt>{spec.label}:</dt><dd>{spec.value}</dd></div>)}</dl>
                                <a className="product-details__mobile-only" href="#product-details" onClick={() => setDetailsTab("specs")}>
                                    مشاهده مشخصات محصول <ChevronLeft size={15} />
                                </a>
                                <a className="product-details__desktop-only" href="#product-info">
                                    مشاهده مشخصات محصول <ChevronLeft size={15} />
                                </a>
                            </div>
                        )}
                    </div>
                    <aside className="product-detail__purchase" aria-label="اطلاعات فروش و خرید">
                        <div className="product-detail__seller"><Store size={20} /><div><strong>ای‌کا‌جی کالا</strong><span>فروشنده</span></div></div>
                        <div className="product-detail__purchase-row"><Truck size={19} /><span>{viewProduct.countInStock > 0 ? "موجود در انبار" : "در حال حاضر ناموجود"}</span></div>
                        {product.guarantee && <div className="product-detail__purchase-row"><ShieldCheck size={19} /><span>{product.guarantee}</span></div>}
                        {viewProduct.countInStock > 0 && viewProduct.countInStock <= 3 && <p className="product-detail__stock">تنها {viewProduct.countInStock.toLocaleString("fa-IR")} عدد در انبار باقی مانده</p>}
                        <div className="product-detail__desktop-action"><ProductActions product={viewProduct} variantOptions={variantOptions} isDesktop /></div>
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
                                            {variantOptions.map(({ name, value }) => (
                                                <li key={name}>
                                                    {name === "رنگ" && selectedColor?.hex && <span aria-hidden="true" style={{ backgroundColor: selectedColor.hex }} />}
                                                    {value}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div className="product-details__purchase-seller">
                                <p><Store size={18} aria-hidden="true" /> ای‌کا‌جی کالا</p>
                                <p><Truck size={16} aria-hidden="true" /> {viewProduct.countInStock > 0 ? "موجود در انبار" : "در حال حاضر ناموجود"}</p>
                            </div>
                            {product.guarantee && <p className="product-details__purchase-guarantee"><ShieldCheck size={18} aria-hidden="true" /> {product.guarantee}</p>}
                            {viewProduct.countInStock > 0 && viewProduct.countInStock <= 3 && (
                                <p className="product-detail__stock">تنها {viewProduct.countInStock.toLocaleString("fa-IR")} عدد در انبار باقی مانده</p>
                            )}
                            <div className="product-detail__desktop-action product-details__purchase-action">
                                <ProductActions product={viewProduct} variantOptions={variantOptions} isDesktop />
                            </div>
                        </div>
                    }
                />
            </div>
            <div className="product-detail__mobile-action lg:hidden"><ProductActions product={viewProduct} variantOptions={variantOptions} /></div>
        </div>
    );
}
