const mongoose = require('mongoose')
const axios = require('axios')
const Settings = require('./models/Settings')
require('dotenv').config()

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'
        const conn = await mongoose.connect(uri)
        console.log(`MongoDB Connected`)
    } catch (error) {
        console.error(`Error: ${error.message}`)
        process.exit(1)
    }
}

const testAlternativeEndpoints = async () => {
    await connectDB()

    try {
        const settings = await Settings.findOne({ singletonKey: 'main_settings' }).select('+notificationSettings.smsApiKey')
        const { smsApiKey, smsSenderNumber } = settings.notificationSettings || {}

        console.log('🔑 API Key:', smsApiKey ? `${smsApiKey.substring(0, 15)}...` : 'نامشخص')
        console.log('📱 شماره فرستنده:', smsSenderNumber || 'نامشخص')
        console.log('')

        const testMobile = '09123456789' // شماره تست خود را اینجا بگذارید

        // لیست endpoint های مختلف ملی‌پیامک
        const endpoints = [
            {
                name: 'Console API v1',
                url: `https://console.melipayamak.com/api/send/simple/${smsApiKey}`,
                method: 'POST',
                data: { from: smsSenderNumber, to: testMobile, text: 'تست 1' }
            },
            {
                name: 'Rest API Panel',
                url: `https://rest.payamak-panel.com/api/SendSMS/SendSMS`,
                method: 'POST',
                data: {
                    username: smsSenderNumber, // یا username پنل
                    password: smsApiKey, // یا password پنل
                    to: testMobile,
                    from: smsSenderNumber,
                    text: 'تست 2',
                    isflash: false
                }
            },
            {
                name: 'Rest API (New)',
                url: 'https://rest.ippanel.com/v1/messages',
                method: 'POST',
                headers: { 'Authorization': `AccessKey ${smsApiKey}` },
                data: {
                    originator: smsSenderNumber,
                    recipients: [testMobile],
                    message: 'تست 3'
                }
            },
            {
                name: 'SMS.ir Style',
                url: 'https://console.melipayamak.com/api/send',
                method: 'POST',
                headers: { 'x-api-key': smsApiKey },
                data: {
                    lineNumber: smsSenderNumber,
                    messageText: 'تست 4',
                    mobiles: [testMobile]
                }
            },
            {
                name: 'GET Method with Token',
                url: `https://console.melipayamak.com/api/send/simple`,
                method: 'GET',
                params: {
                    token: smsApiKey,
                    from: smsSenderNumber,
                    to: testMobile,
                    text: 'تست 5'
                }
            }
        ]

        for (const endpoint of endpoints) {
            console.log(`\n=== تست: ${endpoint.name} ===`)
            console.log(`📍 URL: ${endpoint.url}`)

            try {
                let response
                const config = {
                    timeout: 10000,
                    headers: endpoint.headers || {}
                }

                if (endpoint.method === 'POST') {
                    console.log(`📤 Data:`, endpoint.data)
                    response = await axios.post(endpoint.url, endpoint.data, config)
                } else if (endpoint.method === 'GET') {
                    console.log(`📤 Params:`, endpoint.params)
                    response = await axios.get(endpoint.url, { ...config, params: endpoint.params })
                }

                console.log('✅ موفقیت!', response.data)
                console.log('🎉 این روش کار می‌کند!')
                break
            } catch (error) {
                const status = error.response?.status || 'N/A'
                const errorData = error.response?.data || error.message
                console.log(`❌ خطا (${status}):`, errorData)
            }
        }

        console.log('\n' + '='.repeat(60))
        console.log('📋 راهنمای دریافت اطلاعات صحیح از پنل ملی‌پیامک:')
        console.log('='.repeat(60))
        console.log('1. وارد پنل شوید: https://console.melipayamak.com')
        console.log('2. از منوی بالا، روی "API" کلیک کنید')
        console.log('3. گزینه "توکن کنسول" یا "Console Token" را انتخاب کنید')
        console.log('4. اگر توکن ندارید، "ایجاد توکن جدید" را بزنید')
        console.log('5. توکن را کامل کپی کنید (36 کاراکتر UUID)')
        console.log('')
        console.log('⚠️  نکات مهم:')
        console.log('   - توکن کنسول ≠ رمز عبور پنل')
        console.log('   - توکن REST API ≠ توکن SOAP')
        console.log('   - شماره فرستنده باید از پنل شما باشد')
        console.log('')
        console.log('📞 پشتیبانی ملی‌پیامک: 02191004346')
        console.log('='.repeat(60))

    } catch (error) {
        console.error('خطای کلی:', error)
    } finally {
        await mongoose.connection.close()
        process.exit()
    }
}

testAlternativeEndpoints()
