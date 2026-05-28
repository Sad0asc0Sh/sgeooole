/**
 * 🔐 Admin Setup Routes
 * 
 * مسیرهای راه‌اندازی اولیه ادمین سیستم
 * 
 * @module routes/adminSetup
 */

const express = require('express')
const router = express.Router()
const rateLimit = require('express-rate-limit')
const { getClientIp } = require('../utils/clientIp')
const {
    getSetupStatus,
    setupInitialAdmin,
    setUserRole,
} = require('../controllers/adminSetupController')

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ SECURITY: Rate Limiting for Setup Endpoint
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rate Limiter سختگیرانه برای endpoint setup
 * فقط 3 تلاش در ساعت مجاز است
 */
const setupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ساعت
    max: 3, // حداکثر 3 درخواست
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً بعداً تلاش کنید.',
        retryAfter: '1 ساعت'
    },
    keyGenerator: (req) => getClientIp(req),
})

/**
 * Rate Limiter برای endpoint status
 * 10 درخواست در دقیقه
 */
const statusLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 دقیقه
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req),
    message: {
        success: false,
        message: 'لطفاً کمی صبر کنید'
    }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 📍 ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/admin/setup/status
 * @desc    بررسی وضعیت Setup سیستم
 * @access  Public
 */
router.get('/status', statusLimiter, getSetupStatus)

/**
 * @route   POST /api/admin/setup
 * @desc    ایجاد ادمین اولیه - فقط یک بار قابل استفاده
 * @access  Public (with Setup Key)
 * 
 * @body    {string} email - ایمیل ادمین (اختیاری)
 * @body    {string} password - پسورد ادمین (اختیاری - تولید خودکار)
 * @body    {string} name - نام ادمین (اختیاری)
 * @body    {string} setupKey - کلید امنیتی (از .env)
 * 
 * @example
 * curl -X POST http://localhost:5000/api/admin/setup \
 *   -H "Content-Type: application/json" \
 *   -d '{"setupKey": "your-secret-key", "email": "admin@example.com"}'
 */
router.post('/', setupLimiter, setupInitialAdmin)

/**
 * @route   POST /api/admin/setup/set-role
 * @desc    تغییر نقش یک کاربر با استفاده از Setup Key
 * @access  Protected by setupKey
 *
 * @example
 * curl -X POST http://YOUR_SERVER_IP:5000/api/admin/setup/set-role \
 *   -H "Content-Type: application/json" \
 *   -d '{"setupKey": "YOUR_SETUP_KEY", "email": "user@example.com", "role": "superadmin"}'
 */
router.post('/set-role', setupLimiter, setUserRole)

module.exports = router
