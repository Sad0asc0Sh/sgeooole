import { TagOutlined, HomeOutlined, EyeInvisibleOutlined } from '@ant-design/icons'
import {
  calculateDiscountPricing,
  FIXED_PROMOTION_THEMES,
  getSaleBadgeTheme,
} from '../../utils/promotionPricing'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import './PromotionBadgePreview.css'

/**
 * Live preview of how the storefront renders a product's label badge,
 * homepage placement, and final discounted price.
 */
export default function PromotionBadgePreview({
  mode = 'custom', // 'flash' | 'special' | 'custom'
  label = '',
  themeKey = 'lime-blue',
  discountPercent = 0,
  basePrice = 0,
  showInFeatured = true,
  isSamplePrice = false,
}) {
  let activeGradient = ''
  let resolvedLabel = ''
  let placementText = ''
  let featured = false

  if (mode === 'flash') {
    activeGradient = FIXED_PROMOTION_THEMES.flash.gradient
    resolvedLabel = label || FIXED_PROMOTION_THEMES.flash.pillLabel
    placementText = FIXED_PROMOTION_THEMES.flash.placement
    featured = true
  } else if (mode === 'special') {
    activeGradient = FIXED_PROMOTION_THEMES.special.gradient
    resolvedLabel = label || FIXED_PROMOTION_THEMES.special.pillLabel
    placementText = FIXED_PROMOTION_THEMES.special.placement
    featured = true
  } else {
    const scheme = getSaleBadgeTheme(themeKey)
    activeGradient = scheme.gradient
    resolvedLabel = (label || '').trim() || 'نام کمپین زمان‌دار'
    featured = showInFeatured !== false
    placementText = featured
      ? 'نمایش در بخش پیشنهادهای منتخب صفحه اصلی'
      : 'فقط اعمال تخفیف (بدون نمایش در منتخب‌ها)'
  }

  const { basePrice: safeBase, discountPercent: pct, savings, finalPrice } =
    calculateDiscountPricing(basePrice, discountPercent)

  return (
    <div className="promo-preview-card">
      <div className="promo-preview-stripe" style={{ background: activeGradient }} />
      <div className="promo-preview-body">
        <div className="promo-preview-top">
          <span className="promo-preview-pill" style={{ background: activeGradient }}>
            <TagOutlined />
            <span>{resolvedLabel}</span>
          </span>

          <span className={`promo-preview-placement${featured ? ' is-featured' : ''}`}>
            {featured ? <HomeOutlined /> : <EyeInvisibleOutlined />}
            <span>{placementText}</span>
          </span>
        </div>

        {safeBase > 0 && (
          <div className="promo-preview-prices">
            <div className="promo-preview-price-col">
              {pct > 0 && (
                <span className="promo-preview-old">
                  {formatCurrency(safeBase)}
                  {isSamplePrice ? ' (نمونه)' : ''}
                </span>
              )}
              <span className="promo-preview-final">
                {formatCurrency(finalPrice)}
              </span>
              {pct > 0 && (
                <span className="promo-preview-savings">
                  سود مشتری: {formatCurrency(savings)}
                </span>
              )}
            </div>

            {pct > 0 && (
              <span
                className="promo-preview-discount-chip"
                style={{ background: activeGradient }}
              >
                {formatNumber(pct)}٪ تخفیف
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
