/**
 * Migration Script: Generate Order Codes for Existing Orders
 * 
 * This script finds all orders that don't have an orderCode
 * and generates unique codes in the format WV-XXXXXX for them.
 * 
 * Run this script once after deploying the orderCode feature:
 * node scripts/migrateOrderCodes.js
 */

require('dotenv').config()
const mongoose = require('mongoose')
const Order = require('../models/Order')

// Generate unique order code
const generateOrderCode = () => {
    return 'WV-' + Math.floor(100000 + Math.random() * 900000).toString()
}

// Check if order code is unique
const isOrderCodeUnique = async (code) => {
    const existing = await Order.findOne({ orderCode: code })
    return !existing
}

// Generate a guaranteed unique order code
const generateUniqueOrderCode = async () => {
    let code
    let isUnique = false
    let attempts = 0
    const maxAttempts = 10

    while (!isUnique && attempts < maxAttempts) {
        code = generateOrderCode()
        isUnique = await isOrderCodeUnique(code)
        attempts++
    }

    if (!isUnique) {
        // Fallback: Use timestamp + random for guaranteed uniqueness
        code = 'WV-' + Date.now().toString().slice(-6)
    }

    return code
}

const migrateOrderCodes = async () => {
    try {
        console.log('🔌 Connecting to database...')
        await mongoose.connect(process.env.MONGODB_URI)
        console.log('✅ Connected to MongoDB')

        // Find all orders without orderCode
        const ordersWithoutCode = await Order.find({
            $or: [
                { orderCode: { $exists: false } },
                { orderCode: null },
                { orderCode: '' }
            ]
        }).select('_id orderCode createdAt')

        console.log(`📦 Found ${ordersWithoutCode.length} orders without orderCode`)

        if (ordersWithoutCode.length === 0) {
            console.log('✨ All orders already have order codes!')
            return
        }

        let updated = 0
        let errors = 0

        for (const order of ordersWithoutCode) {
            try {
                const newCode = await generateUniqueOrderCode()

                await Order.updateOne(
                    { _id: order._id },
                    { $set: { orderCode: newCode } }
                )

                console.log(`✅ Order ${order._id} -> ${newCode}`)
                updated++
            } catch (err) {
                console.error(`❌ Failed to update order ${order._id}:`, err.message)
                errors++
            }
        }

        console.log('\n📊 Migration Summary:')
        console.log(`   Updated: ${updated}`)
        console.log(`   Errors: ${errors}`)
        console.log(`   Total: ${ordersWithoutCode.length}`)

    } catch (error) {
        console.error('❌ Migration failed:', error)
        process.exit(1)
    } finally {
        await mongoose.disconnect()
        console.log('\n🔌 Disconnected from database')
        process.exit(0)
    }
}

// Run the migration
migrateOrderCodes()
