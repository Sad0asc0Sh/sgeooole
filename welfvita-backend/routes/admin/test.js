const express = require('express')
const router = express.Router()
const axios = require('axios')
const Settings = require('../../models/Settings')
const { sendOtpSMS, getSmsHttpsAgent } = require('../../utils/notificationService')
const { normalizeIranMobile } = require('../../utils/phone')
const { protect, authorize } = require('../../middleware/auth')

/**
 * @route   GET /api/admin/test/sms-settings
 * @desc    بررسی تنظیمات پیامک (بدون نمایش اطلاعات حساس)
 * @access  Private/Admin
 */
router.get('/sms-settings', protect, authorize('admin'), async (req, res) => {
    try {
        const settings = await Settings.findOne({ singletonKey: 'main_settings' })
            .select('+notificationSettings.smsUsername +notificationSettings.smsPassword +notificationSettings.smsSenderNumber')

        const { smsUsername, smsPassword, smsSenderNumber } = settings?.notificationSettings || {}

        res.json({
            success: true,
            settings: {
                smsUsername: smsUsername ? '✅ تنظیم شده' : '❌ خالی',
                smsPassword: smsPassword ? `✅ تنظیم شده (${smsPassword.length} کاراکتر)` : '❌ خالی',
                smsSenderNumber: smsSenderNumber || '(خالی - از username استفاده می‌شود)',
            },
            isComplete: !!(smsUsername && smsPassword),
            message: !!(smsUsername && smsPassword)
                ? 'تنظیمات کامل است'
                : 'تنظیمات ناقص است - لطفا از پنل ادمین تنظیمات را وارد کنید',
        })
    } catch (error) {
        console.error('[TEST API] خطا در بررسی تنظیمات:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در بررسی تنظیمات',
            error: error.message,
        })
    }
})

/**
 * @route   POST /api/admin/test/send-sms
 * @desc    تست ارسال پیامک
 * @access  Private/Admin
 */
router.post('/send-sms', protect, authorize('admin'), async (req, res) => {
    try {
        const mobile = normalizeIranMobile(req.body.mobile)

        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: 'شماره موبایل معتبر نیست (فرمت صحیح: 09xxxxxxxxx)',
            })
        }

        console.log(`[TEST API] درخواست ارسال پیامک تست به ${mobile}`)

        // تولید کد تست
        const testCode = Math.floor(100000 + Math.random() * 900000).toString()

        // ارسال پیامک
        const result = await sendOtpSMS(mobile, testCode)

        res.json({
            success: true,
            message: `پیامک تست با موفقیت به ${mobile} ارسال شد`,
            code: testCode,
            details: result.data,
        })
    } catch (error) {
        console.error('[TEST API] خطا در ارسال پیامک:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در ارسال پیامک',
            error: error.message,
            code: error.code,
            details: error.details,
        })
    }
})

/**
 * @route   GET /api/admin/test/health
 * @desc    بررسی وضعیت سلامت سیستم
 * @access  Private/Admin
 */
router.get('/health', protect, authorize('admin'), async (req, res) => {
    try {
        const settings = await Settings.findOne({ singletonKey: 'main_settings' })
            .select('+notificationSettings.smsUsername +notificationSettings.smsPassword')

        const { smsUsername, smsPassword } = settings?.notificationSettings || {}

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            database: 'connected',
            sms: {
                configured: !!(smsUsername && smsPassword),
                provider: 'ملی‌پیامک (Melipayamak)',
            },
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        })
    }
})

/**
 * @route   GET /api/admin/test/outbound-ip
 * @desc    نمایش IP خروجی سرور (برای بررسی محدودیت IP در سرویس پیامک)
 * @access  Private/Admin
 */
router.get('/outbound-ip', protect, authorize('admin'), async (req, res) => {
    try {
        const startedAt = Date.now()
        const response = await axios.get('https://api.ipify.org?format=json', { timeout: 7000 })

        res.json({
            success: true,
            ip: response.data?.ip,
            ms: Date.now() - startedAt,
            note: 'در Render/Railway ممکن است IP ثابت نباشد (Dynamic Egress)',
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'خطا در دریافت IP خروجی سرور',
            error: error.message,
        })
    }
})

/**
 * @route   GET /api/admin/test/sms-ping
 * @desc    تست دسترسی شبکه به دامنه‌های ملی‌پیامک (برای عیب‌یابی timeout)
 * @access  Private/Admin
 */
router.get('/sms-ping', protect, authorize('admin'), async (req, res) => {
    const ping = async (url) => {
        const startedAt = Date.now()
        try {
            const r = await axios.get(url, {
                timeout: 7000,
                validateStatus: () => true,
                httpsAgent: getSmsHttpsAgent(),
                proxy: false,
            })
            return { url, ok: true, status: r.status, ms: Date.now() - startedAt }
        } catch (e) {
            return { url, ok: false, error: e.code || e.message, ms: Date.now() - startedAt }
        }
    }

    try {
        const [rest, consoleHost] = await Promise.all([
            ping('https://rest.payamak-panel.com'),
            ping('https://console.melipayamak.com'),
        ])

        res.json({
            success: true,
            usingProxy: Boolean(process.env.SMS_PROXY),
            rest,
            console: consoleHost,
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'خطا در تست شبکه پیامک',
            error: error.message,
        })
    }
})

module.exports = router
