const Order = require('../models/Order')
const { logAction } = require('../utils/auditLogger')

/**
 * Checks for orders that have passed their auto-complete date
 * and updates them to 'Delivered'.
 */
const checkAndCompleteOrders = async () => {
    try {
        const now = new Date()

        // Find orders that are 'Shipped' and have a valid autoCompleteAt date in the past
        const ordersToComplete = await Order.find({
            orderStatus: 'Shipped',
            autoCompleteAt: { $exists: true, $ne: null, $lte: now }
        })

        if (ordersToComplete.length > 0) {
            console.log(`[AUTO-COMPLETE] Found ${ordersToComplete.length} orders to complete.`)

            for (const order of ordersToComplete) {
                try {
                    // Atomically update only if status is still 'Shipped' to prevent race conditions in PM2 cluster mode
                    const updatedOrder = await Order.findOneAndUpdate(
                        {
                            _id: order._id,
                            orderStatus: 'Shipped',
                            autoCompleteAt: { $exists: true, $ne: null, $lte: now }
                        },
                        {
                            $set: {
                                orderStatus: 'Delivered',
                                deliveredAt: now
                            },
                            $unset: { autoCompleteAt: "" }
                        },
                        { new: true }
                    )

                    if (!updatedOrder) {
                        // Already completed or modified by another worker
                        continue
                    }

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

                    console.log(`[AUTO-COMPLETE] Order ${order._id} updated to Delivered successfully.`)
                } catch (orderError) {
                    console.error(`[AUTO-COMPLETE] Error processing order ${order._id}:`, orderError)
                }
            }
        }
    } catch (error) {
        console.error('[AUTO-COMPLETE] Error fetching orders for auto-completion:', error)
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
