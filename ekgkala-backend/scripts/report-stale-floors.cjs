#!/usr/bin/env node
/**
 * ۴.۱.۲ (N5) — گزارش و پاک‌سازی کف‌های قطعی کهنه / عقب‌مانده.
 *
 * چرا: بعد از MANAGED_EXACT_FLOOR_MAX_AGE_DAYS (پیش‌فرض ۱۴ روز) بدون sync ترب،
 * گارد کف قطعی fail-closed خاموش می‌شود و قیمت نمایش به سقف معیار برمی‌گردد.
 * این اسکریپت پیش از رسیدن به آن مرز هشدار می‌دهد و با --fix عقب‌مانده‌های
 * قابل‌بازیابی (price > exactFloor و پروموشن مستقیم منقضی) را به کف برمی‌گرداند.
 *
 * استفاده:
 *   node scripts/report-stale-floors.cjs                 # گزارش
 *   node scripts/report-stale-floors.cjs --json          # خروجی JSON
 *   node scripts/report-stale-floors.cjs --fix           # اجرای پاک‌سازی عقب‌مانده
 *   node scripts/report-stale-floors.cjs --fail-on-expired  # خروج ۲ اگر از مرز گذشته باشد
 *
 * متغیرهای محیطی (اختیاری):
 *   MONGODB_URI، MANAGED_EXACT_FLOOR_MAX_AGE_DAYS، MANAGED_EXACT_FLOOR_WARN_AGE_DAYS
 */
const path = require('path')
const mongoose = require('mongoose')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const Product = require('../models/Product')
const {
  MANAGED_EXACT_FLOOR_MAX_AGE_DAYS,
  MANAGED_EXACT_FLOOR_WARN_AGE_DAYS,
  managedExactFloorAgeDays,
} = require('../services/pricingService')
const { runPromotionCleanup } = require('../services/promotionLifecycleService')

const argv = new Set(process.argv.slice(2))
const AS_JSON = argv.has('--json')
const FIX = argv.has('--fix')
const FAIL_ON_EXPIRED = argv.has('--fail-on-expired')

const maskUri = (uri) => String(uri || '').replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI تنظیم نشده است (فایل .env یا محیط)')

  await mongoose.connect(uri)
  const now = new Date()
  const docs = await Product.find({ 'pricingMeta.exactFloorPrice': { $gt: 0 } })
    .select('name sku price discount productType isFlashDeal flashDealEndTime isSpecialOffer specialOfferEndTime pricingMeta updatedAt')
    .lean()

  const rows = docs.map((p) => {
    const meta = p.pricingMeta || {}
    const exact = Math.round(Number(meta.exactFloorPrice) || 0)
    const price = Math.round(Number(p.price) || 0)
    const age = managedExactFloorAgeDays(p, now)
    const hasLivePromo =
      (p.isFlashDeal === true && (!p.flashDealEndTime || new Date(p.flashDealEndTime) > now)) ||
      (p.isSpecialOffer === true && (!p.specialOfferEndTime || new Date(p.specialOfferEndTime) > now))
    let status = 'ok'
    if (age == null) status = 'no-timestamp'
    else if (age > MANAGED_EXACT_FLOOR_MAX_AGE_DAYS) status = 'expired'
    else if (age >= MANAGED_EXACT_FLOOR_WARN_AGE_DAYS) status = 'aging'
    const directManaged = meta.campaignType == null || meta.campaignType === 'flash' || meta.campaignType === 'featured'
    if (status === 'ok' && !hasLivePromo && price > exact && meta.campaignType === 'timed_sale') status = 'timed-sale'
    else if (status === 'ok' && !hasLivePromo && price > exact && p.productType !== 'variable' && directManaged) status = 'backlog'
    return {
      id: String(p._id),
      name: p.name,
      sku: p.sku,
      price,
      exactFloorPrice: exact,
      ageDays: age == null ? null : Math.round(age * 10) / 10,
      campaignType: meta.campaignType || null,
      status,
    }
  })

  const counts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  if (AS_JSON) {
    console.log(JSON.stringify({ now: now.toISOString(), warnDays: MANAGED_EXACT_FLOOR_WARN_AGE_DAYS, maxDays: MANAGED_EXACT_FLOOR_MAX_AGE_DAYS, counts, rows }, null, 2))
  } else {
    console.log(`کف قطعی: ${rows.length} محصول | هشدار کهنگی: ${counts.aging || 0} | از مرز گذشته: ${counts.expired || 0} | عقب‌مانده: ${counts.backlog || 0} | بدون timestamp: ${counts['no-timestamp'] || 0}`)
    const interesting = rows.filter((r) => r.status !== 'ok')
    for (const r of interesting.slice(0, 50)) {
      console.log(`  [${r.status}] ${r.sku || r.id} | ${r.name || '-'} | price=${r.price} | floor=${r.exactFloorPrice} | age=${r.ageDays ?? '-'}d | campaign=${r.campaignType || '-'}`)
    }
    if (interesting.length > 50) console.log(`  ... و ${interesting.length - 50} ردیف دیگر (با --json کامل ببینید)`)
  }

  if (FIX) {
    const result = await runPromotionCleanup(Product, { now, batchSize: 1000 })
    console.log(`--fix: ${result.scanned} کاندید بررسی شد، ${result.modified} سند اصلاح شد.`)
  }

  await mongoose.disconnect()

  const expired = counts.expired || 0
  if (FAIL_ON_EXPIRED && expired > 0) process.exitCode = 2
}

main().catch(async (error) => {
  console.error('report-stale-floors failed:', error.message)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exitCode = 1
})
