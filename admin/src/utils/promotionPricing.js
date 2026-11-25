/**
 * Shared Promotion Pricing & Label Theme Helpers
 * Matches storefront (`frontend/src/lib/campaignTheme.ts`) and backend (`pricingService.js`).
 */

export const SALE_BADGE_THEMES = [
  {
    value: 'lime-blue',
    label: 'بهاره (سبز لیمویی)',
    gradient: 'linear-gradient(to left, #9ae600, #00c950)',
    dot: '#16a34a',
  },
  {
    value: 'gold-red',
    label: 'طلایی (نوروزی / لوکس)',
    gradient: 'linear-gradient(to left, #fff085, #f0b100 45%, #894b00)',
    dot: '#ca8a04',
  },
  {
    value: 'red-purple',
    label: 'آتشین (حراج ویژه)',
    gradient: 'linear-gradient(to left, #f43f5e, #7e22ce)',
    dot: '#e11d48',
  },
  {
    value: 'green-orange',
    label: 'زمردی کلاسیک',
    gradient: 'linear-gradient(to left, #22c55e, #059669)',
    dot: '#059669',
  },
]

export const FIXED_PROMOTION_THEMES = {
  flash: {
    key: 'flash',
    label: 'زمان‌دار (پیشنهاد لحظه‌ای)',
    pillLabel: 'پیشنهاد لحظه‌ای',
    gradient: 'linear-gradient(to left, #ffb900, #ff6900, #e7000b)',
    dot: '#ff6900',
    placement: 'نمایش در بخش فرصت‌های زمان‌دار صفحه اصلی',
  },
  special: {
    key: 'special',
    label: 'شگفت‌انگیز',
    pillLabel: 'شگفت‌انگیز',
    gradient: 'linear-gradient(to left, #ef394e, #e7000b)',
    dot: '#e7000b',
    placement: 'نمایش در بخش پیشنهادهای منتخب صفحه اصلی',
  },
}

export function getSaleBadgeTheme(themeKey) {
  return (
    SALE_BADGE_THEMES.find((t) => t.value === themeKey) ||
    SALE_BADGE_THEMES[0]
  )
}

/**
 * Compute discounted price & exact Toman savings from basePrice and discount %.
 */
export function calculateDiscountPricing(basePrice, discountPercent) {
  const base = Math.max(0, Number(basePrice) || 0)
  const pct = Math.min(99, Math.max(0, Number(discountPercent) || 0))
  if (base <= 0 || pct <= 0) {
    return { basePrice: base, discountPercent: pct, savings: 0, finalPrice: base }
  }
  const finalPrice = Math.max(0, Math.round(base * (1 - pct / 100)))
  const savings = Math.max(0, base - finalPrice)
  return { basePrice: base, discountPercent: pct, savings, finalPrice }
}

/**
 * Reverse-calculate integer discount % (0..99) from a desired final price.
 */
export function calculatePercentFromFinalPrice(basePrice, targetFinalPrice) {
  const base = Math.max(0, Number(basePrice) || 0)
  const target = Math.max(0, Number(targetFinalPrice) || 0)
  if (base <= 0) {
    return { discountPercent: 0, actualFinalPrice: 0, savings: 0, isClamped: false }
  }
  if (target >= base) {
    return { discountPercent: 0, actualFinalPrice: base, savings: 0, isClamped: target > base }
  }
  const rawPct = Math.round((1 - target / base) * 100)
  const discountPercent = Math.min(99, Math.max(0, rawPct))
  const { finalPrice, savings } = calculateDiscountPricing(base, discountPercent)
  return {
    discountPercent,
    actualFinalPrice: finalPrice,
    savings,
    isClamped: rawPct > 99 || rawPct < 0,
  }
}

/**
 * Resolve base price or min/max range for simple or variable products.
 */
export function getProductBasePriceRange(product) {
  if (!product) return { isVariable: false, minPrice: 0, maxPrice: 0 }
  if (product.productType === 'variable' && Array.isArray(product.variants) && product.variants.length > 0) {
    const prices = product.variants.map((v) => Number(v?.price) || 0).filter((n) => n > 0)
    if (prices.length > 0) {
      return {
        isVariable: true,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
      }
    }
  }
  const p = Math.max(0, Number(product.price) || 0)
  return { isVariable: product.productType === 'variable', minPrice: p, maxPrice: p }
}
