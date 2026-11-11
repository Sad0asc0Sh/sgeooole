/**
 * سرویس همگام‌سازی و محافظت قیمت‌گذاری رقابتی و کنترل ۳ سیستم تخفیف (نسخه ۳.۰)
 * ویژه اتصال به سامانه `ai-driven-competitive-pricing-system` و لیست قیمت همکاران
 *
 * اصول کلیدی:
 *  1. اولویت اول (خط قرمز تامین): قیمت نهایی فروش (`finalPrice` / کف هدف) همیشه باید اکیداً بزرگتر از
 *     قیمت خرید/تامین (`costPrice`) و بزرگتر یا مساوی خط قرمز کف فروش (`hardFloorPrice`) باشد.
 *  2. کالیبراسیون دقیق سقف و درصد تخفیف روی کف:
 *     سقف قیمت بازار (`basePrice`) معیار تخفیف قرار می‌گیرد و درصد تخفیف صحیح (`discountPct` از ۱ تا ۹۹)
 *     روی سقف اعمال می‌شود به‌گونه‌ای که:
 *       `Math.round(calibratedCeiling * (1 - discountPct / 100)) === finalPrice`
 *  3. پشتیبانی کامل و بدون تداخل از هر ۳ سیستم تخفیف فروشگاه `sgeooole`:
 *     - `flash` («پیشنهاد لحظه‌ای» در صفحه اصلی — `Product.isFlashDeal = true`)
 *     - `featured` («پیشنهاد شگفت‌انگیز» در صفحه اصلی — `Product.isSpecialOffer = true`)
 *     - `timed_sale` («مدیریت فرصت‌های زمان‌دار در بخش مالی و تخفیف» — مدل `Sale` با قابلیت تنظیم `badgeTheme`
 *       و `showInFeatured` برای نمایش در بخش «منتخب‌ها» در صفحه اصلی)
 */

const VALID_THEMES = new Set(['green-orange', 'gold-red', 'red-purple'])

/**
 * کالیبراسیون سقف معیار (`basePrice`) تا با درصد تخفیف صحیح (`1..99`) دقیقاً به کف هدف (`finalPrice`) برسد
 */
const calibrateCeilingForExactFloor = (rawCeiling, targetFloor, preferredDiscountPct = null) => {
  const floor = Math.round(Number(targetFloor) || 0)
  const ceiling = Math.round(Number(rawCeiling) || floor)
  if (floor <= 0 || ceiling <= floor) {
    return { calibratedCeiling: floor, discountPct: 0, exactFloorPrice: floor }
  }

  const rawPct =
    preferredDiscountPct != null && Number(preferredDiscountPct) > 0
      ? Number(preferredDiscountPct)
      : ((ceiling - floor) / ceiling) * 100

  const discountPct = Math.max(1, Math.min(99, Math.round(rawPct)))
  const factor = (100 - discountPct) / 100
  if (factor <= 0) {
    return { calibratedCeiling: floor, discountPct: 0, exactFloorPrice: floor }
  }

  // اگر خود سقف فعلی با این درصد تخفیف دقیقاً کف هدف را تولید می‌کند، دست نزن
  if (Math.round(ceiling * factor) === floor) {
    return { calibratedCeiling: ceiling, discountPct, exactFloorPrice: floor }
  }

  const approxCeiling = Math.round(floor / factor)
  for (let delta = 0; delta <= 25; delta++) {
    for (const sign of [1, -1]) {
      const candidate = approxCeiling + delta * sign
      if (candidate <= floor) continue
      if (Math.round(candidate * factor) === floor) {
        return { calibratedCeiling: candidate, discountPct, exactFloorPrice: floor }
      }
    }
  }

  const safeCeiling = Math.ceil(floor / factor)
  return {
    calibratedCeiling: Math.max(floor + 1, safeCeiling),
    discountPct,
    exactFloorPrice: Math.max(floor, Math.round(safeCeiling * factor)),
  }
}

const validatePricingSyncPayload = (payload = {}, existingProduct = null) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      valid: false,
      code: 'MALFORMED_PAYLOAD',
      error: 'ساختار داده ارسالی (payload) نامعتبر است',
    }
  }

  const finalPrice = Number(payload.finalPrice ?? payload.price ?? 0)
  const rawBasePrice = Number(payload.basePrice ?? payload.compareAtPrice ?? finalPrice)
  const incomingCost = Number(payload.costPrice ?? 0)
  const existingCost = Number(existingProduct?.costPrice ?? 0)
  const effectiveCostPrice = incomingCost > 0 ? incomingCost : existingCost

  const incomingFloor = Number(payload.hardFloorPrice ?? 0)
  const existingFloor = Number(existingProduct?.hardFloorPrice ?? 0)
  const effectiveHardFloor =
    incomingFloor > 0
      ? incomingFloor
      : effectiveCostPrice > 0
        ? Math.max(existingFloor, effectiveCostPrice + 1000)
        : existingFloor

  if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
    return {
      valid: false,
      code: 'INVALID_FINAL_PRICE',
      error: 'قیمت نهایی فروش (finalPrice) نامعتبر یا صفر است',
    }
  }

  if (!Number.isFinite(rawBasePrice) || rawBasePrice <= 0) {
    return {
      valid: false,
      code: 'INVALID_BASE_PRICE',
      error: 'قیمت سقف/پایه (basePrice) نامعتبر یا صفر است',
    }
  }

  const rawOverride = payload.belowCostOverride || payload.pricingMeta?.belowCostOverride || null
  const hasValidBelowCostOverride = Boolean(
    rawOverride &&
      typeof rawOverride === 'object' &&
      rawOverride.allowBelowCost === true &&
      typeof rawOverride.reason === 'string' &&
      rawOverride.reason.trim().length >= 5 &&
      typeof rawOverride.authorizedBy === 'string' &&
      rawOverride.authorizedBy.trim().length >= 2
  )

  // خط قرمز اول سیستم: قیمت فروش هرگز نباید کمتر یا مساوی قیمت خرید/تامین باشد (مگر با مجوز صریح و ممیزی‌شده)
  if (!hasValidBelowCostOverride && effectiveCostPrice > 0 && finalPrice <= effectiveCostPrice) {
    return {
      valid: false,
      code: 'BELOW_COST_PRICE',
      error: `خطای خط قرمز تامین: قیمت فروش (${finalPrice.toLocaleString('fa-IR')}) نمی‌تواند کمتر یا مساوی قیمت خرید و تامین همکار (${effectiveCostPrice.toLocaleString('fa-IR')}) باشد`,
    }
  }

  if (!hasValidBelowCostOverride && effectiveHardFloor > 0 && finalPrice < effectiveHardFloor) {
    return {
      valid: false,
      code: 'BELOW_HARD_FLOOR',
      error: `خطای کف سود: قیمت فروش (${finalPrice.toLocaleString('fa-IR')}) کمتر از خط قرمز کف سود (${effectiveHardFloor.toLocaleString('fa-IR')}) است`,
    }
  }

  const rawDecisionId = payload.decisionId ?? payload.pricingMeta?.decisionId ?? null
  const decisionId = rawDecisionId != null && String(rawDecisionId).trim() !== '' ? String(rawDecisionId).trim() : null
  const rawIdempotencyKey =
    payload.idempotencyKey ??
    payload.pricingMeta?.idempotencyKey ??
    (decisionId ? `decision-${decisionId}` : null)
  const idempotencyKey =
    rawIdempotencyKey != null && String(rawIdempotencyKey).trim() !== '' ? String(rawIdempotencyKey).trim() : null

  // تشخیص نوع سیستم تخفیف از بین ۳ سیستم sgeooole:
  // 1) flash (پیشنهاد لحظه‌ای صفحه اصلی)
  // 2) featured (پیشنهاد شگفت‌انگیز صفحه اصلی)
  // 3) timed_sale (فرصت‌های زمان‌دار بخش مالی و تخفیف پنل مدیریت + امکان نمایش در منتخب‌ها)
  const requestedCampaignType =
    payload.campaignType ||
    (payload.timedSale && payload.timedSale.enabled ? 'timed_sale' : null) ||
    (payload.isFlashDeal ? 'flash' : null) ||
    (payload.isSpecialOffer ? 'featured' : 'none')

  const wantsPromo =
    (requestedCampaignType === 'flash' ||
      requestedCampaignType === 'featured' ||
      requestedCampaignType === 'timed_sale') &&
    rawBasePrice > finalPrice

  const preferredPct =
    payload.timedSale?.discountPercentage ?? payload.discount ?? null

  const calibrated = wantsPromo
    ? calibrateCeilingForExactFloor(rawBasePrice, finalPrice, preferredPct)
    : { calibratedCeiling: Math.round(finalPrice), discountPct: 0, exactFloorPrice: Math.round(finalPrice) }

  const activeCampaignType =
    wantsPromo && calibrated.discountPct > 0 ? requestedCampaignType : 'none'

  const isFlashDeal = activeCampaignType === 'flash'
  const isSpecialOffer = activeCampaignType === 'featured'
  const isTimedSale = activeCampaignType === 'timed_sale'
  const hasDirectProductPromo = isFlashDeal || isSpecialOffer

  const endIso =
    payload.timedSale?.endDate ||
    payload.flashDealEndTime ||
    payload.specialOfferEndTime ||
    new Date(Date.now() + (isFlashDeal ? 12 : isSpecialOffer ? 48 : 72) * 3600 * 1000).toISOString()

  const rawTheme =
    payload.timedSale?.badgeTheme ||
    payload.pricingMeta?.badgeTheme ||
    (isFlashDeal ? 'gold-red' : isSpecialOffer ? 'red-purple' : 'green-orange')
  const badgeTheme = VALID_THEMES.has(rawTheme) ? rawTheme : 'green-orange'
  const showInFeatured =
    payload.timedSale?.showInFeatured !== undefined
      ? Boolean(payload.timedSale.showInFeatured)
      : payload.pricingMeta?.showInFeatured !== undefined
        ? Boolean(payload.pricingMeta.showInFeatured)
        : true

  const timedSaleSpec = isTimedSale
    ? {
        enabled: true,
        name: String(payload.timedSale?.name || payload.pricingMeta?.campaignName || 'فروش ویژه هوشمند').trim(),
        discountPercentage: calibrated.discountPct,
        endDate: new Date(endIso),
        badgeTheme,
        showInFeatured,
      }
    : {
        enabled: false,
      }

  const targetDocPrice = activeCampaignType !== 'none' ? calibrated.calibratedCeiling : Math.round(finalPrice)
  const existingMeta = existingProduct?.pricingMeta || {}
  const idempotentReplay = Boolean(
    existingProduct &&
      ((idempotencyKey && existingMeta.idempotencyKey === idempotencyKey) ||
        (decisionId && String(existingMeta.decisionId || '') === decisionId)) &&
      Number(existingMeta.exactFloorPrice) === calibrated.exactFloorPrice &&
      Number(existingProduct.price) === targetDocPrice &&
      String(existingMeta.campaignType || 'none') === activeCampaignType
  )

  return {
    valid: true,
    campaignType: activeCampaignType,
    timedSaleSpec,
    decisionId,
    idempotencyKey,
    belowCostAuthorized: hasValidBelowCostOverride,
    idempotentReplay,
    updateDoc: {
      // در هر ۳ حالت پروموشن (flash, featured, timed_sale)، فیلد price روی Product برابر سقف معیار (calibratedCeiling) قرار می‌گیرد
      // اما در حالت timed_sale، فیلدهای isFlashDeal, isSpecialOffer و discount روی Product صفر می‌شوند تا تخفیف از طریق مدل Sale اعمال گردد
      price: targetDocPrice,
      compareAtPrice: hasDirectProductPromo ? calibrated.calibratedCeiling : null,
      discount: hasDirectProductPromo ? calibrated.discountPct : 0,
      isFlashDeal,
      flashDealEndTime: isFlashDeal ? new Date(endIso) : null,
      isSpecialOffer,
      specialOfferEndTime: isSpecialOffer ? new Date(endIso) : null,
      ...(effectiveCostPrice > 0 ? { costPrice: Math.round(effectiveCostPrice) } : {}),
      ...(effectiveHardFloor > 0 ? { hardFloorPrice: Math.round(effectiveHardFloor) } : {}),
      ...(Array.isArray(payload.supplierQuotes) ? { supplierQuotes: payload.supplierQuotes } : {}),
      pricingMeta: {
        ...existingMeta,
        ...(payload.pricingMeta || {}),
        ...(decisionId ? { decisionId } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
        ...(hasValidBelowCostOverride
          ? {
              belowCostOverride: {
                allowBelowCost: true,
                reason: rawOverride.reason.trim(),
                authorizedBy: rawOverride.authorizedBy.trim(),
                authorizedAt: new Date(),
              },
            }
          : {}),
        campaignType: activeCampaignType,
        badgeTheme,
        showInFeatured: isSpecialOffer ? true : isTimedSale ? showInFeatured : false,
        monitoredMarketCeiling: Number(payload.monitoredMarketCeiling || calibrated.calibratedCeiling),
        calibratedCeiling: calibrated.calibratedCeiling,
        exactFloorPrice: calibrated.exactFloorPrice,
        ...(effectiveHardFloor > 0 ? { hardFloorPrice: Math.round(effectiveHardFloor) } : {}),
        exactFloorPriceAt: new Date(),
        needsRefresh: false,
        syncedAt: new Date(),
        updatedAt: new Date(),
      },
      priceUpdatedAt: new Date(),
    },
    effectiveCostPrice,
    effectiveHardFloor,
    finalPrice: calibrated.exactFloorPrice,
    basePrice: targetDocPrice,
    discountPct: calibrated.discountPct,
  }
}

/**
 * هماهنگ‌سازی عضویت محصول در کمپین‌های زمان‌دار بخش مالی و تخفیف (`Sale`):
 *  - اگر کمپین فعلی محصول `flash`، `featured` یا `none` باشد، محصول از تمام کمپین‌های `Sale` فعال خارج می‌شود تا تداخل (`409 CAMPAIGN_CONFLICT`) رخ ندهد.
 *  - اگر کمپین فعلی `timed_sale` باشد، محصول از سایر کمپین‌های `Sale` خارج شده و به کمپین `Sale` متناظر با `(name, discountPercentage, badgeTheme, showInFeatured)` اضافه می‌گردد.
 */
const syncProductTimedSaleMembership = async (SaleModel, productId, timedSaleSpec = { enabled: false }) => {
  if (!SaleModel || !productId) return null

  // ۱) اگر کمپین از نوع timed_sale نیست، محصول را فقط از کمپین‌های خودکار (autoManaged)
  // خارج کن؛ Sale دستی ادمین باید دست‌نخورده بماند (۴.۱.۱).
  if (!timedSaleSpec || !timedSaleSpec.enabled) {
    if (typeof SaleModel.updateMany === 'function') {
      await SaleModel.updateMany(
        { products: productId, isActive: true, autoManaged: true },
        { $pull: { products: productId } }
      )
    }
    // سبدهای autoManaged که همین خروج سبب خالی‌شدنشان شده، بلافاصله پاک‌سازی می‌شوند (S3)
    await cleanupEmptyAutoManagedSales(SaleModel)
    return null
  }

  const now = new Date()
  const name = timedSaleSpec.name || 'فروش ویژه هوشمند'
  const discountPercentage = Math.max(1, Math.min(99, Math.round(Number(timedSaleSpec.discountPercentage) || 1)))
  const badgeTheme = VALID_THEMES.has(timedSaleSpec.badgeTheme) ? timedSaleSpec.badgeTheme : 'green-orange'
  const showInFeatured = timedSaleSpec.showInFeatured !== false
  const endDate =
    timedSaleSpec.endDate instanceof Date && !Number.isNaN(timedSaleSpec.endDate.getTime())
      ? timedSaleSpec.endDate
      : new Date(Date.now() + 72 * 3600 * 1000)

  // ۲) حذف محصول از هر کمپین Sale خودکار دیگری که مشخصاتش با کمپین فعلی فرق دارد.
  // Saleهای دستی ادمین (autoManaged=false) لمس نمی‌شوند.
  if (typeof SaleModel.updateMany === 'function') {
    await SaleModel.updateMany(
      {
        products: productId,
        autoManaged: true,
        $or: [
          { name: { $ne: name } },
          { discountPercentage: { $ne: discountPercentage } },
        ],
      },
      { $pull: { products: productId } }
    )
  }

  // ۳) یافتن یا ایجاد/بروزرسانی کمپین Sale خودکارِ منطبق در بخش مالی و تخفیف.
  // ۴.۱.۱: فقط Saleهای autoManaged قابل تطبیق‌اند و endDate فقط هنگام ساخت تنظیم می‌شود؛
  // نوشتن endDate در $set تاریخ پایان Sale مشترک را با هر محصول جدید جلو می‌برد.
  if (typeof SaleModel.findOneAndUpdate === 'function') {
    const saleDoc = await SaleModel.findOneAndUpdate(
      {
        name,
        discountPercentage,
        isActive: true,
        autoManaged: true,
      },
      {
        $set: {
          badgeTheme,
          showInFeatured,
          isActive: true,
        },
        $setOnInsert: {
          startDate: new Date(now.getTime() - 60 * 1000),
          endDate,
          categories: [],
          includeSubcategories: true,
          autoManaged: true,
        },
        $addToSet: {
          products: productId,
        },
      },
      {
        new: true,
        upsert: true,
      }
    )
    // کمپین‌های autoManaged دیگری که این انتقال، سبدشان را خالی کرده پاک می‌شوند (S3)
    await cleanupEmptyAutoManagedSales(SaleModel)
    return saleDoc
  }

  return null
}

/**
 * پاک‌سازی خودکار کمپین‌های زمان‌دارِ «مغز قیمت‌گذاری» (S3):
 * هر Sale که با autoManaged=true ساخته شده است پس از پایان endDate غیرفعال و
 * اگر هنوز هم بدون محصول باشد، حذف می‌شود تا بخش «فرصت‌های زمان‌دار» از
 * رده کمپین‌های بی‌فرزند تمیز بماند. کمپین‌های دستی ادمین (autoManaged=false)
 * هرگز لمس نمی‌شوند.
 */
const cleanupEmptyAutoManagedSales = async (SaleModel, { now = new Date() } = {}) => {
  // مدل واقعی mongoose یا هر آبجکت با updateMany/deleteMany پذیرفته می‌شود؛ استاب‌های ناقص نادیده.
  if (!SaleModel || typeof SaleModel.updateMany !== 'function') return { deactivated: 0, deleted: 0 }

  const deactivatedRes = await SaleModel.updateMany(
    { autoManaged: true, isActive: true, endDate: { $lte: now } },
    { $set: { isActive: false } }
  )

  let deleted = 0
  if (typeof SaleModel.deleteMany === 'function') {
    const res = await SaleModel.deleteMany({
      autoManaged: true,
      isActive: true,
      products: { $size: 0 },
    })
    deleted = res.deletedCount || 0
  }

  return { deactivated: deactivatedRes.modifiedCount || 0, deleted }
}

module.exports = {
  calibrateCeilingForExactFloor,
  validatePricingSyncPayload,
  syncProductTimedSaleMembership,
  cleanupEmptyAutoManagedSales,
}
