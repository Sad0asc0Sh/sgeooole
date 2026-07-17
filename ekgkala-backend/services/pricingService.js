const normalizeVariantOptions = (variantOptions) => {
  if (!Array.isArray(variantOptions)) return []

  return variantOptions
    .filter((vo) => vo && vo.name != null && vo.value != null)
    .map((vo) => ({
      name: String(vo.name).trim(),
      value: String(vo.value).trim(),
    }))
    .sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name)
      if (nameCompare !== 0) return nameCompare
      return a.value.localeCompare(b.value)
    })
}

const getVariantKey = (normalizedVariantOptions) => {
  if (!Array.isArray(normalizedVariantOptions) || normalizedVariantOptions.length === 0) {
    return 'no-variant'
  }

  return normalizedVariantOptions
    .map((vo) => `${String(vo.name).trim()}:${String(vo.value).trim()}`)
    .join('|')
}

const findMatchingVariant = (product, variantOptions) => {
  if (
    !product ||
    product.productType !== 'variable' ||
    !Array.isArray(product.variants) ||
    !Array.isArray(variantOptions) ||
    variantOptions.length === 0
  ) {
    return null
  }

  return product.variants.find((variant) => {
    if (!Array.isArray(variant.options) || variant.options.length === 0) return false

    return variant.options.every((opt) =>
      variantOptions.some(
        (vo) =>
          vo &&
          opt &&
          String(vo.name).trim() === String(opt.name).trim() &&
          String(vo.value).trim() === String(opt.value).trim(),
      ),
    )
  })
}

const computeItemPricing = (item, now = new Date()) => {
  const product = item?.product || {}
  const quantity = Number(item.quantity || item.qty || 1) || 1
  const matchingVariant = findMatchingVariant(product, item.variantOptions)

  const basePrice =
    Number(
      (matchingVariant && matchingVariant.price) ??
      product.price ??
      item.price ??
      0,
    ) || 0

  const rawDiscount = Number(product.discount) || 0
  const flashEnd = product.flashDealEndTime ? new Date(product.flashDealEndTime) : null
  const specialEnd = product.specialOfferEndTime ? new Date(product.specialOfferEndTime) : null

  const flashActive = Boolean(product.isFlashDeal && (!flashEnd || flashEnd > now))
  const specialActive = Boolean(product.isSpecialOffer && (!specialEnd || specialEnd > now))

  let appliedDiscount = 0
  let campaignLabel = product.campaignLabel || null

  if (flashActive) {
    appliedDiscount = rawDiscount
    campaignLabel = campaignLabel || 'پیشنهاد شگفت انگیز'
  } else if (specialActive) {
    appliedDiscount = rawDiscount
    campaignLabel = campaignLabel || 'فروش ویژه'
  } else if (!product.isFlashDeal && !product.isSpecialOffer && rawDiscount > 0) {
    // Non-timer discounts remain valid when no countdown flags are set
    appliedDiscount = rawDiscount
  }

  const finalPrice =
    appliedDiscount > 0
      ? Math.max(0, basePrice - (basePrice * appliedDiscount) / 100)
      : basePrice

  return {
    basePrice,
    finalPrice,
    discount: appliedDiscount,
    campaignLabel,
    flashActive,
    specialActive,
    quantity,
  }
}

module.exports = {
  normalizeVariantOptions,
  getVariantKey,
  findMatchingVariant,
  computeItemPricing
}
