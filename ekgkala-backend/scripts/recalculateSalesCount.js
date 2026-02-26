// f:/frontend now3 google/ekgkala-backend/scripts/recalculateSalesCount.js
require('dotenv').config()
const mongoose = require('mongoose')
const Order = require('../models/Order')
const Product = require('../models/Product')

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        })
        console.log('Connected to MongoDB')

        // Reset all sales counts
        console.log('Resetting all sales counts to 0...')
        await Product.updateMany({}, { $set: { salesCount: 0 } })

        // Find all valid orders
        const orders = await Order.find({
            $or: [
                { isPaid: true },
                { paymentMethod: 'cod' }
            ],
            orderStatus: { $ne: 'Cancelled' }
        })

        console.log(`Found ${orders.length} successful orders to recalculate...`)

        let totalUpdated = 0

        for (const order of orders) {
            for (const item of order.orderItems) {
                if (!item.product) continue

                await Product.updateOne(
                    { _id: item.product },
                    { $inc: { salesCount: item.quantity } }
                )
                totalUpdated += item.quantity
            }
        }

        console.log(`Successfully recalculated sales statistics. Total units sold recorded: ${totalUpdated}`)
    } catch (error) {
        console.error('Migration failed:', error)
    } finally {
        mongoose.disconnect()
        console.log('Disconnected from MongoDB')
    }
}

run()
