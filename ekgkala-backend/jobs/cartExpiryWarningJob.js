const Cart = require('../models/Cart')
const Settings = require('../models/Settings')
const { sendExpiryWarningEmail, sendExpiryWarningSMS } = require('../utils/notificationService')

/**
 * Cart Expiry Warning Job
 * 
 * این جاب به صورت خودکار سبدهای نزدیک به انقضا را پیدا کرده
 * و بر اساس تنظیمات ادمین، ایمیل یا پیامک هشدار ارسال می‌کند
 * 
 * اجرا: هر 1 دقیقه
 */

// Helper function to get cart settings
async function getCartSettings() {
    try {
        const settings = await Settings.findOne({ singletonKey: 'main_settings' })
        return {
            expiryWarningEnabled: settings?.cartSettings?.expiryWarningEnabled || false,
            expiryWarningMinutes: settings?.cartSettings?.expiryWarningMinutes || 30,
            notificationType: settings?.cartSettings?.notificationType || 'both',
        }
    } catch (error) {
        console.error('[CART_WARNING_JOB] Error fetching settings:', error)
        return {
            expiryWarningEnabled: false,
            expiryWarningMinutes: 30,
            notificationType: 'both',
        }
    }
}

/**
 * Main function to send expiry warnings
 */
const sendExpiryWarnings = async () => {
    try {
        const cartSettings = await getCartSettings()

        // Check if warnings are enabled
        if (!cartSettings.expiryWarningEnabled) {
            // Don't log every minute when disabled
            return
        }

        console.log('[CART_WARNING_JOB] Checking for carts near expiry...')
        console.log('[CART_WARNING_JOB] Settings:', cartSettings)

        const now = new Date()
        const warningTime = new Date(now.getTime() + cartSettings.expiryWarningMinutes * 60 * 1000)

        // Find carts that are near expiry and haven't been warned yet
        const cartsNearExpiry = await Cart.find({
            status: 'active',
            isExpired: false,
            expiryWarningSent: false,
            expiresAt: {
                $lte: warningTime,
                $gt: now,
            },
        })
            .populate('user', 'name email mobile')
            .lean()

        if (cartsNearExpiry.length === 0) {
            return
        }

        console.log(`[CART_WARNING_JOB] Found ${cartsNearExpiry.length} carts near expiry`)

        let successCount = 0
        let emailCount = 0
        let smsCount = 0

        for (const cart of cartsNearExpiry) {
            try {
                const user = cart.user
                if (!user) {
                    console.log(`[CART_WARNING_JOB] Cart ${cart._id} has no user, skipping`)
                    continue
                }

                const minutesRemaining = Math.floor((new Date(cart.expiresAt) - now) / (60 * 1000))

                // Send Email (if enabled)
                if ((cartSettings.notificationType === 'email' || cartSettings.notificationType === 'both') && user.email) {
                    try {
                        await sendExpiryWarningEmail(user.email, {
                            userName: user.name || 'کاربر',
                            itemCount: cart.items?.length || 0,
                            totalPrice: cart.totalPrice || 0,
                            expiryMinutes: minutesRemaining,
                            isWarning: true,
                        })
                        emailCount++
                        console.log(`[CART_WARNING_JOB] ✉️ Email sent to ${user.email}`)
                    } catch (emailErr) {
                        console.error('[CART_WARNING_JOB] Error sending email:', emailErr.message)
                    }
                }

                // Send SMS (if enabled)
                if ((cartSettings.notificationType === 'sms' || cartSettings.notificationType === 'both') && user.mobile) {
                    try {
                        await sendExpiryWarningSMS(user.mobile, {
                            userName: user.name || 'کاربر',
                            itemCount: cart.items?.length || 0,
                            expiryMinutes: minutesRemaining,
                            isWarning: true,
                        })
                        smsCount++
                        console.log(`[CART_WARNING_JOB] 📱 SMS sent to ${user.mobile}`)
                    } catch (smsErr) {
                        console.error('[CART_WARNING_JOB] Error sending SMS:', smsErr.message)
                    }
                }

                // Mark as warned
                await Cart.findByIdAndUpdate(cart._id, {
                    expiryWarningSent: true,
                })

                successCount++
            } catch (err) {
                console.error(`[CART_WARNING_JOB] Error processing cart ${cart._id}:`, err.message)
            }
        }

        console.log(`[CART_WARNING_JOB] ✅ Completed: ${successCount} carts processed, ${emailCount} emails sent, ${smsCount} SMS sent`)
    } catch (error) {
        console.error('[CART_WARNING_JOB] Critical error:', error)
    }
}

/**
 * Start the cart warning job
 * Runs every 1 minute
 */
const startCartExpiryWarningJob = () => {
    console.log('⏰ Cart Expiry Warning Job Started')

    // Run immediately on startup
    sendExpiryWarnings()

    // Then run every 60 seconds
    setInterval(sendExpiryWarnings, 60 * 1000)
}

module.exports = startCartExpiryWarningJob
