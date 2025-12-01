const mongoose = require('mongoose')
const axios = require('axios')
const Settings = require('./models/Settings')
require('dotenv').config()

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/welfvita'
        const conn = await mongoose.connect(uri)
        console.log(`✅ MongoDB متصل شد`)
    } catch (error) {
        console.error(`❌ خطا: ${error.message}`)
        process.exit(1)
    }
}

const testFinalSMS = async () => {
    await connectDB()

    try {
        console.log('\n' + '='.repeat(60))
        console.log('📱 تست نهایی ارسال پیامک با سیستم جدید')
        console.log('='.repeat(60))

        // دریافت تنظیمات از دیتابیس
        const settings = await Settings.findOne({ singletonKey: 'main_settings' })
            .select('+notificationSettings.smsUsername +notificationSettings.smsPassword')

        if (!settings) {
            console.error('\n❌ تنظیمات در دیتابیس یافت نشد!')
            console.log('\n💡 راه حل: به پنل ادمین بروید و تنظیمات را ذخیره کنید.')
            process.exit(1)
        }

        const { smsUsername, smsPassword, smsSenderNumber } = settings.notificationSettings || {}

        console.log('\n📋 اطلاعات فعلی:')
        console.log('   نام کاربری:', smsUsername ? `${smsUsername.substring(0, 5)}...` : '❌ تنظیم نشده')
        console.log('   رمز عبور:', smsPassword ? '****' : '❌ تنظیم نشده')
        console.log('   شماره فرستنده:', smsSenderNumber || '(خالی)')

        if (!smsUsername || !smsPassword) {
            console.log('\n❌ نام کاربری یا رمز عبور تنظیم نشده است!')
            console.log('\n📝 مراحل لازم:')
            console.log('1. به پنل ادمین بروید: http://localhost:5173')
            console.log('2. تنظیمات → تنظیمات اعلان‌ها')
            console.log('3. نام کاربری و رمز عبور پنل ملی‌پیامک خود را وارد کنید')
            console.log('4. ذخیره تغییرات را بزنید')
            console.log('5. دوباره این اسکریپت را اجرا کنید')
            process.exit(1)
        }

        // تست ارسال پیامک
        const testMobile = '09123456789' // شماره تست - با شماره واقعی خود عوض کنید
        const testCode = '1234'

        console.log('\n📤 ارسال پیامک تست...')
        console.log(`   به شماره: ${testMobile}`)
        console.log(`   کد تست: ${testCode}`)

        const payload = {
            username: smsUsername,
            password: smsPassword,
            to: testMobile,
            from: smsSenderNumber || smsUsername,
            text: `کد تایید شما: ${testCode}\nویلف ویتا - تست نهایی\nلغو11`,
            isflash: false
        }

        console.log('\n🔄 درخواست به سرور ملی‌پیامک...')

        const response = await axios.post(
            'https://rest.payamak-panel.com/api/SendSMS/SendSMS',
            payload,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            }
        )

        console.log('\n📥 پاسخ سرور:')
        console.log('   RetStatus:', response.data.RetStatus)
        console.log('   StrRetStatus:', response.data.StrRetStatus)
        console.log('   Value:', response.data.Value)

        if (response.data.RetStatus === 1) {
            console.log('\n✅ ✅ ✅ موفقیت! پیامک ارسال شد! ✅ ✅ ✅')
            console.log('\n📱 پیامک باید به شماره ' + testMobile + ' رسیده باشد.')
            console.log('   محتوای پیامک: کد تایید شما: ' + testCode)
            console.log('\n🎉 سیستم ارسال پیامک به درستی کار می‌کند!')
        } else {
            console.log('\n❌ خطا در ارسال پیامک!')
            console.log('\n🔍 کدهای خطا رایج:')
            console.log('   - 35 (InvalidData): نام کاربری یا رمز عبور اشتباه است')
            console.log('   - 6 (NoCredit): اعتبار حساب تمام شده')
            console.log('   - 11 (InvalidSender): شماره فرستنده نامعتبر است')
            console.log('\n💡 راه حل:')
            console.log('   1. بررسی کنید نام کاربری و رمز عبور پنل صحیح باشد')
            console.log('   2. وارد پنل ملی‌پیامک شوید و اعتبار حساب را چک کنید')
            console.log('   3. شماره فرستنده را از پنل کپی کنید')
        }

    } catch (error) {
        console.log('\n❌ خطای شبکه یا اتصال!')
        console.log('   پیام خطا:', error.message)
        if (error.response?.data) {
            console.log('   جزئیات:', error.response.data)
        }
        console.log('\n💡 بررسی کنید:')
        console.log('   - اتصال اینترنت برقرار است؟')
        console.log('   - سرور ملی‌پیامک در دسترس است؟')
        console.log('   - نام کاربری و رمز عبور صحیح است؟')
    } finally {
        await mongoose.connection.close()
        console.log('\n' + '='.repeat(60))
        process.exit()
    }
}

testFinalSMS()
