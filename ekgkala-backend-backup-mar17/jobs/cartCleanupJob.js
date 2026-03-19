/**
 * Cart Cleanup Job
 * پاکسازی خودکار سبدهای خرید منقضی شده
 * هر 5 دقیقه اجرا می‌شود
 */
const Cart = require('../models/Cart')

let isRunning = false

/**
 * Main cleanup function
 * سبدهای منقضی شده را پیدا کرده و آنها را علامت‌گذاری می‌کند
 */
async function cleanupExpiredCarts() {
    if (isRunning) {
        console.log('[CART_CLEANUP_JOB] Already running, skipping...')
        return
    }

    isRunning = true

    try {
        const now = new Date()

        // پیدا کردن سبدهای منقضی شده که هنوز فعال هستند
        const expiredCarts = await Cart.find({
            status: 'active',
            expiresAt: { $lte: now },
            isExpired: { $ne: true },
        })

        if (expiredCarts.length === 0) {
            console.log('[CART_CLEANUP_JOB] No expired carts found')
            isRunning = false
            return
        }

        console.log(`[CART_CLEANUP_JOB] Found ${expiredCarts.length} expired carts`)

        // علامت‌گذاری به عنوان منقضی شده و پاک کردن آیتم‌ها
        let cleanedCount = 0
        for (const cart of expiredCarts) {
            try {
                cart.isExpired = true
                cart.status = 'expired'
                cart.items = []
                cart.totalPrice = 0
                await cart.save()
                cleanedCount++
                console.log(`[CART_CLEANUP_JOB] ✅ Cart ${cart._id} marked as expired`)
            } catch (err) {
                console.error(`[CART_CLEANUP_JOB] Error processing cart ${cart._id}:`, err.message)
            }
        }

        console.log(`[CART_CLEANUP_JOB] ✅ Cleaned ${cleanedCount} expired carts`)

    } catch (error) {
        console.error('[CART_CLEANUP_JOB] Error:', error.message)
    } finally {
        isRunning = false
    }
}

/**
 * Start the job (runs every 5 minutes)
 * شروع job - هر 5 دقیقه اجرا می‌شود
 */
function startCartCleanupJob() {
    console.log('⏰ Cart Cleanup Job Started (runs every 5 minutes)')

    // اجرای اولیه
    cleanupExpiredCarts()

    // اجرای هر 5 دقیقه (300000 میلی‌ثانیه)
    setInterval(cleanupExpiredCarts, 5 * 60 * 1000)
}

module.exports = { startCartCleanupJob, cleanupExpiredCarts }
