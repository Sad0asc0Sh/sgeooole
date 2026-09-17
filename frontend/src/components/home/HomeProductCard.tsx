"use client";

import { memo } from "react";
import Link from "next/link";
import ResilientImage from "@/components/ui/ResilientImage";
import Countdown from "@/components/ui/Countdown";
import PromotionBadge from "@/components/promotion/PromotionBadge";
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
  const label = kind === "flash" ? "زمان‌دار" : kind === "campaign"
    ? product.campaignLabel || "فروش ویژه" : kind === "amazing" ? "منتخب" : null;

  return (
    <Link href={buildProductUrl(product)} className={styles.card} data-home-product={product.id}>
      <div className={styles.badges}>
        {label && (
          <span className={styles.promotionLabel} title={label}>
            <PromotionBadge label={label} tone={kind === "flash" ? "timed" : kind === "campaign" ? "campaign" : "curated"} />
          </span>
        )}
        {isLowStock && <span className={styles.stock}>تنها {product.countInStock.toLocaleString("fa-IR")} عدد</span>}
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
        {isOutOfStock && (
          <div className={styles.unavailable}><span>ناموجود</span></div>
        )}
      </div>

      <div className={styles.timer}>
        {endTime && !isOutOfStock && <Countdown targetDate={endTime} variant="compact" />}
      </div>
      <h3 className={`${styles.productName} ${isOutOfStock ? "text-gray-400" : "text-ekg-800"}`} title={product.name}>
        {product.name}
      </h3>
      <div className={styles.pricing}>
        <div className={styles.discountRow}>
          {hasDiscount && <>
            <PromotionBadge label={`${effectiveDiscount.toLocaleString("fa-IR")}٪`} tone="discount" />
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
