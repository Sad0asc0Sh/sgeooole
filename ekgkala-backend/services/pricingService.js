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

const getAllDescendantCategoryIds = async (categoryId) => {
  try {
    const Category = require('../models/Category')
    const children = await Category.find({ parent: categoryId }).select('_id').lean()
    if (!children.length) return []
    const childIds = children.map((c) => c._id.toString())
    const subChildren = await Promise.all(
      childIds.map((id) => getAllDescendantCategoryIds(id))
    )
    return [...childIds, ...subChildren.flat()]
  } catch (error) {
    console.error('Error in getAllDescendantCategoryIds:', error)
    return []
  }
}

const getActiveSalesCampaignContext = async (now = new Date()) => {
  try {
    const Sale = require('../models/Sale')
    const activeSales = await Sale.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .populate('categories', '_id')
      .select('name products categories discountPercentage badgeTheme endDate includeSubcategories')
      .lean()

    const campaignMap = new Map()
    const categoryDiscountMap = new Map()

    for (const sale of activeSales) {
      if (sale.products && sale.products.length > 0) {
        sale.products.forEach((pid) => {
          const key = pid.toString()
          if (!campaignMap.has(key)) {
            campaignMap.set(key, {
              name: sale.name,
              discount: sale.discountPercentage,
              theme: sale.badgeTheme,
              endDate: sale.endDate,
            })
          }
        })
      }

      if (sale.categories && sale.categories.length > 0) {
        for (const cat of sale.categories) {
          const categoryId = (cat._id || cat).toString()
          const categoryIds = sale.includeSubcategories !== false
            ? [categoryId, ...(await getAllDescendantCategoryIds(categoryId))]
            : [categoryId]

          categoryIds.forEach((cid) => {
            const key = cid.toString()
            if (!categoryDiscountMap.has(key)) {
              categoryDiscountMap.set(key, {
                name: sale.name,
                discount: sale.discountPercentage,
                theme: sale.badgeTheme,
                endDate: sale.endDate,
              })
            }
          })
        }
      }
    }

    return { campaignMap, categoryDiscountMap }
  } catch (err) {
    console.error('Error fetching active sales campaigns:', err)
    return { campaignMap: new Map(), categoryDiscountMap: new Map() }
  }
}

const computeItemPricing = (item, now = new Date(), campaignContext = null) => {
  const product = item?.product || {}
  const quantity = Number(item.quantity || item.qty || 1) || 1
  const matchingVariant = findMatchingVariant(product, item.variantOptions)

  let basePrice = 0
  if (matchingVariant) {
    const vPrice = Number(matchingVariant.price) || 0
    const vCompareAt = Number(matchingVariant.compareAtPrice) || 0
    basePrice = vCompareAt > vPrice ? vCompareAt : vPrice
  } else {
    const rawCompareAt = Number(product.compareAtPrice) || 0
    const rawProdPrice = Number(product.price ?? item.price ?? 0) || 0
    basePrice = rawCompareAt > rawProdPrice ? rawCompareAt : rawProdPrice
  }

  let rawDiscount = Number(product.discount) || 0
  const flashEnd = product.flashDealEndTime ? new Date(product.flashDealEndTime) : null
  const specialEnd = product.specialOfferEndTime ? new Date(product.specialOfferEndTime) : null

  let flashActive = Boolean(product.isFlashDeal && (!flashEnd || flashEnd > now))
  let specialActive = Boolean(product.isSpecialOffer && (!specialEnd || specialEnd > now))
  let campaignLabel = product.campaignLabel || null
  let specialOfferEndTime = product.specialOfferEndTime || null

  // Check marketing campaign if context provided
  if (campaignContext) {
    const { campaignMap, categoryDiscountMap } = campaignContext
    const prodId = (product._id || item.product)?.toString()
    const catId = (product.category?._id || product.category)?.toString()

    const campaign = (prodId && campaignMap?.get(prodId)) || (catId && categoryDiscountMap?.get(catId))
    if (campaign && campaign.discount > 0) {
      if (campaign.discount > rawDiscount || (!flashActive && !specialActive)) {
        rawDiscount = campaign.discount
        specialActive = true
        campaignLabel = campaign.name || 'پیشنهاد شگفت‌انگیز'
        specialOfferEndTime = campaign.endDate || null
      }
    }
  }

  let appliedDiscount = 0

  if (flashActive) {
    appliedDiscount = rawDiscount
    campaignLabel = campaignLabel || 'پیشنهاد لحظه‌ای'
  } else if (specialActive) {
    appliedDiscount = rawDiscount
    campaignLabel = campaignLabel || 'پیشنهاد شگفت‌انگیز'
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
    specialOfferEndTime,
    quantity,
  }
}

module.exports = {
  normalizeVariantOptions,
  getVariantKey,
  findMatchingVariant,
  computeItemPricing,
  getActiveSalesCampaignContext,
}
