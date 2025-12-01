const mongoose = require('mongoose')
const axios = require('axios')
const Settings = require('./models/Settings')
require('dotenv').config()

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/welfvita'
        await mongoose.connect(uri)
        console.log('✅ MongoDB متصل شد\n')
    } catch (error) {
        console.error('❌ خطا:', error.message)
        process.exit(1)
    }
}

const testAllAPIs = async () => {
    await connectDB()

    try {
        const settings = await Settings.findOne({ singletonKey: 'main_settings' })
            .select('+notificationSettings.smsUsername +notificationSettings.smsPassword +notificationSettings.smsApiKey')

        const { smsUsername, smsPassword, smsApiKey, smsSenderNumber } = settings?.notificationSettings || {}

        console.log('='.repeat(80))
        console.log('🔍 تست تمام روش‌های ارسال پیامک ملی‌پیامک')
        console.log('='.repeat(80))
        console.log('\n📋 اطلاعات موجود:')
        console.log(`   Username: ${smsUsername}`)
        console.log(`   Password: ${'*'.repeat(smsPassword?.length || 0)}`)
        console.log(`   API Key: ${smsApiKey ? smsApiKey.substring(0, 10) + '...' : 'ندارد'}`)
        console.log(`   Sender: ${smsSenderNumber}`)

        const testMobile = '09123456789' // شماره تست
        const testText = 'تست ملی پیامک'

        console.log('\n' + '='.repeat(80))

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // روش 1: REST API با Username/Password
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log('\n🔹 روش 1️⃣: REST API با Username/Password')
        console.log('   Endpoint: https://rest.payamak-panel.com/api/SendSMS/SendSMS')
        try {
            const res = await axios.post('https://rest.payamak-panel.com/api/SendSMS/SendSMS', {
                username: smsUsername,
                password: smsPassword,
                to: testMobile,
                from: smsSenderNumber,
                text: testText,
                isflash: false
            }, { timeout: 10000 })

            if (res.data.RetStatus === 1) {
                console.log('   ✅✅✅ موفقیت! این روش کار می‌کند! ✅✅✅')
                console.log('   پاسخ:', res.data)
                return
            } else {
                console.log(`   ❌ خطا: ${res.data.StrRetStatus} (کد ${res.data.RetStatus})`)
            }
        } catch (err) {
            console.log('   ❌ خطا:', err.response?.data || err.message)
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // روش 2: Console API با Token
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (smsApiKey) {
            console.log('\n🔹 روش 2️⃣: Console API با Token در URL')
            console.log(`   Endpoint: https://console.melipayamak.com/api/send/simple/${smsApiKey}`)
            try {
                const res = await axios.post(`https://console.melipayamak.com/api/send/simple/${smsApiKey}`, {
                    from: smsSenderNumber,
                    to: testMobile,
                    text: testText
                }, { timeout: 10000 })

                console.log('   ✅✅✅ موفقیت! این روش کار می‌کند! ✅✅✅')
                console.log('   پاسخ:', res.data)
                return
            } catch (err) {
                console.log('   ❌ خطا:', err.response?.data || err.message)
            }
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // روش 3: SOAP-like REST API
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log('\n🔹 روش 3️⃣: REST API (SOAP Style)')
        console.log('   Endpoint: https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber')
        try {
            const res = await axios.post('https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber', {
                username: smsUsername,
                password: smsPassword,
                text: testText,
                to: testMobile,
                bodyId: 0
            }, { timeout: 10000 })

            if (res.data.RetStatus === 1 || res.data > 0) {
                console.log('   ✅✅✅ موفقیت! این روش کار می‌کند! ✅✅✅')
                console.log('   پاسخ:', res.data)
                return
            } else {
                console.log('   ❌ خطا:', res.data)
            }
        } catch (err) {
            console.log('   ❌ خطا:', err.response?.data || err.message)
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // روش 4: HTTP GET Method
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log('\n🔹 روش 4️⃣: HTTP GET Method')
        console.log('   Endpoint: https://rest.payamak-panel.com/api/SendSMS/SendSMS')
        try {
            const res = await axios.get('https://rest.payamak-panel.com/api/SendSMS/SendSMS', {
                params: {
                    username: smsUsername,
                    password: smsPassword,
                    to: testMobile,
                    from: smsSenderNumber,
                    text: testText,
                    isflash: false
                },
                timeout: 10000
            })

            if (res.data.RetStatus === 1 || res.data > 0) {
                console.log('   ✅✅✅ موفقیت! این روش کار می‌کند! ✅✅✅')
                console.log('   پاسخ:', res.data)
                return
            } else {
                console.log('   ❌ خطا:', res.data)
            }
        } catch (err) {
            console.log('   ❌ خطا:', err.response?.data || err.message)
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // روش 5: با bodyId (پیامک پیش‌ساخته)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log('\n🔹 روش 5️⃣: SendByBaseNumber (خط خدماتی)')
        console.log('   Endpoint: https://rest.payamak-panel.com/api/SendSMS/SendByBaseNumber')
        try {
            const res = await axios.post('https://rest.payamak-panel.com/api/SendSMS/SendByBaseNumber', {
                username: smsUsername,
                password: smsPassword,
                text: testText,
                to: testMobile,
                bodyId: 0
            }, { timeout: 10000 })

            if (res.data > 1000) {
                console.log('   ✅✅✅ موفقیت! این روش کار می‌کند! ✅✅✅')
                console.log('   پاسخ (Message ID):', res.data)
                return
            } else {
                console.log('   ❌ خطا:', res.data)
            }
        } catch (err) {
            console.log('   ❌ خطا:', err.response?.data || err.message)
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // نتیجه‌گیری
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log('\n' + '='.repeat(80))
        console.log('❌ هیچ‌کدام از روش‌ها کار نکرد!')
        console.log('='.repeat(80))
        console.log('\n📞 راه‌حل‌های پیشنهادی:')
        console.log('   1️⃣  با پشتیبانی ملی‌پیامک تماس بگیرید: 02191004346')
        console.log('   2️⃣  بپرسید کدام API باید استفاده شود: REST یا SOAP؟')
        console.log('   3️⃣  بررسی کنید آیا REST API در پنل شما فعال است؟')
        console.log('   4️⃣  بپرسید آیا نیاز به Web Service Username جداگانه است؟')
        console.log('   5️⃣  مستندات پنل خودتان را در بخش API چک کنید')
        console.log('\n💡 نکته: ممکن است username/password پنل ≠ username/password وب‌سرویس')
        console.log('='.repeat(80))

    } catch (error) {
        console.error('\n❌ خطا:', error)
    } finally {
        await mongoose.connection.close()
        process.exit()
    }
}

testAllAPIs()
