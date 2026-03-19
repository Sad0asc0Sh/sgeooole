const mongoose = require('mongoose')
const readline = require('readline')
const Settings = require('../models/Settings')
require('dotenv').config()

// رنگ‌ها
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
}

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
    title: (msg) => console.log(`\n${colors.magenta}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}`),
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
})

const question = (prompt) => {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer)
        })
    })
}

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'
        log.info('در حال اتصال به دیتابیس...')
        await mongoose.connect(uri)
        log.success('دیتابیس متصل شد')
        return true
    } catch (error) {
        console.error('خطا در اتصال:', error.message)
        return false
    }
}

const setSMSSettings = async () => {
    log.title('⚙️  تنظیم اطلاعات پیامک در دیتابیس')

    const connected = await connectDB()
    if (!connected) {
        log.warning('نمی‌توانید از اینجا تنظیمات را ذخیره کنید.')
        log.warning('لطفا از طریق پنل ادمین این کار را انجام دهید.')
        rl.close()
        process.exit(1)
    }

    try {
        console.log('\nلطفا اطلاعات پنل ملی‌پیامک خود را وارد کنید:\n')

        const smsUsername = await question('👤 نام کاربری پنل ملی‌پیامک: ')
        const smsPassword = await question('🔑 رمز عبور پنل ملی‌پیامک: ')
        const smsSenderNumber = await question('📱 شماره فرستنده (اختیاری، Enter برای خالی): ')

        if (!smsUsername || !smsPassword) {
            console.error('❌ نام کاربری و رمز عبور الزامی است!')
            rl.close()
            process.exit(1)
        }

        log.info('\nدر حال ذخیره تنظیمات...')

        // پیدا کردن یا ایجاد تنظیمات
        let settings = await Settings.findOne({ singletonKey: 'main_settings' })

        if (!settings) {
            settings = new Settings({ singletonKey: 'main_settings' })
        }

        // به‌روزرسانی تنظیمات پیامک
        settings.notificationSettings = {
            ...settings.notificationSettings,
            smsUsername: smsUsername.trim(),
            smsPassword: smsPassword.trim(),
            smsSenderNumber: smsSenderNumber.trim() || '',
        }

        await settings.save()

        log.title('✅ تنظیمات با موفقیت ذخیره شد!')

        log.info('اطلاعات ذخیره شده:')
        console.log(`  • نام کاربری: ${smsUsername}`)
        console.log(`  • رمز عبور: ${'*'.repeat(smsPassword.length)}`)
        console.log(`  • شماره فرستنده: ${smsSenderNumber || '(خالی - از نام کاربری استفاده می‌شود)'}`)

        log.success('\n🎉 حالا سیستم پیامک شما آماده است!')
        log.info('\nنکته: این تنظیمات در دیتابیس ذخیره شده و برای production هم کار می‌کند.')

    } catch (error) {
        console.error('❌ خطا:', error.message)
    } finally {
        await mongoose.connection.close()
        rl.close()
    }
}

setSMSSettings()
