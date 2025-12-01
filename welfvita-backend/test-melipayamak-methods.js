const mongoose = require('mongoose')
const axios = require('axios')
const Settings = require('./models/Settings')
require('dotenv').config()

// Connect to DB
const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/welfvita'
        const conn = await mongoose.connect(uri)
        console.log(`MongoDB Connected: ${conn.connection.host}`)
    } catch (error) {
        console.error(`Error: ${error.message}`)
        process.exit(1)
    }
}

const testAllMethods = async () => {
    await connectDB()

    try {
        console.log('\n=== بررسی تنظیمات ===')
        const settings = await Settings.findOne({ singletonKey: 'main_settings' }).select('+notificationSettings.smsApiKey')

        if (!settings) {
            console.error('❌ تنظیمات یافت نشد!')
            process.exit(1)
        }

        const { smsApiKey, smsSenderNumber } = settings.notificationSettings || {}

        console.log('📱 شماره فرستنده:', smsSenderNumber || '(تنظیم نشده)')
        console.log('🔑 API Key:', smsApiKey ? `${smsApiKey.substring(0, 10)}...` : '(تنظیم نشده)')

        if (!smsApiKey) {
            console.error('❌ API Key یافت نشد!')
            process.exit(1)
        }

        const testMobile = '09123456789' // شماره تست - با شماره واقعی خودتان عوض کنید

        console.log('\n=== روش 1️⃣: POST با Token در URL (روش فعلی) ===')
        try {
            const payload1 = {
                from: smsSenderNumber,
                to: testMobile,
                text: 'تست 1: Token در URL'
            }
            console.log('📤 Endpoint:', `https://console.melipayamak.com/api/send/simple/${smsApiKey}`)
            console.log('📤 Payload:', payload1)

            const res1 = await axios.post(
                `https://console.melipayamak.com/api/send/simple/${smsApiKey}`,
                payload1,
                { timeout: 10000 }
            )
            console.log('✅ موفق:', res1.data)
        } catch (error) {
            console.log('❌ خطا:', error.response?.status, error.response?.data || error.message)
        }

        console.log('\n=== روش 2️⃣: POST با Authorization Header ===')
        try {
            const payload2 = {
                from: smsSenderNumber,
                to: testMobile,
                text: 'تست 2: Authorization Header'
            }
            console.log('📤 Endpoint:', 'https://console.melipayamak.com/api/send/simple')
            console.log('📤 Headers:', { Authorization: `Bearer ${smsApiKey.substring(0, 10)}...` })
            console.log('📤 Payload:', payload2)

            const res2 = await axios.post(
                'https://console.melipayamak.com/api/send/simple',
                payload2,
                {
                    headers: { 'Authorization': `Bearer ${smsApiKey}` },
                    timeout: 10000
                }
            )
            console.log('✅ موفق:', res2.data)
        } catch (error) {
            console.log('❌ خطا:', error.response?.status, error.response?.data || error.message)
        }

        console.log('\n=== روش 3️⃣: POST با x-api-key Header ===')
        try {
            const payload3 = {
                from: smsSenderNumber,
                to: testMobile,
                text: 'تست 3: x-api-key Header'
            }
            console.log('📤 Endpoint:', 'https://console.melipayamak.com/api/send/simple')
            console.log('📤 Headers:', { 'x-api-key': `${smsApiKey.substring(0, 10)}...` })
            console.log('📤 Payload:', payload3)

            const res3 = await axios.post(
                'https://console.melipayamak.com/api/send/simple',
                payload3,
                {
                    headers: { 'x-api-key': smsApiKey },
                    timeout: 10000
                }
            )
            console.log('✅ موفق:', res3.data)
        } catch (error) {
            console.log('❌ خطا:', error.response?.status, error.response?.data || error.message)
        }

        console.log('\n=== روش 4️⃣: GET با پارامترها (روش قدیمی) ===')
        try {
            const params = {
                token: smsApiKey,
                from: smsSenderNumber,
                to: testMobile,
                text: 'تست 4: GET Method'
            }
            console.log('📤 Endpoint:', 'https://console.melipayamak.com/api/send/simple')
            console.log('📤 Params:', params)

            const res4 = await axios.get(
                'https://console.melipayamak.com/api/send/simple',
                { params, timeout: 10000 }
            )
            console.log('✅ موفق:', res4.data)
        } catch (error) {
            console.log('❌ خطا:', error.response?.status, error.response?.data || error.message)
        }

        console.log('\n=== روش 5️⃣: POST با bodyText (فرمت متن) ===')
        try {
            const bodyText = {
                from: smsSenderNumber,
                to: testMobile,
                bodyId: null,
                text: 'تست 5: bodyText format'
            }
            console.log('📤 Endpoint:', `https://console.melipayamak.com/api/send/simple/${smsApiKey}`)
            console.log('📤 Payload:', bodyText)

            const res5 = await axios.post(
                `https://console.melipayamak.com/api/send/simple/${smsApiKey}`,
                bodyText,
                { timeout: 10000 }
            )
            console.log('✅ موفق:', res5.data)
        } catch (error) {
            console.log('❌ خطا:', error.response?.status, error.response?.data || error.message)
        }

        console.log('\n=== بررسی اعتبار (Check Credit) ===')
        try {
            console.log('📤 Endpoint:', `https://console.melipayamak.com/api/receive/credit/${smsApiKey}`)

            const creditRes = await axios.get(
                `https://console.melipayamak.com/api/receive/credit/${smsApiKey}`,
                { timeout: 10000 }
            )
            console.log('✅ اعتبار:', creditRes.data)
        } catch (error) {
            console.log('❌ خطا:', error.response?.status, error.response?.data || error.message)
        }

        console.log('\n=== نتیجه‌گیری ===')
        console.log('اگر هیچ‌کدام از روش‌های بالا کار نکرد، لطفاً:')
        console.log('1. از پنل ملی‌پیامک، بخش API/مستندات را بررسی کنید')
        console.log('2. مطمئن شوید که از کلید "Console API" استفاده می‌کنید نه "SOAP API"')
        console.log('3. بررسی کنید که حساب شما فعال و دارای اعتبار است')
        console.log('4. با پشتیبانی ملی‌پیامک تماس بگیرید: 02191004346')

    } catch (error) {
        console.error('خطای غیرمنتظره:', error)
    } finally {
        await mongoose.connection.close()
        process.exit()
    }
}

testAllMethods()
