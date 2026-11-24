const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const axios = require('axios')
const rateLimit = require('express-rate-limit')
const Settings = require('../../models/Settings')
const { sendOtpSMS } = require('../../utils/notificationService')
const { normalizeIranMobile } = require('../../utils/phone')
const { protect, checkPermission, PERMISSIONS } = require('../../middleware/auth')
const { getClientIp } = require('../../utils/clientIp')
const dnsAgent = require('../../utils/dnsAgent')

const adminTestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req),
    message: { success: false, message: 'تعداد درخواست‌های تست بیش از حد مجاز است.' },
})

/**
 * @route   GET /api/admin/test/sms-settings
 * @desc    بررسی تنظیمات پیامک (بدون نمایش اطلاعات حساس)
 * @access  Private/Admin (SETTINGS_UPDATE)
 */
router.get('/sms-settings', protect, checkPermission(PERMISSIONS.SETTINGS_UPDATE), async (req, res) => {
    try {
        const settings = await Settings.findOne({ singletonKey: 'main_settings' })
            .select('+notificationSettings.smsUsername +notificationSettings.smsPassword +notificationSettings.smsSenderNumber')

        const { smsUsername, smsPassword, smsSenderNumber } = settings?.notificationSettings || {}

        res.json({
            success: true,
            settings: {
                smsUsername: smsUsername ? '✅ تنظیم شده' : '❌ خالی',
                smsPassword: smsPassword ? '✅ تنظیم شده' : '❌ خالی',
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
        })
    }
})

/**
 * @route   POST /api/admin/test/send-sms
 * @desc    تست ارسال پیامک (بدون بازگرداندن کد OTP در پاسخ)
 * @access  Private/Admin (SETTINGS_UPDATE)
 */
router.post('/send-sms', protect, checkPermission(PERMISSIONS.SETTINGS_UPDATE), adminTestLimiter, async (req, res) => {
    try {
        const mobile = normalizeIranMobile(req.body.mobile)

        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: 'شماره موبایل معتبر نیست (فرمت صحیح: 09xxxxxxxxx)',
            })
        }

        // تولید کد تست رمزنگاری‌شده (بدون لاگ/افشای کد)
        const testCode = String(crypto.randomInt(100000, 1000000))

        // ارسال پیامک
        const result = await sendOtpSMS(mobile, testCode)

        res.json({
            success: true,
            message: `پیامک تست با موفقیت ارسال شد`,
            details: { provider: result.provider, status: result.status, recId: result.recId },
        })
    } catch (error) {
        console.error('[TEST API] خطا در ارسال پیامک:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در ارسال پیامک',
        })
    }
})

/**
 * @route   GET /api/admin/test/health
 * @desc    بررسی وضعیت سلامت سیستم
 * @access  Private/Admin (SETTINGS_UPDATE)
 */
router.get('/health', protect, checkPermission(PERMISSIONS.SETTINGS_UPDATE), async (req, res) => {
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
            message: 'خطا در بررسی وضعیت سلامت سیستم',
        })
    }
})

/**
 * @route   GET /api/admin/test/sms-ping
 * @desc    تست دسترسی شبکه به دامنه‌های ملی‌پیامک (برای عیب‌یابی timeout)
 * @access  Private/Admin (SETTINGS_UPDATE)
 */
router.get('/sms-ping', protect, checkPermission(PERMISSIONS.SETTINGS_UPDATE), adminTestLimiter, async (req, res) => {
    const ping = async (url) => {
        const startedAt = Date.now()
        try {
            const r = await axios.get(url, {
                timeout: 7000,
                validateStatus: () => true,
                httpsAgent: dnsAgent,
                proxy: false,
            })
            return { url, ok: true, status: r.status, ms: Date.now() - startedAt }
        } catch (e) {
            return { url, ok: false, error: e.code || 'NETWORK_ERROR', ms: Date.now() - startedAt }
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
        })
    }
})

module.exports = router
