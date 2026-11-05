"use client";

import { memo } from "react";
import Link from "next/link";
import ResilientImage from "@/components/ui/ResilientImage";
import { AlertTriangle } from "lucide-react";
import ProductTimerBadge from "@/components/product/ProductTimerBadge";
import { getBlurDataURL } from "@/lib/blurPlaceholder";
import { buildProductUrl } from "@/lib/paths";
import { resolveCardPricing } from "@/lib/promotions/variantCardPricing";
import { resolveCampaignThemeVariant } from "@/lib/campaignTheme";
import type { Product } from "@/types/product";
import imageStyles from "@/components/product/ProductImageFrame.module.css";
import styles from "./HomeProductRail.module.css";

type HomeProductCardProps = {
  product: Product;
  now: number;
};

function HomeProductCard({ product, now }: HomeProductCardProps) {
  const pricing = resolveCardPricing(product, { now, context: "listing" });
  const kind = pricing.kind;
  const endTime = pricing.endTime;
  const isOutOfStock = product.countInStock <= 0;
  const isLowStock = product.countInStock > 0 && product.countInStock <= 3;
  const originalPrice = pricing.originalPrice;
  const hasDiscount = !isOutOfStock && originalPrice !== undefined;
  const effectiveDiscount = pricing.discountPercent;
  const displayPrice = pricing.displayPrice;
  const label = kind === "flash" ? "پیشنهاد لحظه‌ای" : kind === "campaign"
    ? product.campaignLabel || "فروش ویژه" : kind === "amazing" ? "شگفت‌انگیز" : null;
  const campaignTheme = product.campaignTheme || "";
  const variant = resolveCampaignThemeVariant(campaignTheme);
  const theme = kind === "flash" ? "flash" : kind === "amazing" ? "amazing"
    : variant === "gold" ? "gold"
    : variant === "fire" ? "fire"
    : variant === "spring" ? "lime" : "blue";

  return (
    <Link href={buildProductUrl(product)} className={styles.card} data-home-product={product.id}>
      <div className={styles.promotionSlot}>
        {label && (
          <div className={styles.promotionHeader} data-promotion-theme={theme}>
            <div className={styles.promotionStripe} aria-hidden />
            <span className={styles.promotionLabel} title={label}>{label}</span>
          </div>
        )}
      </div>

      <div className={`${imageStyles.frame} ${styles.imageFrame}`}>
        <ResilientImage
          src={product.cardImage || product.image || "/placeholder.png"}
          backupSrc={product.image}
          alt={product.name}
          fill
          className={`${imageStyles.image} ${isOutOfStock ? "grayscale opacity-60" : ""}`}
          sizes="(max-width: 479px) 46vw, (max-width: 767px) 200px, 240px"
          loading="lazy"
          quality={75}
          placeholder="blur"
          blurDataURL={getBlurDataURL()}
          fallbackSrc="/placeholder.png"
        />
        {endTime && !isOutOfStock && (
          <ProductTimerBadge key={endTime} targetDate={endTime} color="" className={`${styles.cardTimer} ${styles[theme]}`} />
        )}
        {isLowStock && <span className={styles.stock}><AlertTriangle size={12} aria-hidden />تنها {product.countInStock.toLocaleString("fa-IR")} عدد</span>}
        {isOutOfStock && (
          <div className={styles.unavailable}><span>ناموجود</span></div>
        )}
      </div>

      <h3 className={`${styles.productName} ${isOutOfStock ? "text-gray-400" : "text-ekg-800"}`} title={product.name}>
        {product.name}
      </h3>
      <div className={styles.pricing}>
        <div className={styles.discountRow}>
          {hasDiscount ? <>
            <span className={`${styles.discountBadge} ${campaignTheme === "red-purple" ? styles.discountRose : ""}`}>{effectiveDiscount.toLocaleString("fa-IR")}٪</span>
            <del className={styles.originalPrice}>{(originalPrice as number).toLocaleString("fa-IR")}</del>
          </> : pricing.isPartial && !isOutOfStock ? (
            <span className="text-[10px] text-gray-500">تخفیف روی چند مدل</span>
          ) : null}
        </div>
        <div
          className={`${styles.price} ${isOutOfStock ? "text-gray-400" : "text-ekg-900"}`}
          aria-label={pricing.isFrom && !isOutOfStock ? `شروع از ${displayPrice.toLocaleString("fa-IR")} تومان` : `${displayPrice.toLocaleString("fa-IR")} تومان`}
        >
          {isOutOfStock ? <span className="text-sm font-bold">ناموجود</span> : <>
            {pricing.isFrom && <span className="text-[10px] text-gray-500 ml-1">از</span>}
            <span>{displayPrice.toLocaleString("fa-IR")}</span>
            <span className={styles.currency}>تومان</span>
          </>}
        </div>
        {pricing.isPartial && hasDiscount && !isOutOfStock && (
          <span className="text-[10px] text-gray-500">تخفیف روی چند مدل</span>
        )}
      </div>
    </Link>
  );
}

export default memo(HomeProductCard);
