/**
 * گزارش فقط‌خواندنی محصولات و واریانت‌های دارای قیمت خط‌خورده‌ی مشکوک
 * ------------------------------------------------------------------
 * این اسکریپت هیچ تغییری در دیتابیس ایجاد نمی‌کند؛ فقط گزارش می‌دهد.
 *
 * طبقه‌بندی بر اساس قرارداد مرکزی قیمت (services/pricingService.js):
 * - LEGACY:      compareAtPrice > price و رابطه‌ی price ≈ compare × (1 − discount/100)
 *                برقرار است → داده‌ی قدیمیِ از قبل تخفیف‌خورده (سازگار)
 * - SUSPICIOUS:  compareAtPrice > price ولی رابطه‌ی بالا برقرار نیست →
 *                احتمالاً قیمت خط‌خورده‌ی کهنه یا اشتباه (مثل ۳۰ میلیون روی ۴.۸ میلیون)
 * - IGNORED:     compareAtPrice ≤ price (طبق قرارداد نادیده گرفته می‌شود)
 *
 * Usage:
 *   node scripts/report-suspicious-prices.js
 *   node scripts/report-suspicious-prices.js --csv out.csv
 *
 * متغیر محیطی: MONGODB_URI (پیش‌فرض: mongodb://localhost:27017/ekgkala)
 */
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

const { resolveBasePrice } = require('../services/pricingService')

const Product = require('../models/Product')

const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('fa-IR') : '—')

async function main() {
  const args = process.argv.slice(2)
  const csvIdx = args.indexOf('--csv')
  const csvPath = csvIdx >= 0 ? args[csvIdx + 1] : null

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'
  await mongoose.connect(mongoUri)

  // فقط خواندن: lean + انتخاب فیلدهای لازم
  const products = await Product.find(
    { $or: [{ compareAtPrice: { $gt: 0 } }, { 'variants.compareAtPrice': { $gt: 0 } }] },
    { name: 1, productCode: 1, price: 1, compareAtPrice: 1, discount: 1, productType: 1, variants: 1 },
  ).lean()

  const rows = []

  for (const p of products) {
    const storedDiscount = Number(p.discount) || 0

    const classify = (price, compare, label) => {
      const pr = Number(price) || 0
      const cp = Number(compare) || 0
      if (!(cp > 0)) return
      if (cp <= pr) {
        rows.push({ code: p.productCode || '', name: p.name || '', level: label, price: pr, compareAtPrice: cp, ratio: '—', status: 'IGNORED' })
        return
      }
      if (pr <= 0) {
        rows.push({ code: p.productCode || '', name: p.name || '', level: label, price: pr, compareAtPrice: cp, ratio: '—', status: 'ZERO_PRICE' })
        return
      }
      const base = resolveBasePrice(pr, cp, storedDiscount)
      const status = base === cp ? 'LEGACY' : 'SUSPICIOUS'
      const ratio = pr > 0 ? (cp / pr).toFixed(1) + '×' : '—'
      rows.push({ code: p.productCode || '', name: p.name || '', level: label, price: pr, compareAtPrice: cp, ratio, status })
    }

    if (p.productType === 'variable' && Array.isArray(p.variants)) {
      p.variants.forEach((v, i) => {
        const vLabel = Array.isArray(v.options) && v.options.length
          ? v.options.map((o) => `${o.name}:${o.value}`).join('، ')
          : `واریانت ${i + 1}`
        classify(v.price, v.compareAtPrice, `واریانت: ${vLabel}`)
      })
    } else {
      classify(p.price, p.compareAtPrice, 'محصول ساده')
    }
  }

  await mongoose.disconnect()

  const suspicious = rows.filter((r) => r.status === 'SUSPICIOUS')
  const legacy = rows.filter((r) => r.status === 'LEGACY')
  const ignored = rows.filter((r) => r.status === 'IGNORED')
  const zeroPrice = rows.filter((r) => r.status === 'ZERO_PRICE')

  console.log('\n=== گزارش قیمت‌های خط‌خورده (فقط خواندنی) ===')
  console.log(`کل موارد بررسی‌شده: ${rows.length}`)
  console.log(`مشکوک (SUSPICIOUS): ${suspicious.length}`)
  console.log(`قدیمی سازگار (LEGACY): ${legacy.length}`)
  console.log(`قیمت صفر (ZERO_PRICE): ${zeroPrice.length}`)
  console.log(`نادیده گرفته‌شده (IGNORED): ${ignored.length}`)

  const printTable = (list, title) => {
    if (list.length === 0) return
    console.log(`\n--- ${title} ---`)
    for (const r of list) {
      console.log(
        `کد: ${r.code} | ${r.name} | ${r.level} | قیمت: ${fmt(r.price)} | خط‌خورده: ${fmt(r.compareAtPrice)} | نسبت: ${r.ratio}`,
      )
    }
  }

  printTable(suspicious, 'مشکوک — نیازمند بررسی ادمین')
  printTable(legacy, 'قدیمی سازگار — بدون نیاز به اقدام')

  if (csvPath) {
    const header = 'code,name,level,price,compareAtPrice,ratio,status'
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = rows.map((r) =>
      [r.code, r.name, r.level, r.price, r.compareAtPrice, r.ratio, r.status].map(esc).join(','),
    )
    fs.writeFileSync(path.resolve(csvPath), '\uFEFF' + [header, ...lines].join('\n'), 'utf8')
    console.log(`\nخروجی CSV ذخیره شد: ${csvPath}`)
  }

  console.log('\nتوجه: این اسکریپت هیچ داده‌ای را اصلاح نکرده است. تصمیم نهایی با ادمین است.')
}

main().catch((err) => {
  console.error('خطا در اجرای گزارش:', err.message)
  process.exit(1)
})
