const CategoryView = require('../models/CategoryView')
const Category = require('../models/Category')
const Settings = require('../models/Settings')

/**
 * ثبت بازدید دسته‌بندی
 * POST /api/category-views/track
 */
exports.trackCategoryView = async (req, res) => {
    try {
        // بررسی تنظیمات ردیابی
        const settings = await Settings.findOne({ singletonKey: 'main_settings' }).lean()
        const trackingEnabled = settings?.popularCategoriesSettings?.trackingEnabled !== false

        if (!trackingEnabled) {
            return res.json({
                success: true,
                message: 'ردیابی غیرفعال است',
                tracked: false
            })
        }

        const { categoryId, source = 'other', viewType = 'view' } = req.body

        if (!categoryId) {
            return res.status(400).json({
                success: false,
                message: 'شناسه دسته‌بندی الزامی است'
            })
        }

        // بررسی وجود دسته‌بندی
        const categoryExists = await Category.exists({ _id: categoryId, isActive: true })
        if (!categoryExists) {
            return res.status(404).json({
                success: false,
                message: 'دسته‌بندی یافت نشد'
            })
        }

        // Get user info
        const userId = req.user?._id || null
        const sessionId = req.headers['x-session-id'] || req.sessionID || null
        const ipAddress = req.ip || req.connection?.remoteAddress || null
        const userAgent = req.headers['user-agent'] || null

        // جلوگیری از ثبت بازدیدهای تکراری (در 5 دقیقه اخیر)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        const recentView = await CategoryView.findOne({
            category: categoryId,
            $or: [
                { user: userId },
                { sessionId: sessionId },
                { ipAddress: ipAddress }
            ].filter(c => Object.values(c)[0] !== null),
            createdAt: { $gte: fiveMinutesAgo }
        })

        if (recentView) {
            return res.json({
                success: true,
                message: 'بازدید قبلاً ثبت شده است',
                tracked: false,
                duplicate: true
            })
        }

        // ثبت بازدید جدید
        await CategoryView.create({
            category: categoryId,
            user: userId,
            sessionId,
            ipAddress,
            viewType,
            source,
            userAgent
        })

        res.json({
            success: true,
            message: 'بازدید ثبت شد',
            tracked: true
        })
    } catch (error) {
        console.error('Error tracking category view:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در ثبت بازدید',
            error: error.message
        })
    }
}

/**
 * دریافت دسته‌بندی‌های محبوب
 * GET /api/category-views/popular
 */
exports.getPopularByViews = async (req, res) => {
    try {
        const settings = await Settings.findOne({ singletonKey: 'main_settings' }).lean()
        const config = settings?.popularCategoriesSettings || {}

        const displayEnabled = config.displayEnabled === true
        const useFallback = config.useFallback !== false
        const displayLimit = config.displayLimit || 8
        const periodDays = config.periodDays || 30
        const minViews = config.minViews || 5
        const minTotalViewsForActivation = config.minTotalViewsForActivation || 100

        // دریافت آمار کل
        const stats = await CategoryView.getStats(periodDays)
        const hasEnoughData = stats.totalViews >= minTotalViewsForActivation

        // اگر نمایش فعال نیست یا داده کافی نیست
        if (!displayEnabled || !hasEnoughData) {
            if (useFallback) {
                // استفاده از دسته‌بندی‌های دستی isPopular
                const fallbackCategories = await Category.find({ isActive: true, isPopular: true })
                    .sort({ order: 1, name: 1 })
                    .limit(displayLimit)
                    .select('name slug image icon description')
                    .lean()

                return res.json({
                    success: true,
                    data: fallbackCategories,
                    source: 'manual',
                    stats: {
                        hasEnoughData,
                        totalViews: stats.totalViews,
                        requiredViews: minTotalViewsForActivation,
                        progress: Math.min(100, Math.round((stats.totalViews / minTotalViewsForActivation) * 100))
                    }
                })
            }

            return res.json({
                success: true,
                data: [],
                source: 'none',
                message: 'داده کافی برای نمایش دسته‌بندی‌های محبوب وجود ندارد',
                stats: {
                    hasEnoughData,
                    totalViews: stats.totalViews,
                    requiredViews: minTotalViewsForActivation,
                    progress: Math.min(100, Math.round((stats.totalViews / minTotalViewsForActivation) * 100))
                }
            })
        }

        // دریافت دسته‌بندی‌های محبوب از آمار واقعی
        const popularCategories = await CategoryView.getPopularCategories({
            limit: displayLimit,
            periodDays,
            minViews
        })

        res.json({
            success: true,
            data: popularCategories,
            source: 'analytics',
            stats: {
                hasEnoughData: true,
                totalViews: stats.totalViews,
                periodViews: stats.periodViews,
                uniqueCategoriesViewed: stats.uniqueCategoriesViewed
            }
        })
    } catch (error) {
        console.error('Error fetching popular categories:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در دریافت دسته‌بندی‌های محبوب',
            error: error.message
        })
    }
}

/**
 * دریافت آمار بازدید دسته‌بندی‌ها (فقط ادمین)
 * GET /api/category-views/stats
 */
exports.getViewStats = async (req, res) => {
    try {
        const periodDays = parseInt(req.query.periodDays) || 30
        const settings = await Settings.findOne({ singletonKey: 'main_settings' }).lean()
        const config = settings?.popularCategoriesSettings || {}

        // آمار کلی
        const stats = await CategoryView.getStats(periodDays)

        // ده دسته‌بندی برتر
        const topCategories = await CategoryView.getPopularCategories({
            limit: 10,
            periodDays,
            minViews: 1
        })

        // آمار روزانه 7 روز اخیر
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const dailyStats = await CategoryView.aggregate([
            {
                $match: {
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    },
                    views: { $sum: 1 },
                    uniqueCategories: { $addToSet: '$category' }
                }
            },
            {
                $addFields: {
                    uniqueCategoriesCount: { $size: '$uniqueCategories' }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: '$_id',
                    views: 1,
                    uniqueCategoriesCount: 1
                }
            },
            {
                $sort: { date: 1 }
            }
        ])

        res.json({
            success: true,
            data: {
                overall: stats,
                topCategories,
                dailyStats,
                config: {
                    trackingEnabled: config.trackingEnabled !== false,
                    displayEnabled: config.displayEnabled === true,
                    displayLimit: config.displayLimit || 8,
                    periodDays: config.periodDays || 30,
                    minViews: config.minViews || 5,
                    minTotalViewsForActivation: config.minTotalViewsForActivation || 100,
                    useFallback: config.useFallback !== false
                },
                readyForActivation: stats.totalViews >= (config.minTotalViewsForActivation || 100)
            }
        })
    } catch (error) {
        console.error('Error fetching category view stats:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در دریافت آمار',
            error: error.message
        })
    }
}

/**
 * پاکسازی داده‌های قدیمی (فقط ادمین)
 * DELETE /api/category-views/cleanup
 */
exports.cleanupOldViews = async (req, res) => {
    try {
        const keepDays = parseInt(req.query.keepDays) || 90
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - keepDays)

        const result = await CategoryView.deleteMany({
            createdAt: { $lt: cutoffDate }
        })

        res.json({
            success: true,
            message: `${result.deletedCount} بازدید قدیمی‌تر از ${keepDays} روز حذف شد`,
            deletedCount: result.deletedCount
        })
    } catch (error) {
        console.error('Error cleaning up old views:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در پاکسازی داده‌ها',
            error: error.message
        })
    }
}
