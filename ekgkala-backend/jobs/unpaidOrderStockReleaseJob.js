const Order = require('../models/Order')
const inventoryService = require('../services/inventoryService')

// ============================================
// آزادسازی رزرو موجودی سفارش‌های پرداخت‌نشده‌ی قدیمی
// --------------------------------------------
// از وقتی موجودی هنگام «ثبت سفارش» رزرو می‌شود، یک سفارش Pendingِ
// پرداخت‌نشده (کاربر درگاه را رها کرده) نباید موجودی را برای همیشه قفل
// کند. این جاب سفارش‌هایی را که بیش از TTL پرداخت نشده مانده‌اند به‌صورت
// اتمیک claim و لغو می‌کند و موجودی‌شان را به انبار برمی‌گرداند.
// سفارش لغوشده قابل پرداخت نیست (payOrder رد می‌کند)؛ ادمین می‌تواند با
// تغییر وضعیت، سفارش را دوباره فعال کند که در آن صورت موجودی از نو و به
// صورت اتمیک رزرو می‌شود.
// ============================================

const UNPAID_RESERVATION_TTL_MS = 24 * 60 * 60 * 1000 // ۲۴ ساعت
const CHECK_INTERVAL_MS = 5 * 60 * 1000 // هر ۵ دقیقه

const releaseExpiredUnpaidReservations = async () => {
  try {
    const cutoff = new Date(Date.now() - UNPAID_RESERVATION_TTL_MS)

    const staleOrders = await Order.find({
      isPaid: false,
      orderStatus: 'Pending',
      stockDeducted: true,
      createdAt: { $lte: cutoff },
    })
      .select('_id orderCode orderItems')
      .lean()

    for (const staleOrder of staleOrders) {
      try {
        // Claim اتمیک: فقط اگر سفارش هنوز دقیقاً در همان وضعیت است ادامه بده
        // (سازگار با PM2 کلاستر و تغییر همزمان وضعیت توسط ادمین/پرداخت).
        const claimed = await Order.findOneAndUpdate(
          {
            _id: staleOrder._id,
            isPaid: false,
            orderStatus: 'Pending',
            stockDeducted: true,
          },
          { $set: { orderStatus: 'Cancelled', stockDeducted: false } },
          { new: true },
        )

        if (!claimed) continue

        await inventoryService.releaseStock(staleOrder.orderItems)

        try {
          const { logAction } = require('../utils/auditLogger')
          await logAction({
            action: 'AUTO_CANCEL_UNPAID_STOCK_RELEASE',
            entity: 'Order',
            entityId: staleOrder._id,
            userId: null, // System action
            details: {
              message: 'Unpaid order auto-cancelled after 24h; reserved stock released back to inventory',
              orderCode: staleOrder.orderCode,
            },
          })
        } catch (auditErr) {
          // Non-critical
        }

        console.log(`[STOCK-RELEASE] ♻️ Order ${staleOrder.orderCode || staleOrder._id} auto-cancelled; stock released`)
      } catch (orderErr) {
        console.error('[STOCK-RELEASE] Error releasing order', staleOrder._id, orderErr.message)
      }
    }
  } catch (error) {
    console.error('[STOCK-RELEASE] Error fetching stale unpaid orders:', error.message)
  }
}

const startUnpaidOrderStockReleaseJob = () => {
  console.log('⏰ Unpaid Order Stock-Release Job Started')
  releaseExpiredUnpaidReservations()
  setInterval(releaseExpiredUnpaidReservations, CHECK_INTERVAL_MS)
}

module.exports = startUnpaidOrderStockReleaseJob
module.exports.releaseExpiredUnpaidReservations = releaseExpiredUnpaidReservations
module.exports.UNPAID_RESERVATION_TTL_MS = UNPAID_RESERVATION_TTL_MS
