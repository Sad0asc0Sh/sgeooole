/**
 * 🛣️ Routes برای بخش پرفروش‌ترین‌ها
 */

const express = require('express')
const router = express.Router()
const bestsellersController = require('../controllers/bestsellersController')
const { authenticateToken } = require('../middleware/auth')
const { isAdmin } = require('../middleware/admin')

// ============================================
// Public Routes
// ============================================

// دریافت لیست پرفروش‌ترین‌ها
// GET /api/v1/products/bestsellers?limit=8&category=&in_stock=true
router.get('/bestsellers', bestsellersController.getBestsellers)

// ثبت بازدید محصول
// POST /api/v1/tracking/impression
router.post('/tracking/impression', bestsellersController.trackImpression)

// ============================================
// Admin Routes
// ============================================

// آمار بخش پرفروش‌ترین‌ها
// GET /api/v1/bestsellers/stats
router.get('/bestsellers/stats', authenticateToken, isAdmin, bestsellersController.getBestsellerStats)

// بروزرسانی دستی امتیازات
// POST /api/v1/bestsellers/recalculate
router.post('/bestsellers/recalculate', authenticateToken, isAdmin, bestsellersController.recalculateScores)

// ثبت رویداد فروش (از خدمات داخلی)
// POST /api/v1/internal/sales-event
router.post('/internal/sales-event', bestsellersController.recordSaleEvent) // بعداً میانگین داخلی اضافه شود

module.exports = router
