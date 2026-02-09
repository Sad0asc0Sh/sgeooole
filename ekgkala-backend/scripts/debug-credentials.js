const mongoose = require('mongoose')
const axios = require('axios')
const Settings = require('./models/Settings')
require('dotenv').config()

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'
        await mongoose.connect(uri)
        console.log('✅ MongoDB متصل شد\n')
    } catch (error) {
        console.error('❌ خطا:', error.message)
        process.exit(1)
    }
}

const debugCredentials = async () => {
    await connectDB()

    try {
        console.log('='.repeat(70))
        console.log('🔍 دیباگ کامل اطلاعات ملی‌پیامک')
        console.log('='.repeat(70))

        const settings = await Settings.findOne({ singletonKey: 'main_settings' })
            .select('+notificationSettings.smsUsername +notificationSettings.smsPassword')

        if (!settings) {
            console.error('\n❌ تنظیمات یافت نشد!')
            process.exit(1)
        }

        const { smsUsername, smsPassword, smsSenderNumber } = settings.notificationSettings || {}

        console.log('\n📋 اطلاعات ذخیره شده در دیتابیس:')
        console.log('─'.repeat(70))
        console.log(`نام کاربری (username):`)
        console.log(`  - مقدار کامل: "${smsUsername}"`)
        console.log(`  - طول: ${smsUsername?.length || 0} کاراکتر`)
        console.log(`  - نوع داده: ${typeof smsUsername}`)
        console.log(`  - فضای خالی در ابتدا/انتها: ${smsUsername !== smsUsername?.trim() ? 'دارد ❌' : 'ندارد ✅'}`)

        console.log(`\nرمز عبور (password):`)
        console.log(`  - مقدار: ${'*'.repeat(smsPassword?.length || 0)}`)
        console.log(`  - طول: ${smsPassword?.length || 0} کاراکتر`)
        console.log(`  - نوع داده: ${typeof smsPassword}`)
        console.log(`  - فضای خالی در ابتدا/انتها: ${smsPassword !== smsPassword?.trim() ? 'دارد ❌' : 'ندارد ✅'}`)

        console.log(`\nشماره فرستنده:`)
        console.log(`  - مقدار: "${smsSenderNumber}"`)
        console.log(`  - طول: ${smsSenderNumber?.length || 0} کاراکتر`)

        console.log('\n' + '='.repeat(70))
        console.log('🧪 تست‌های مختلف ارسال پیامک')
        console.log('='.repeat(70))

        const testMobile = '09123456789'

        // تست 1: با اطلاعات فعلی
        console.log('\n📌 تست 1: با اطلاعات فعلی (بدون تغییر)')
        await testSMS({
            username: smsUsername,
            password: smsPassword,
            from: smsSenderNumber,
            to: testMobile,
            text: 'تست 1'
        })

        // تست 2: با trim کردن
        console.log('\n📌 تست 2: با حذف فضاهای خالی (trim)')
        await testSMS({
            username: smsUsername?.trim(),
            password: smsPassword?.trim(),
            from: smsSenderNumber?.trim(),
            to: testMobile,
            text: 'تست 2'
        })

        // تست 3: بدون شماره فرستنده
        console.log('\n📌 تست 3: بدون فیلد "from"')
        await testSMS({
            username: smsUsername?.trim(),
            password: smsPassword?.trim(),
            to: testMobile,
            text: 'تست 3'
        })

        // تست 4: با فرمت ساده
        console.log('\n📌 تست 4: با پیام ساده بدون لاین جدید')
        await testSMS({
            username: smsUsername?.trim(),
            password: smsPassword?.trim(),
            from: smsSenderNumber?.trim(),
            to: testMobile,
            text: 'test simple message',
            isflash: false
        })

        console.log('\n' + '='.repeat(70))
        console.log('📝 توصیه‌های نهایی:')
        console.log('='.repeat(70))
        console.log('1. مطمئن شوید نام کاربری دقیقاً همان است که در پنل وارد می‌کنید')
        console.log('2. رمز عبور را دوباره چک کنید (حروف بزرگ/کوچک مهم است)')
        console.log('3. اگر همه تست‌ها خطا داد:')
        console.log('   → به پنل ملی‌پیامک بروید')
        console.log('   → رمز عبور را تغییر دهید (reset password)')
        console.log('   → رمز جدید را در پنل ادمین وارد کنید')
        console.log('4. پشتیبانی ملی‌پیامک: 02191004346')
        console.log('='.repeat(70))

    } catch (error) {
        console.error('\n❌ خطا:', error)
    } finally {
        await mongoose.connection.close()
        process.exit()
    }
}

async function testSMS(payload) {
    try {
        console.log('📤 Payload:', JSON.stringify(payload, null, 2))

        const response = await axios.post(
            'https://rest.payamak-panel.com/api/SendSMS/SendSMS',
            payload,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        )

        console.log('✅ موفق!', response.data)

        if (response.data.RetStatus === 1) {
            console.log('🎉🎉🎉 پیامک ارسال شد! این روش کار می‌کند! 🎉🎉🎉')
        } else {
            console.log(`❌ خطا: ${response.data.StrRetStatus} (کد: ${response.data.RetStatus})`)
        }
    } catch (error) {
        const errorData = error.response?.data || error.message
        console.log('❌ خطا:', errorData)
    }
}

debugCredentials()
