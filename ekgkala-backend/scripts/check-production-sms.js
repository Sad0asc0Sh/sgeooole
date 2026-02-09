const mongoose = require('mongoose')
const Settings = require('../models/Settings')
require('dotenv').config()

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
}

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
    title: (msg) => console.log(`\n${colors.magenta}${'='.repeat(70)}\n${msg}\n${'='.repeat(70)}${colors.reset}`),
}

const checkProductionSMS = async () => {
    log.title('🔍 بررسی تنظیمات پیامک در Production')

    try {
        // اتصال به دیتابیس
        log.info('در حال اتصال به دیتابیس Production...')
        const uri = process.env.MONGODB_URI

        if (!uri) {
            log.error('متغیر MONGODB_URI تنظیم نشده است!')
            log.warning('لطفا فایل .env را بررسی کنید.')
            process.exit(1)
        }

        log.info(`دیتابیس: ${uri.split('@')[1]?.split('/')[0] || 'نامشخص'}`)

        await mongoose.connect(uri)
        log.success('اتصال به دیتابیس موفق بود!')

        // بررسی وجود تنظیمات
        log.title('مرحله 1️⃣: بررسی وجود تنظیمات در دیتابیس')

        const settings = await Settings.findOne({ singletonKey: 'main_settings' })

        if (!settings) {
            log.error('هیچ تنظیماتی در دیتابیس پیدا نشد!')
            log.warning('\n🔧 راه حل:')
            log.warning('1. وارد پنل ادمین شوید: https://ekgkala.ir/admin')
            log.warning('2. به بخش تنظیمات بروید و اطلاعات را ذخیره کنید')
            await mongoose.connection.close()
            process.exit(1)
        }

        log.success('تنظیمات اصلی یافت شد!')

        // بررسی تنظیمات پیامک
        log.title('مرحله 2️⃣: بررسی تنظیمات پیامک')

        const settingsWithSMS = await Settings.findOne({ singletonKey: 'main_settings' })
            .select('+notificationSettings.smsUsername +notificationSettings.smsPassword +notificationSettings.smsSenderNumber')

        const { smsUsername, smsPassword, smsSenderNumber } = settingsWithSMS?.notificationSettings || {}

        console.log('\nوضعیت تنظیمات پیامک:')
        console.log('─'.repeat(70))

        if (smsUsername) {
            log.success(`نام کاربری (smsUsername): ${smsUsername}`)
        } else {
            log.error('نام کاربری (smsUsername): ❌ تنظیم نشده')
        }

        if (smsPassword) {
            log.success(`رمز عبور (smsPassword): ${'*'.repeat(smsPassword.length)} (${smsPassword.length} کاراکتر)`)
        } else {
            log.error('رمز عبور (smsPassword): ❌ تنظیم نشده')
        }

        if (smsSenderNumber) {
            log.success(`شماره فرستنده: ${smsSenderNumber}`)
        } else {
            log.warning(`شماره فرستنده: خالی (از نام کاربری استفاده می‌شود: ${smsUsername || 'N/A'})`)
        }

        console.log('─'.repeat(70))

        // نتیجه‌گیری
        log.title('📊 نتیجه')

        if (!smsUsername || !smsPassword) {
            log.error('تنظیمات پیامک ناقص است!')
            log.warning('\n🔧 برای رفع مشکل:')
            log.warning('1. به سایت بروید: https://ekgkala.ir/admin')
            log.warning('2. لاگین کنید')
            log.warning('3. بروید به: تنظیمات → اعلان‌ها')
            log.warning('4. اطلاعات پنل ملی‌پیامک را وارد کنید:')
            log.warning('   • نام کاربری پنل')
            log.warning('   • رمز عبور پنل')
            log.warning('   • شماره فرستنده (اختیاری)')
            log.warning('5. دکمه ذخیره را بزنید')
            log.warning('\n📌 نکته: این تنظیمات باید در دیتابیس Production ذخیره شود')
        } else {
            log.success('✅ تنظیمات پیامک کامل است!')
            log.info('\nاگر باز هم پیامک ارسال نمی‌شود، مشکل از:')
            log.info('  1. اعتبار حساب ملی‌پیامک')
            log.info('  2. محدودیت IP در پنل ملی‌پیامک')
            log.info('  3. خطا در کد Backend')
            log.info('\n💡 لاگ‌های Railway را بررسی کنید:')
            log.info('   https://railway.app → پروژه خود → Logs')
        }

        // بررسی سایر تنظیمات
        log.title('مرحله 3️⃣: سایر تنظیمات مهم')

        console.log(`\nنام فروشگاه: ${settings.storeName || '(خالی)'}`)
        console.log(`ایمیل فروشگاه: ${settings.storeEmail || '(خالی)'}`)
        console.log(`تلفن فروشگاه: ${settings.storePhone || '(خالی)'}`)

        // بررسی Setup
        if (settings.systemSetup?.isCompleted) {
            log.success(`\nSetup اولیه: انجام شده در ${settings.systemSetup.completedAt || 'نامشخص'}`)
        } else {
            log.warning('\nSetup اولیه: انجام نشده')
        }

    } catch (error) {
        log.error(`خطا: ${error.message}`)

        if (error.message.includes('Atlas')) {
            log.warning('\n🔧 مشکل اتصال به MongoDB Atlas:')
            log.warning('1. IP سرور Railway در whitelist اضافه شده؟')
            log.warning('2. آدرس MONGODB_URI در Railway درست است؟')
            log.warning('3. رمز عبور دیتابیس صحیح است؟')
        }

        console.error('\nجزئیات کامل خطا:')
        console.error(error)
    } finally {
        await mongoose.connection.close()
        log.info('\nاتصال به دیتابیس بسته شد.')
    }
}

checkProductionSMS()
