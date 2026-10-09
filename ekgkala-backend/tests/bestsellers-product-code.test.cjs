// تست قرارداد productCode در پاسخ پرفروش‌ترین‌ها — آفلاین، بدون MongoDB/Redis
// پوشش: خروجی کارت پرفروش‌ترین‌ها باید productCode داشته باشد تا فرانت با
// buildProductUrl لینک canonical (/product/KY-…/…) بسازد؛ بدون آن کارت‌ها به
// آدرس قدیمی /product/<_id>/… لینک می‌شدند و آن مسیر (ریدایرکت به canonical)
// برای اسلاگ فارسی کرش می‌کرد.
// مدل‌ها و سرویس کمپین قبل از require کنترلر stub می‌شوند؛ مسیر اصلی
// (ProductScore) با یک سند جعلی که productCode دارد تمرین می‌شود.
const assert = require('node:assert/strict')
const test = require('node:test')

// --- stub زمینه‌ی کمپین فروش (بدون دیتابیس) ---
const pricingService = require('../services/pricingService')
pricingService.getActiveSalesCampaignContext = async () => null

// --- stub مدل امتیاز ---
const ProductScore = require('../models/ProductScore')

const fakeProduct = {
  _id: '6aac1427784c4750566d5dfd',
  name: 'ماژول ریموتگ بتا',
  slug: 'ماژول-ریموتگ-بتا',
  productCode: 'KY-0008061',
  images: [],
  price: 2760000,
  discount: 3,
  compareAtPrice: 2760000,
  rating: 4,
  numReviews: 2,
  stock: 10,
  category: { _id: 'c1', name: 'درب اتومات', slug: 'automatic-door' },
  isFlashDeal: false,
  flashDealEndTime: null,
  isSpecialOffer: false,
  specialOfferEndTime: null,
  campaignLabel: null,
  campaignTheme: null,
  productType: 'simple',
  variants: [],
}

ProductScore.countDocuments = async () => 1
ProductScore.find = () => ({
  sort: () => ({
    limit: () => ({
      populate: () => ({
        lean: async () => [
          {
            product_id: fakeProduct,
            decayed_score: 10,
            final_score: 10,
            trend_score: 0,
            is_new_product: false,
          },
        ],
      }),
    }),
  }),
})

const { getBestsellers } = require('../controllers/bestsellersController')

test('getBestsellers: کارت خروجی productCode را پاس می‌دهد', async () => {
  let payload = null
  const res = {
    json(body) {
      payload = body
      return body
    },
    status(code) {
      throw new Error(`unexpected status ${code}`)
    },
  }

  await getBestsellers({ query: { limit: '8', in_stock: 'true', nocache: 'true' } }, res)

  assert.equal(payload.success, true)
  assert.equal(payload.data.length, 1)
  assert.equal(payload.data[0].productCode, 'KY-0008061')
  assert.equal(payload.data[0].slug, 'ماژول-ریموتگ-بتا')
})
