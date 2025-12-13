const Newsletter = require('../models/Newsletter')
const crypto = require('crypto')

/**
 * Subscribe to newsletter
 * POST /api/newsletter/subscribe
 * Public endpoint
 */
exports.subscribe = async (req, res) => {
    try {
        const { email, source = 'footer' } = req.body

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'لطفاً ایمیل خود را وارد کنید',
            })
        }

        // Validate email format
        const emailRegex = /^\S+@\S+\.\S+$/
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'فرمت ایمیل نامعتبر است',
            })
        }

        // Get IP address
        const ipAddress = req.ip || req.connection?.remoteAddress || null

        // Check if already subscribed
        const existingSubscriber = await Newsletter.findOne({ email: email.toLowerCase() })

        if (existingSubscriber) {
            // If already active, return success (idempotent)
            if (existingSubscriber.isActive) {
                return res.json({
                    success: true,
                    message: 'شما قبلاً در خبرنامه عضو شده‌اید',
                    alreadySubscribed: true,
                })
            }

            // Reactivate subscription
            existingSubscriber.isActive = true
            existingSubscriber.unsubscribedAt = null
            existingSubscriber.subscribedAt = new Date()
            existingSubscriber.source = source
            existingSubscriber.ipAddress = ipAddress
            existingSubscriber.unsubscribeToken = crypto.randomBytes(32).toString('hex')
            await existingSubscriber.save()

            return res.json({
                success: true,
                message: 'عضویت شما در خبرنامه با موفقیت فعال شد',
                reactivated: true,
            })
        }

        // Create new subscription
        const subscriber = new Newsletter({
            email: email.toLowerCase(),
            source,
            ipAddress,
            unsubscribeToken: crypto.randomBytes(32).toString('hex'),
        })

        await subscriber.save()

        res.status(201).json({
            success: true,
            message: 'عضویت شما در خبرنامه با موفقیت انجام شد',
        })
    } catch (error) {
        console.error('Newsletter subscribe error:', error)

        // Handle duplicate key error
        if (error.code === 11000) {
            return res.json({
                success: true,
                message: 'شما قبلاً در خبرنامه عضو شده‌اید',
                alreadySubscribed: true,
            })
        }

        res.status(500).json({
            success: false,
            message: 'خطا در عضویت در خبرنامه',
        })
    }
}

/**
 * Unsubscribe from newsletter via token
 * GET /api/newsletter/unsubscribe/:token
 * Public endpoint
 */
exports.unsubscribe = async (req, res) => {
    try {
        const { token } = req.params

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'توکن نامعتبر است',
            })
        }

        const subscriber = await Newsletter.findOne({ unsubscribeToken: token })

        if (!subscriber) {
            return res.status(404).json({
                success: false,
                message: 'اشتراک یافت نشد',
            })
        }

        if (!subscriber.isActive) {
            return res.json({
                success: true,
                message: 'شما قبلاً از خبرنامه لغو اشتراک کرده‌اید',
            })
        }

        subscriber.isActive = false
        subscriber.unsubscribedAt = new Date()
        await subscriber.save()

        // Return HTML page for better UX when clicking unsubscribe link
        res.send(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>لغو اشتراک خبرنامه</title>
        <style>
          body { font-family: Tahoma, Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center; max-width: 400px; }
          .icon { font-size: 64px; margin-bottom: 20px; }
          h1 { color: #333; margin-bottom: 16px; }
          p { color: #666; line-height: 1.6; }
          .email { color: #764ba2; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✅</div>
          <h1>لغو اشتراک موفق</h1>
          <p>ایمیل <span class="email">${subscriber.email}</span> با موفقیت از خبرنامه حذف شد.</p>
          <p>اگر این کار را اشتباهی انجام دادید، می‌توانید دوباره در سایت عضو شوید.</p>
        </div>
      </body>
      </html>
    `)
    } catch (error) {
        console.error('Newsletter unsubscribe error:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در لغو اشتراک',
        })
    }
}

/**
 * Get all subscribers (Admin only)
 * GET /api/newsletter/subscribers
 */
exports.getSubscribers = async (req, res) => {
    try {
        const { page = 1, limit = 20, active } = req.query

        const filter = {}
        if (active !== undefined) {
            filter.isActive = active === 'true'
        }

        const subscribers = await Newsletter.find(filter)
            .sort({ subscribedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .select('-unsubscribeToken')

        const total = await Newsletter.countDocuments(filter)
        const activeCount = await Newsletter.countDocuments({ isActive: true })

        res.json({
            success: true,
            data: subscribers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            },
            stats: {
                total,
                active: activeCount,
                inactive: total - activeCount,
            },
        })
    } catch (error) {
        console.error('Get subscribers error:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در دریافت لیست اشتراک‌ها',
        })
    }
}

/**
 * Delete subscriber (Admin only)
 * DELETE /api/newsletter/subscribers/:id
 */
exports.deleteSubscriber = async (req, res) => {
    try {
        const { id } = req.params

        const subscriber = await Newsletter.findByIdAndDelete(id)

        if (!subscriber) {
            return res.status(404).json({
                success: false,
                message: 'اشتراک یافت نشد',
            })
        }

        res.json({
            success: true,
            message: 'اشتراک با موفقیت حذف شد',
        })
    } catch (error) {
        console.error('Delete subscriber error:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در حذف اشتراک',
        })
    }
}

/**
 * Export subscribers as CSV (Admin only)
 * GET /api/newsletter/export
 */
exports.exportSubscribers = async (req, res) => {
    try {
        const { active } = req.query

        const filter = {}
        if (active !== undefined) {
            filter.isActive = active === 'true'
        }

        const subscribers = await Newsletter.find(filter)
            .sort({ subscribedAt: -1 })
            .select('email isActive subscribedAt source')

        // Generate CSV
        const csvRows = ['email,isActive,subscribedAt,source']
        subscribers.forEach((sub) => {
            csvRows.push(`${sub.email},${sub.isActive},${sub.subscribedAt.toISOString()},${sub.source}`)
        })

        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename=newsletter-subscribers-${Date.now()}.csv`)
        res.send('\uFEFF' + csvRows.join('\n')) // BOM for Excel UTF-8 support
    } catch (error) {
        console.error('Export subscribers error:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در خروجی گرفتن',
        })
    }
}
