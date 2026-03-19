const Order = require('../models/Order')
const { logAction } = require('../utils/auditLogger')

/**
 * Checks for orders that have passed their auto-complete date
 * and updates them to 'Delivered'.
 */
const checkAndCompleteOrders = async () => {
    try {
        const now = new Date()

        // Find orders that are 'Shipped', have an autoCompleteAt date in the past
        const ordersToComplete = await Order.find({
            orderStatus: 'Shipped',
            autoCompleteAt: { $lte: now }
        })

        if (ordersToComplete.length > 0) {
            console.log(`[AUTO-COMPLETE] Found ${ordersToComplete.length} orders to complete.`)

            for (const order of ordersToComplete) {
                order.orderStatus = 'Delivered'
                order.deliveredAt = now
                order.autoCompleteAt = undefined // Clear the timer
                await order.save()

                // Audit Log
                await logAction({
                    action: 'AUTO_COMPLETE_ORDER',
                    entity: 'Order',
                    entityId: order._id,
                    userId: null, // System action
                    details: {
                        message: 'Order status automatically updated to Delivered due to timer expiration',
                        previousStatus: 'Shipped'
                    }
                })

                console.log(`[AUTO-COMPLETE] Order ${order._id} updated to Delivered.`)
            }
        }
    } catch (error) {
        console.error('[AUTO-COMPLETE] Error processing orders:', error)
    }
}

// Start the interval (e.g., check every 1 minute)
const startOrderAutoCompleter = () => {
    console.log('⏰ Order Auto-Completer Job Started')
    // Run immediately on startup
    checkAndCompleteOrders()
    // Then run every 60 seconds
    setInterval(checkAndCompleteOrders, 60 * 1000)
}

module.exports = startOrderAutoCompleter
