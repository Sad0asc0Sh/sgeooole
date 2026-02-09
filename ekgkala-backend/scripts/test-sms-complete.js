const mongoose = require('mongoose')
const axios = require('axios')
const Settings = require('../models/Settings')
require('dotenv').config()

// رنگ‌ها برای خروجی
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
}

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️ ${msg}${colors.reset}`),
    title: (msg) => console.log(`\n${colors.magenta}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}`),
}

// Connect to DB
const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'
        log.info(`در حال اتصال به دیتابیس...`)
        const conn = await mongoose.connect(uri)
        log.success(`دیتابیس متصل شد: ${conn.connection.host}`)
        return true
    } catch (error) {
        log.error(`خطا در اتصال به دیتابیس: ${error.message}`)
        return false
    }
}

// Test SMS Functionality
const testSMS = async () => {
    log.title('🔍 تست سیستم ارسال پیامک ای‌کا‌جی کالا')

    // اتصال به دیتابیس
    const connected = await connectDB()
    if (!connected) {
        process.exit(1)
    }

    try {
        // ========================================
        // مرحله 1: بررسی تنظیمات دیتابیس
        // ========================================
        log.title('مرحله 1️⃣: بررسی تنظیمات در دیتابیس')
        
        const settings = await Settings.findOne({ singletonKey: 'main_settings' })
            .select('+notificationSettings.smsUsername +notificationSettings.smsPassword +notificationSettings.smsApiKey +notificationSettings.smsSenderNumber')

        if (!settings) {
            log.error('هیچ تنظیماتی در دیتابیس یافت نشد!')
            log.warning('لطفا ابتدا از پنل ادمین تنظیمات پیامک را وارد کنید.')
            process.exit(1)
        }

        const {
            smsUsername,
            smsPassword,
            smsApiKey,
            smsSenderNumber,
        } = settings.notificationSettings || {}

        log.info(`شماره فرستنده: ${smsSenderNumber || '❌ تنظیم نشده'}`)
        log.info(`نام کاربری (Username): ${smsUsername ? '✅ موجود' : '❌ تنظیم نشده'}`)
        log.info(`رمز عبور (Password): ${smsPassword ? '✅ موجود' : '❌ تنظیم نشده'}`)
        log.info(`کلید API (ApiKey): ${smsApiKey ? '✅ موجود' : '❌ تنظیم نشده'}`)

        // ========================================
        // مرحله 2: شناسایی روش مناسب ارسال
        // ========================================
        log.title('مرحله 2️⃣: شناسایی روش ارسال')

        let useUsernamePassword = false
        let useApiKey = false

        if (smsUsername && smsPassword) {
            log.success('روش 1: Username/Password موجود است (REST API)')
            useUsernamePassword = true
        }

        if (smsApiKey) {
            log.success('روش 2: API Key موجود است (Console API)')
            useApiKey = true
        }

        if (!useUsernamePassword && !useApiKey) {
            log.error('هیچ روشی برای ارسال پیامک تنظیم نشده است!')
            log.warning('\nبرای رفع مشکل:')
            log.warning('1. وارد پنل ادمین شوید')
            log.warning('2. به بخش تنظیمات > اعلان‌ها بروید')
            log.warning('3. اطلاعات پنل ملی‌پیامک را وارد کنید')
            process.exit(1)
        }

        // ========================================
        // مرحله 3: تست ارسال پیامک
        // ========================================
        log.title('مرحله 3️⃣: تست ارسال پیامک')

        // دریافت شماره تست
        const testMobile = process.argv[2] || '09123456789'
        log.warning(`شماره تست: ${testMobile}`)
        log.warning('برای تغییر شماره، اسکریپت را با شماره دلخواه اجرا کنید:')
        log.warning(`node scripts/test-sms-complete.js 09xxxxxxxxx\n`)

        const testCode = Math.floor(100000 + Math.random() * 900000).toString()
        const testMessage = `کد تایید شما: ${testCode}\nای‌کا‌جی کالا\nلغو11`

        let successCount = 0
        let failCount = 0

        // ========================================
        // روش 1: REST API با Username/Password
        // ========================================
        if (useUsernamePassword) {
            log.info('\n📤 تست روش 1: REST API (Username/Password)...')
            
            try {
                const response = await axios.post(
                    'https://rest.payamak-panel.com/api/SendSMS/SendSMS',
                    {
                        username: smsUsername,
                        password: smsPassword,
                        to: testMobile,
                        from: smsSenderNumber || smsUsername,
                        text: testMessage,
                        isflash: false,
                    },
                    {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 15000,
                    }
                )

                log.info('پاسخ سرور:')
                log.info(JSON.stringify(response.data, null, 2))

                if (response.data.RetStatus === 1) {
                    log.success('روش 1: پیامک با موفقیت ارسال شد! ✅')
                    successCount++
                } else {
                    log.error(`روش 1: خطا - ${response.data.StrRetStatus}`)
                    log.error(`کد خطا: ${response.data.RetStatus}`)
                    failCount++
                }
            } catch (error) {
                log.error(`روش 1: خطای شبکه - ${error.message}`)
                if (error.response?.data) {
                    log.error('جزئیات خطا:')
                    log.error(JSON.stringify(error.response.data, null, 2))
                }
                failCount++
            }
        }

        // ========================================
        // روش 2: Console API با API Key
        // ========================================
        if (useApiKey) {
            log.info('\n📤 تست روش 2: Console API (API Key)...')
            
            const methods = [
                {
                    name: 'Header Auth',
                    config: {
                        url: 'https://console.melipayamak.com/api/send/simple',
                        method: 'POST',
                        headers: { Authorization: smsApiKey },
                        data: {
                            from: smsSenderNumber || '',
                            to: testMobile,
                            text: testMessage,
                        },
                    },
                },
                {
                    name: 'URL Auth',
                    config: {
                        url: `https://console.melipayamak.com/api/send/simple/${smsApiKey}`,
                        method: 'POST',
                        data: {
                            from: smsSenderNumber || '',
                            to: testMobile,
                            text: testMessage,
                        },
                    },
                },
            ]

            for (const method of methods) {
                log.info(`\n  → تست ${method.name}...`)
                try {
                    const response = await axios(method.config)
                    log.success(`${method.name}: موفق! ✅`)
                    log.info('پاسخ:')
                    log.info(JSON.stringify(response.data, null, 2))
                    successCount++
                } catch (error) {
                    log.error(`${method.name}: خطا`)
                    if (error.response?.data) {
                        log.error(JSON.stringify(error.response.data, null, 2))
                    } else {
                        log.error(error.message)
                    }
                    failCount++
                }
            }
        }

        // ========================================
        // نتیجه نهایی
        // ========================================
        log.title('📊 نتیجه نهایی')
        
        log.info(`موفق: ${successCount}`)
        log.info(`ناموفق: ${failCount}`)

        if (successCount > 0) {
            log.success('\n🎉 حداقل یک روش ارسال کار می‌کند!')
            log.success(`پیامک تست باید به شماره ${testMobile} ارسال شده باشد.`)
            log.success(`محتوای پیامک: ${testMessage}`)
        } else {
            log.error('\n❌ هیچ روشی کار نکرد!')
            log.warning('\n🔧 راهنمای رفع مشکل:')
            log.warning('1. به پنل ملی‌پیامک بروید: https://panel.payamak-panel.com')
            log.warning('2. اطلاعات نام کاربری و رمز عبور را مجددا چک کنید')
            log.warning('3. از بخش "وب‌سرویس" اطلاعات API را کپی کنید')
            log.warning('4. مطمئن شوید که حساب شما اعتبار کافی دارد')
            log.warning('5. شماره فرستنده را از قسمت "خطوط من" بردارید')
            log.warning('\n📞 پشتیبانی ملی‌پیامک: 02191004346')
        }

    } catch (error) {
        log.error(`خطای غیرمنتظره: ${error.message}`)
        console.error(error)
    } finally {
        await mongoose.connection.close()
        log.info('\nاتصال به دیتابیس بسته شد.')
        process.exit()
    }
}

// اجرای تست
testSMS()
