import { resolvePricing } from "@/lib/pricing";
import { getServerNow } from "@/lib/serverClock";
import type { Product, ProductVariant } from "@/types/product";
import type { WishlistItem } from "@/services/wishlistService";

const firstImageUrl = (images: WishlistItem["images"]): string => {
  const url = images?.[0]?.url;
  return typeof url === "string" && url.length > 0 ? url : "/placeholder.jpg";
};

const variantImageUrl = (img: string | { url?: string } | null | undefined): string | null => {
  if (typeof img === "string" && img.trim() !== "") return img.trim();
  if (img && typeof img === "object" && typeof img.url === "string" && img.url.trim() !== "") {
    return img.url.trim();
  }
  return null;
};

/**
 * نمای Product-شکل یک آیتم ویش‌لیست برای کارت علاقه‌مندی‌ها.
 *
 * قرارداد واحد کارت‌ها: قیمت/بج/خط‌خورده از `resolveCardPricing` می‌آید، پس
 * این تابع فقط داده‌ی خام درست می‌سازد —
 * - محصول ساده: همان رفتار قبلی (resolvePricing روی فیلدهای سطح آیتم).
 * - محصول متغیر (آرایه‌ی غیرخالی variants، مستقل از فلگ productType مثل بقیه‌ی
 *   mapperها): هر مدل با همان قرارداد قیمت می‌گیرد و مدل مستثنی
 *   (excludeFromPromotion) قیمت پایه می‌ماند؛ قیمت سطح کارت ارزان‌ترین مدل و
 *   موجودی جمع مدل‌هاست (تا محصول متغیر بی‌دلیل «ناموجود» نخورد).
 * فقط می‌خواند و ورودی خراب را کرش نمی‌کند.
 */
export function wishlistItemToProduct(item: WishlistItem, now: number = getServerNow()): Product {
  const pricing = resolvePricing({
    price: item.price,
    discount: item.discount || 0,
    compareAtPrice: item.compareAtPrice || item.price,
    isFlashDeal: item.isFlashDeal,
    flashDealEndTime: item.flashDealEndTime,
    isSpecialOffer: item.isSpecialOffer,
    specialOfferEndTime: item.specialOfferEndTime,
    campaignLabel: item.campaignLabel,
    now,
  });

  const rawVariants = Array.isArray(item.variants) ? item.variants : [];
  const variants: ProductVariant[] = rawVariants
    .filter((v): v is NonNullable<typeof v> => Boolean(v) && typeof v === "object")
    .map((v) => {
      const excluded = v.excludeFromPromotion === true;
      const vp = resolvePricing({
        price: Number(v.price) || 0,
        discount: excluded ? 0 : item.discount || 0,
        compareAtPrice: v.compareAtPrice,
        isFlashDeal: excluded ? false : item.isFlashDeal,
        flashDealEndTime: item.flashDealEndTime,
        isSpecialOffer: excluded ? false : item.isSpecialOffer,
        specialOfferEndTime: item.specialOfferEndTime,
        campaignLabel: excluded ? undefined : item.campaignLabel,
        now,
      });
      return {
        id: v._id,
        sku: v.sku,
        stock: Number(v.stock) || 0,
        options: Array.isArray(v.options) ? v.options : [],
        price: vp.finalPrice,
        oldPrice: vp.oldPrice,
        images: (Array.isArray(v.images) ? v.images : [])
          .map(variantImageUrl)
          .filter((x): x is string => Boolean(x)),
        ...(excluded ? { excludeFromPromotion: true as const } : {}),
      };
    });
  const isVariable = variants.length > 0;

  return {
    id: item._id,
    name: item.name,
    title: item.name,
    price: pricing.finalPrice,
    oldPrice: pricing.oldPrice,
    compareAtPrice: pricing.basePrice,
    discount: pricing.discount,
    image: firstImageUrl(item.images),
    images: item.images ? item.images.map((img) => img.url) : [],
    category: item.category || "",
    rating: item.rating || 0,
    reviewCount: 0,
    countInStock: item.countInStock ?? item.stock ?? 0,
    slug: item.slug,
    campaignLabel: item.campaignLabel,
    campaignTheme: item.campaignTheme,
    isFlashDeal: item.isFlashDeal,
    flashDealEndTime: item.flashDealEndTime,
    isSpecialOffer: item.isSpecialOffer,
    specialOfferEndTime: item.specialOfferEndTime,
    productType: isVariable ? "variable" : "simple",
    attributes: [],
    variants,
    // سطح کارت محصول متغیر: ارزان‌ترین مدل + جمع موجودی (مثل بقیه‌ی mapperها)
    ...(isVariable &&
      variants.length > 0 && {
        price: Math.min(...variants.map((v) => v.price)),
        countInStock: variants.reduce((sum, v) => sum + v.stock, 0),
      }),
  };
}
