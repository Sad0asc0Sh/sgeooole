import type { Product } from "@/services/productService";

const FLASH_LABELS = [
  "پیشنهاد لحظه‌ای",
  "پیشنهاد لحظه اي",
  "پیشنهاد لحظه ای",
  "پیشنهاد لحظه‌اي",
  "Flash Deal",
  "Flash Offer",
];

const normalizeLabel = (label: string) =>
  label
    .replace(/[\s‌]+/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .toLowerCase();

export const isFlashDealLabel = (label?: string | null) => {
  if (!label) return false;
  const normalized = normalizeLabel(label);
  const normalizedTargets = FLASH_LABELS.map(normalizeLabel);
  if (normalizedTargets.includes(normalized)) return true;
  return normalized.includes("flashdeal") || normalized.includes("flashoffer");
};

export const isFlashDealActive = (
  product: Pick<Product, "isFlashDeal" | "flashDealEndTime">,
  now: number
) => {
  if (!product.isFlashDeal || !product.flashDealEndTime) return false;
  const endTs = Date.parse(product.flashDealEndTime);
  return Number.isFinite(endTs) && endTs > now;
};

export const hasExpiredFlashLabel = (
  product: Pick<Product, "isFlashDeal" | "flashDealEndTime" | "campaignLabel">,
  now: number
) => {
  return isFlashDealLabel(product.campaignLabel) && !isFlashDealActive(product, now);
};
