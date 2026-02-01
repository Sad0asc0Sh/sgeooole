/**
 * 📧 اسکریپت تست ارسال ایمیل با Resend
 * 
 * استفاده:
 *   - ابتدا RESEND_API_KEY و RESEND_FROM_EMAIL را تنظیم کنید
 *   - node scripts/test-resend.js <ایمیل_گیرنده>
 * 
 * مثال:
 *   node scripts/test-resend.js test@example.com
 */

require('dotenv').config();

const testResendEmail = async () => {
    console.log('\n' + '═'.repeat(60));
    console.log('📧 تست ارسال ایمیل با Resend API');
    console.log('═'.repeat(60));

    // بررسی تنظیمات
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const recipientEmail = process.argv[2];

    console.log('\n📋 تنظیمات فعلی:');
    console.log('  - RESEND_API_KEY:', RESEND_API_KEY ? `✅ تنظیم شده (${RESEND_API_KEY.substring(0, 10)}...)` : '❌ تنظیم نشده');
    console.log('  - RESEND_FROM_EMAIL:', RESEND_FROM_EMAIL);
    console.log('  - ایمیل گیرنده:', recipientEmail || '❌ مشخص نشده');

    if (!RESEND_API_KEY) {
        console.log('\n❌ خطا: RESEND_API_KEY تنظیم نشده است!');
        console.log('\n📌 راهنما:');
        console.log('  1. به https://resend.com/signup بروید و ثبت‌نام کنید');
        console.log('  2. در Dashboard، به قسمت API Keys بروید');
        console.log('  3. یک API Key جدید بسازید');
        console.log('  4. در فایل .env اضافه کنید: RESEND_API_KEY=re_xxxxxxxxxx');
        process.exit(1);
    }

    if (!recipientEmail) {
        console.log('\n❌ خطا: ایمیل گیرنده مشخص نشده!');
        console.log('استفاده: node scripts/test-resend.js <ایمیل_گیرنده>');
        process.exit(1);
    }

    // تست ارسال
    console.log('\n⏳ در حال ارسال ایمیل تست...');

    try {
        const { Resend } = require('resend');
        const resend = new Resend(RESEND_API_KEY);

        const { data, error } = await resend.emails.send({
            from: `ویلف ویتا <${RESEND_FROM_EMAIL}>`,
            to: [recipientEmail],
            subject: '✅ تست ارسال ایمیل از ویلف ویتا',
            html: `
        <div dir="rtl" style="font-family: Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #1890ff; text-align: center;">✅ ایمیل با موفقیت ارسال شد!</h2>
          <p style="color: #555; font-size: 14px; text-align: center;">
            این یک ایمیل تست است که نشان می‌دهد سیستم ایمیل به درستی کار می‌کند.
          </p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #333; font-size: 14px; margin: 5px 0;">
              📧 ارسال‌کننده: <strong>${RESEND_FROM_EMAIL}</strong>
            </p>
            <p style="color: #333; font-size: 14px; margin: 5px 0;">
              ⏰ زمان: <strong>${new Date().toLocaleString('fa-IR')}</strong>
            </p>
            <p style="color: #333; font-size: 14px; margin: 5px 0;">
              🔧 سرویس: <strong>Resend API</strong>
            </p>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
            با تشکر، تیم ویلف ویتا
          </p>
        </div>
      `,
        });

        if (error) {
            console.log('\n❌ خطا در ارسال:');
            console.log('  - پیام:', error.message);
            console.log('  - کد:', error.statusCode || error.name);

            if (error.message?.includes('domain')) {
                console.log('\n📌 احتمالاً دامنه verify نشده!');
                console.log('  - به https://resend.com/domains بروید');
                console.log('  - دامنه خود را اضافه کنید');
                console.log('  - رکوردهای DNS را تنظیم کنید');
                console.log('  - یا برای تست از onboarding@resend.dev استفاده کنید');
            }

            process.exit(1);
        }

        console.log('\n✅ ایمیل با موفقیت ارسال شد!');
        console.log('  - Message ID:', data?.id);
        console.log('\n📬 لطفاً Inbox و Spam خود را چک کنید.');

    } catch (err) {
        console.log('\n❌ خطای غیرمنتظره:');
        console.log('  - پیام:', err.message);
        console.log('  - جزئیات:', JSON.stringify(err, null, 2));

        if (err.code === 'ERR_REQUIRE_FAILED' || err.message?.includes('Cannot find module')) {
            console.log('\n📦 ابتدا پکیج resend را نصب کنید:');
            console.log('  npm install resend');
        }
    }

    console.log('\n' + '═'.repeat(60) + '\n');
};

testResendEmail();
