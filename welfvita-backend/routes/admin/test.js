const express = require('express')
const router = express.Router()
const Settings = require('../models/Settings')
const { sendOtpSMS } = require('../utils/notificationService')
const { protect, authorize } = require('../middleware/auth')

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
        const { mobile } = req.body

        if (!mobile || mobile.length !== 11) {
            return res.status(400).json({
                success: false,
                message: 'شماره موبایل معتبر نیست (باید 11 رقم باشد)',
            })
        }

        console.log(`[TEST API] درخواست ارسال پیامک تست به ${mobile}`)

        // تولید کد تست
        const testCode = Math.floor(100000 + Math.random() * 900000).toString()

        // ارسال پیامک
        const result = await sendOtpSMS(mobile, testCode)

        if (result.success) {
            res.json({
                success: true,
                message: `پیامک تست با موفقیت به ${mobile} ارسال شد`,
                code: testCode,
                details: result.data,
            })
        } else {
            res.status(500).json({
                success: false,
                message: 'خطا در ارسال پیامک',
                error: result.message,
                details: result.data,
            })
        }
    } catch (error) {
        console.error('[TEST API] خطا در ارسال پیامک:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در ارسال پیامک',
            error: error.message,
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

module.exports = router
