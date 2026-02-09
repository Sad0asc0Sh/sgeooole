const mongoose = require('mongoose')

/**
 * مدل برای ردیابی بازدید دسته‌بندی‌ها
 * این مدل برای جمع‌آوری داده‌های محبوبیت دسته‌بندی‌ها استفاده می‌شود
 */
const categoryViewSchema = new mongoose.Schema(
    {
        // شناسه دسته‌بندی
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            required: true,
            index: true,
        },
        // شناسه کاربر (اختیاری - برای کاربران لاگین شده)
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        // Session ID برای کاربران مهمان
        sessionId: {
            type: String,
            default: null,
        },
        // IP کاربر برای فیلتر کردن بازدیدهای تکراری
        ipAddress: {
            type: String,
            default: null,
        },
        // نوع بازدید: view (مشاهده دسته) یا click (کلیک روی دسته)
        viewType: {
            type: String,
            enum: ['view', 'click'],
            default: 'view',
        },
        // منبع بازدید: homepage, search, menu, etc.
        source: {
            type: String,
            enum: ['homepage', 'search', 'menu', 'sidebar', 'footer', 'related', 'other'],
            default: 'other',
        },
        // User Agent برای آنالیز دستگاه‌ها
        userAgent: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        // Index ترکیبی برای کوئری‌های سریع
    }
)

// Index برای کوئری‌های تحلیلی
categoryViewSchema.index({ category: 1, createdAt: -1 })
categoryViewSchema.index({ createdAt: -1 })
categoryViewSchema.index({ user: 1, category: 1, createdAt: -1 })

// متد استاتیک برای دریافت دسته‌بندی‌های محبوب
categoryViewSchema.statics.getPopularCategories = async function (options = {}) {
    const {
        limit = 10,
        periodDays = 30,
        minViews = 5,
    } = options

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)

    const pipeline = [
        {
            $match: {
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: '$category',
                viewCount: { $sum: 1 },
                uniqueUsers: { $addToSet: { $ifNull: ['$user', '$sessionId'] } },
                lastViewed: { $max: '$createdAt' }
            }
        },
        {
            $addFields: {
                uniqueViewCount: { $size: '$uniqueUsers' }
            }
        },
        {
            $match: {
                viewCount: { $gte: minViews }
            }
        },
        {
            $sort: { viewCount: -1 }
        },
        {
            $limit: limit
        },
        {
            $lookup: {
                from: 'categories',
                localField: '_id',
                foreignField: '_id',
                as: 'categoryDetails'
            }
        },
        {
            $unwind: '$categoryDetails'
        },
        {
            $match: {
                'categoryDetails.isActive': true
            }
        },
        {
            $project: {
                _id: '$categoryDetails._id',
                name: '$categoryDetails.name',
                slug: '$categoryDetails.slug',
                image: '$categoryDetails.image',
                icon: '$categoryDetails.icon',
                viewCount: 1,
                uniqueViewCount: 1,
                lastViewed: 1
            }
        }
    ]

    return this.aggregate(pipeline)
}

// متد استاتیک برای دریافت آمار کلی
categoryViewSchema.statics.getStats = async function (periodDays = 30) {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfPeriod = new Date()
    startOfPeriod.setDate(startOfPeriod.getDate() - periodDays)

    const [totalViews, todayViews, periodViews, uniqueCategories] = await Promise.all([
        this.countDocuments(),
        this.countDocuments({ createdAt: { $gte: startOfToday } }),
        this.countDocuments({ createdAt: { $gte: startOfPeriod } }),
        this.distinct('category', { createdAt: { $gte: startOfPeriod } })
    ])

    return {
        totalViews,
        todayViews,
        periodViews,
        uniqueCategoriesViewed: uniqueCategories.length,
        periodDays
    }
}

module.exports = mongoose.model('CategoryView', categoryViewSchema)
