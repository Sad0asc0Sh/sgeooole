/**
 * set-superadmin.js
 * 
 * یک‌بار اجرا کنید تا نقش یک کاربر را به superadmin تغییر دهد
 * روش اجرا: node set-superadmin.js
 */

const mongoose = require('mongoose')
require('dotenv').config()

// ایمیل کاربری که می‌خواهید superadmin شود
const TARGET_EMAIL = 'ENTER_EMAIL_HERE'

async function setSupeRadmin() {
    if (TARGET_EMAIL === 'ENTER_EMAIL_HERE') {
        console.error('❌ لطفاً ایمیل کاربر را در فایل تنظیم کنید (متغیر TARGET_EMAIL)')
        process.exit(1)
    }

    const uri = process.env.MONGODB_URI
    if (!uri) {
        console.error('❌ MONGODB_URI در فایل .env یافت نشد')
        process.exit(1)
    }

    try {
        console.log('🔌 در حال اتصال به MongoDB...')
        await mongoose.connect(uri)
        console.log('✅ اتصال موفق')

        const db = mongoose.connection.db
        const result = await db.collection('users').updateOne(
            { email: TARGET_EMAIL },
            { $set: { role: 'superadmin' } }
        )

        if (result.matchedCount === 0) {
            console.error(`❌ کاربری با ایمیل "${TARGET_EMAIL}" یافت نشد!`)
        } else if (result.modifiedCount === 1) {
            console.log(`✅ نقش کاربر "${TARGET_EMAIL}" با موفقیت به superadmin تغییر یافت`)
        } else {
            console.log(`ℹ️  کاربر "${TARGET_EMAIL}" قبلاً superadmin بوده`)
        }

        // نمایش اطلاعات کاربر برای تأیید
        const user = await db.collection('users').findOne(
            { email: TARGET_EMAIL },
            { projection: { name: 1, email: 1, role: 1, isActive: 1 } }
        )
        console.log('\n📋 اطلاعات کاربر:')
        console.log(user)

    } catch (err) {
        console.error('❌ خطا:', err.message)
    } finally {
        await mongoose.disconnect()
        console.log('\n🔌 اتصال بسته شد')
        process.exit(0)
    }
}

setSupeRadmin()
