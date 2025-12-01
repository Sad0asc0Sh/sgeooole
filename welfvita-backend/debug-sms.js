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

const testSMS = async () => {
    await connectDB()

    try {
        console.log('\n--- Fetching Settings ---')
        const settings = await Settings.findOne({ singletonKey: 'main_settings' }).select('+notificationSettings.smsApiKey')

        if (!settings) {
            console.error('No settings found!')
            process.exit(1)
        }

        const { smsApiKey, smsSenderNumber } = settings.notificationSettings || {}

        console.log('SMS Sender Number:', smsSenderNumber || '(Not Set)')
        console.log('SMS API Key:', smsApiKey ? `${smsApiKey.substring(0, 5)}...` : '(Not Set)')

        if (!smsApiKey) {
            console.error('ERROR: SMS API Key is missing in settings.')
            process.exit(1)
        }

        // 1. Check Credit (Test Token Validity)
        console.log('\n--- Testing Token Validity (Get Credit) ---')

        // Method A: Header Auth
        console.log('Method A: Header Auth')
        try {
            const creditRes = await axios.get('https://console.melipayamak.com/api/receive/credit', {
                headers: { 'Authorization': smsApiKey }
            })
            console.log('Credit Check Success (Header):', creditRes.data)
        } catch (error) {
            console.log('Method A Failed:', error.response?.status)
        }

        // Method B: URL Auth
        console.log('Method B: URL Auth')
        try {
            const creditRes = await axios.get(`https://console.melipayamak.com/api/receive/credit/${smsApiKey}`)
            console.log('Credit Check Success (URL):', creditRes.data)
        } catch (error) {
            console.log('Method B Failed:', error.response?.status)
        }

        // 2. Send Test SMS
        const testMobile = '09123456789' // REPLACE THIS WITH YOUR REAL NUMBER
        console.log(`\n--- Sending Test SMS to ${testMobile} ---`)

        const payload = {
            from: smsSenderNumber || '',
            to: testMobile,
            text: 'تست ارسال پیامک ویلف ویتا'
        }

        console.log('Payload:', payload)

        // Method A: Header Auth
        console.log('Method A: Header Auth')
        try {
            const sendRes = await axios.post('https://console.melipayamak.com/api/send/simple', payload, {
                headers: { 'Authorization': smsApiKey }
            })
            console.log('Send Success (Header):', sendRes.data)
        } catch (error) {
            console.log('Method A Failed:', error.response?.status)
        }

        // Method B: URL Auth
        console.log('Method B: URL Auth')
        try {
            const sendRes = await axios.post(`https://console.melipayamak.com/api/send/simple/${smsApiKey}`, payload)
            console.log('Send Success (URL):', sendRes.data)
        } catch (error) {
            console.log('Method B Failed:', error.response?.status)
            if (error.response?.data) console.log('Error Data:', error.response.data)
        }

    } catch (error) {
        console.error('Unexpected Error:', error)
    } finally {
        await mongoose.connection.close()
        process.exit()
    }
}

testSMS()
