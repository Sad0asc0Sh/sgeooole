"use client";

import { memo } from "react";
import Link from "next/link";
import ResilientImage from "@/components/ui/ResilientImage";
import { AlertTriangle } from "lucide-react";
import ProductTimerBadge from "@/components/product/ProductTimerBadge";
import { getBlurDataURL } from "@/lib/blurPlaceholder";
import { buildProductUrl } from "@/lib/paths";
import { resolveProductPromotion } from "@/lib/promotions/productPromotion";
import type { Product } from "@/types/product";
import imageStyles from "@/components/product/ProductImageFrame.module.css";
import styles from "./HomeProductRail.module.css";

type HomeProductCardProps = {
  product: Product;
  now: number;
};

function HomeProductCard({ product, now }: HomeProductCardProps) {
  const { kind, effectiveDiscount, displayPrice, endTime } = resolveProductPromotion(product, now);
  const isOutOfStock = product.countInStock <= 0;
  const isLowStock = product.countInStock > 0 && product.countInStock <= 3;
  const originalPrice = product.compareAtPrice || product.oldPrice || product.price;
  const hasDiscount = !isOutOfStock && effectiveDiscount > 0 && originalPrice > displayPrice;
  const label = kind === "flash" ? "پیشنهاد لحظه‌ای" : kind === "campaign"
    ? product.campaignLabel || "فروش ویژه" : kind === "amazing" ? "شگفت‌انگیز" : null;
  const campaignTheme = product.campaignTheme || "";
  const theme = kind === "flash" ? "flash" : kind === "amazing" ? "amazing"
    : ["gold-red", "gold"].includes(campaignTheme) ? "gold"
    : ["red-purple", "fire", "red"].includes(campaignTheme) ? "fire"
    : ["lime-orange", "lime"].includes(campaignTheme) ? "lime" : "blue";

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
          src={product.image || "/placeholder.png"}
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
          {hasDiscount && <>
            <span className={`${styles.discountBadge} ${campaignTheme === "red-purple" ? styles.discountRose : ""}`}>{effectiveDiscount.toLocaleString("fa-IR")}٪</span>
            <del className={styles.originalPrice}>{originalPrice.toLocaleString("fa-IR")}</del>
          </>}
        </div>
        <div className={`${styles.price} ${isOutOfStock ? "text-gray-400" : "text-ekg-900"}`}>
          {isOutOfStock ? <span className="text-sm font-bold">ناموجود</span> : <>
            <span>{displayPrice.toLocaleString("fa-IR")}</span>
            <span className={styles.currency}>تومان</span>
          </>}
        </div>
      </div>
    </Link>
  );
}

export default memo(HomeProductCard);
