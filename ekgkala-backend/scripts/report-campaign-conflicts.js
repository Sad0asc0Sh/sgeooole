/**
 * گزارشگر فقط‌خواندنی تداخل کمپین‌ها
 * ------------------------------------
 * محصولاتی را گزارش می‌دهد که هم‌زمان:
 *   ۱) در یک «تخفیف زمان‌دار» فعال/آینده عضو هستند (مستقیم یا از طریق دسته‌ی مستقیم)، و
 *   ۲) کمپین «پیشنهاد لحظه‌ای» (isFlashDeal) یا «شگفت‌انگیز» (isSpecialOffer) روی آن‌ها
 *      در بازه‌ی زمانی آن تخفیف فعال است.
 *
 * این اسکریپت هیچ تغییری در دیتابیس ایجاد نمی‌کند؛ فقط گزارش می‌دهد.
 * رفع تداخل باید دستی و آگاهانه توسط ادمین انجام شود.
 *
 * اجرا:  npm run report:campaign-conflicts
 * خروجی: گزارش فارسی در stdout + خلاصه‌ی JSON
 */

const mongoose = require('mongoose')
require('dotenv').config()

const Sale = require('../models/Sale')
const Product = require('../models/Product')
const {
  findProductCampaignConflicts,
  uniqueObjectIds,
} = require('../services/campaignConflictService')

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
  const now = new Date()

  const sales = await Sale.find({ isActive: true, endDate: { $gt: now } })
    .select('name discountPercentage startDate endDate products categories showInFeatured')
    .lean()

  if (!sales.length) {
    console.log('تخفیف زمان‌دار فعال/آینده‌ای یافت نشد؛ تداخلی برای بررسی وجود ندارد.')
    return { sales: 0, conflicts: 0 }
  }

  let totalConflicts = 0
  const report = []

  for (const sale of sales) {
    const directIds = uniqueObjectIds(sale.products || [])
    const categoryIds = uniqueObjectIds(sale.categories || [])
    let categoryMemberIds = []
    if (categoryIds.length) {
      const rows = await Product.find({ category: { $in: categoryIds } }, '_id').lean()
      categoryMemberIds = rows.map((r) => r._id)
    }
    const candidateIds = uniqueObjectIds([...directIds, ...categoryMemberIds])
    if (!candidateIds.length) continue

    // کمپینی که قبل از شروع تخفیف تمام شده، تداخل حساب نمی‌شود (windowStart)
    const conflicts = await findProductCampaignConflicts(candidateIds, {
      windowStart: sale.startDate,
      now,
    })
    if (!conflicts.length) continue

    totalConflicts += conflicts.length
    report.push({ sale, conflicts })

    console.log('—'.repeat(60))
    console.log(`تخفیف: ${sale.name} (${sale.discountPercentage}٪)`)
    console.log(`بازه: ${sale.startDate.toISOString()} تا ${sale.endDate.toISOString()}`)
    console.log(`تعداد محصولات دارای تداخل: ${conflicts.length}`)
    for (const row of conflicts) {
      const labels = row.conflicts
        .map((c) => `${c.label}${c.endTime ? ` (پایان: ${new Date(c.endTime).toISOString()})` : ''}`)
        .join(' و ')
      console.log(`  • ${row.name} [${row.sku || 'بدون کد'}] — ${labels}`)
    }
  }

  console.log('='.repeat(60))
  console.log(`جمع‌بندی: ${sales.length} تخفیف بررسی شد، ${totalConflicts} مورد تداخل در ${report.length} تخفیف یافت شد.`)
  if (totalConflicts > 0) {
    console.log('این موارد به‌صورت خودکار اصلاح نمی‌شوند؛ لطفاً دستی بررسی و رفع کنید.')
  }
  return { sales: sales.length, conflicts: totalConflicts }
}

main()
  .then((summary) => {
    console.log(JSON.stringify({ ok: true, ...summary }))
    return mongoose.disconnect()
  })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('خطا در اجرای گزارشگر:', err.message)
    process.exit(1)
  })
