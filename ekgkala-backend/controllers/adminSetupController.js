/**
 * 🔐 Admin Setup Controller
 * 
 * کنترلر ایجاد ادمین اولیه سیستم
 * این endpoint فقط یک بار قابل استفاده است
 * 
 * @module controllers/adminSetupController
 */

const crypto = require('crypto')
const Admin = require('../models/Admin')
const Settings = require('../models/Settings')
const { logSecurityEvent, SECURITY_EVENTS } = require('../utils/auditLogger')

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 SECURITY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * تولید پسورد امن با کاراکترهای تصادفی رمزنگاری شده
 * @param {number} length - طول پسورد (پیش‌فرض: 16)
 * @returns {string} پسورد امن تصادفی
 */
const generateSecurePassword = (length = 16) => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'

    const allChars = uppercase + lowercase + numbers + symbols

    // اطمینان از وجود حداقل یک کاراکتر از هر نوع
    let password = ''
    password += uppercase[crypto.randomInt(uppercase.length)]
    password += lowercase[crypto.randomInt(lowercase.length)]
    password += numbers[crypto.randomInt(numbers.length)]
    password += symbols[crypto.randomInt(symbols.length)]

    // پر کردن بقیه پسورد با کاراکترهای تصادفی
    for (let i = password.length; i < length; i++) {
        password += allChars[crypto.randomInt(allChars.length)]
    }

    // شافل کردن پسورد برای پخش یکنواخت کاراکترها
    return password.split('').sort(() => crypto.randomInt(3) - 1).join('')
}

/**
 * اعتبارسنجی قوت پسورد
 * @param {string} password - پسورد برای بررسی
 * @returns {{valid: boolean, errors: string[]}}
 */
const validatePasswordStrength = (password) => {
    const errors = []

    if (!password || password.length < 12) {
        errors.push('پسورد باید حداقل ۱۲ کاراکتر باشد')
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('پسورد باید شامل حداقل یک حرف بزرگ انگلیسی باشد')
    }
    if (!/[a-z]/.test(password)) {
        errors.push('پسورد باید شامل حداقل یک حرف کوچک انگلیسی باشد')
    }
    if (!/[0-9]/.test(password)) {
        errors.push('پسورد باید شامل حداقل یک عدد باشد')
    }
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
        errors.push('پسورد باید شامل حداقل یک کاراکتر خاص باشد')
    }

    return {
        valid: errors.length === 0,
        errors
    }
}

/**
 * دریافت IP واقعی درخواست
 * @param {Request} req 
 * @returns {string}
 */
const getRealIP = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        'unknown'
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 CONTROLLER METHODS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * بررسی وضعیت Setup سیستم
 * GET /api/admin/setup/status
 * 
 * @desc بررسی می‌کند که آیا Setup قبلاً انجام شده یا خیر
 * @access Public (ولی فقط اطلاعات محدود برمی‌گرداند)
 */
const getSetupStatus = async (req, res) => {
    try {
        // بررسی وجود ادمین
        const adminCount = await Admin.countDocuments({
            role: { $in: ['admin', 'superadmin'] }
        })

        // دریافت تنظیمات
        let settings = await Settings.findOne({ singletonKey: 'main_settings' })

        const setupCompleted = settings?.systemSetup?.isCompleted || adminCount > 0

        res.json({
            success: true,
            data: {
                setupCompleted,
                adminExists: adminCount > 0,
                // فقط در صورت عدم تکمیل Setup، جزئیات بیشتر نمایش داده نمی‌شود
                message: setupCompleted
                    ? 'سیستم قبلاً راه‌اندازی شده است'
                    : 'سیستم نیاز به راه‌اندازی اولیه دارد'
            }
        })
    } catch (error) {
        console.error('❌ Error checking setup status:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در بررسی وضعیت سیستم'
        })
    }
}

/**
 * ایجاد ادمین اولیه سیستم
 * POST /api/admin/setup
 * 
 * @desc ایجاد اولین ادمین سیستم - فقط یک بار قابل استفاده
 * @access Public (ولی فقط اگر Setup قبلاً انجام نشده باشد)
 * 
 * @body {string} email - ایمیل ادمین (اختیاری - از .env خوانده می‌شود)
 * @body {string} password - پسورد ادمین (اختیاری - تولید خودکار)
 * @body {string} name - نام ادمین (اختیاری)
 * @body {string} setupKey - کلید امنیتی Setup (از .env)
 */
const setupInitialAdmin = async (req, res) => {
    const clientIP = getRealIP(req)

    try {
        // ═══════════════════════════════════════════════════════════════════════
        // 1. بررسی Setup Key (کلید امنیتی از .env)
        // ═══════════════════════════════════════════════════════════════════════
        const requiredSetupKey = process.env.ADMIN_SETUP_KEY
        const providedSetupKey = req.body.setupKey || req.headers['x-setup-key']

        if (requiredSetupKey && providedSetupKey !== requiredSetupKey) {
            // Log security event
            try {
                await logSecurityEvent({
                    action: SECURITY_EVENTS.ACCESS_DENIED,
                    entity: 'AdminSetup',
                    userId: null,
                    req,
                    details: {
                        reason: 'admin_setup_invalid_key',
                        email: req.body.email || 'unknown',
                        providedKey: providedSetupKey ? '[REDACTED]' : 'none'
                    },
                    status: 'failed'
                })
            } catch (logError) {
                console.error('Failed to log security event:', logError)
            }

            return res.status(403).json({
                success: false,
                message: 'کلید امنیتی Setup نامعتبر است'
            })
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 2. بررسی اینکه Setup قبلاً انجام نشده باشد
        // ═══════════════════════════════════════════════════════════════════════
        let settings = await Settings.findOne({ singletonKey: 'main_settings' })

        // ایجاد Settings اگر وجود نداشت
        if (!settings) {
            settings = await Settings.create({ singletonKey: 'main_settings' })
        }

        // بررسی flag در Settings
        if (settings.systemSetup?.isCompleted) {
            return res.status(400).json({
                success: false,
                message: 'Setup سیستم قبلاً انجام شده است. این endpoint غیرفعال است.',
                completedAt: settings.systemSetup.completedAt
            })
        }

        // بررسی وجود ادمین
        const existingAdmin = await Admin.findOne({
            role: { $in: ['admin', 'superadmin'] }
        })

        if (existingAdmin) {
            // اگر ادمین وجود داشت ولی flag تنظیم نشده، آن را تنظیم کن
            await Settings.findOneAndUpdate(
                { singletonKey: 'main_settings' },
                {
                    $set: {
                        'systemSetup.isCompleted': true,
                        'systemSetup.completedAt': new Date(),
                        'systemSetup.completedByIP': 'legacy',
                        'systemSetup.adminId': existingAdmin._id
                    }
                }
            )

            return res.status(400).json({
                success: false,
                message: 'ادمین قبلاً در سیستم وجود دارد. این endpoint غیرفعال شد.'
            })
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 3. استخراج و اعتبارسنجی پارامترها
        // ═══════════════════════════════════════════════════════════════════════
        const {
            email = process.env.ADMIN_EMAIL || 'admin@ekgkala.com',
            name = process.env.ADMIN_NAME || 'مدیر سیستم'
        } = req.body

        // پسورد: اول از body، بعد از env، در نهایت تولید خودکار
        let password = req.body.password || process.env.ADMIN_PASSWORD
        let isAutoGenerated = false

        if (!password) {
            password = generateSecurePassword(16)
            isAutoGenerated = true
        } else {
            // اعتبارسنجی پسورد ارائه شده
            const validation = validatePasswordStrength(password)
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: 'پسورد به اندازه کافی قوی نیست',
                    errors: validation.errors
                })
            }
        }

        // اعتبارسنجی ایمیل
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'فرمت ایمیل نامعتبر است'
            })
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 4. ایجاد ادمین
        // ═══════════════════════════════════════════════════════════════════════
        const admin = await Admin.create({
            name,
            email,
            password,
            role: 'superadmin',
            isActive: true
        })

        // ═══════════════════════════════════════════════════════════════════════
        // 5. غیرفعال کردن endpoint با تنظیم flag
        // ═══════════════════════════════════════════════════════════════════════
        await Settings.findOneAndUpdate(
            { singletonKey: 'main_settings' },
            {
                $set: {
                    'systemSetup.isCompleted': true,
                    'systemSetup.completedAt': new Date(),
                    'systemSetup.completedByIP': clientIP,
                    'systemSetup.adminId': admin._id
                }
            }
        )

        // ═══════════════════════════════════════════════════════════════════════
        // 6. ثبت در Audit Log
        // ═══════════════════════════════════════════════════════════════════════
        try {
            await logSecurityEvent({
                action: SECURITY_EVENTS.ADMIN_CREATED,
                entity: 'Admin',
                entityId: admin._id,
                userId: admin._id,
                req,
                details: {
                    reason: 'initial_admin_setup',
                    role: 'superadmin',
                    email: admin.email,
                    passwordAutoGenerated: isAutoGenerated
                },
                status: 'success'
            })
        } catch (logError) {
            console.error('Failed to log security event:', logError)
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 7. پاسخ به کلاینت
        // ═══════════════════════════════════════════════════════════════════════
        console.log('╔════════════════════════════════════════════════════════╗')
        console.log('║  ✅ ادمین اولیه سیستم با موفقیت ایجاد شد              ║')
        console.log('╚════════════════════════════════════════════════════════╝')
        console.log(`📧 Email: ${email}`)
        console.log(`🔑 Password: ${isAutoGenerated ? '[AUTO-GENERATED - SEE RESPONSE]' : '[USER-PROVIDED]'}`)
        console.log(`🌐 IP: ${clientIP}`)
        console.log('')

        // ساخت پاسخ
        const response = {
            success: true,
            message: 'ادمین اولیه با موفقیت ایجاد شد',
            data: {
                admin: {
                    id: admin._id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role
                },
                // فقط اگر پسورد تولید خودکار شده، آن را برگردان
                ...(isAutoGenerated && {
                    generatedPassword: password,
                    warning: '⚠️ این پسورد فقط یک بار نمایش داده می‌شود. آن را در جای امنی ذخیره کنید.'
                }),
                setupInfo: {
                    completedAt: new Date().toISOString(),
                    endpointDisabled: true,
                    message: 'این endpoint غیرفعال شد و دیگر قابل استفاده نیست'
                }
            }
        }

        // نکات امنیتی
        response.securityTips = [
            'پسورد را بعد از اولین ورود تغییر دهید',
            'از احراز هویت دو مرحله‌ای (2FA) استفاده کنید',
            'ایمیل بازیابی را تنظیم کنید',
            'دسترسی‌های ادمین را محدود کنید'
        ]

        res.status(201).json(response)

    } catch (error) {
        console.error('❌ Error in admin setup:', error)

        // اگر خطای تکراری بودن ایمیل باشد
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'این ایمیل قبلاً ثبت شده است'
            })
        }

        res.status(500).json({
            success: false,
            message: 'خطا در ایجاد ادمین اولیه',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}

module.exports = {
    getSetupStatus,
    setupInitialAdmin
}
