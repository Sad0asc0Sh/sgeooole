const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const testMobile = process.argv[2];
const apiKey = process.env.MELIPAYAMAK_API_KEY;
const bodyId = Number(process.env.MELIPAYAMAK_OTP_BODY_ID || 434916);

if (!testMobile || !apiKey) {
  console.error('Usage: MELIPAYAMAK_API_KEY=<key> node scripts/test-melipayamak-otp.js <09xxxxxxxxx>');
  process.exit(1);
}

const testCode = String(crypto.randomInt(1000, 10000));

console.log(`\n============================================================`);
console.log(`🚀 تست ارسال مستقیم پیامک کد تایید (الگو)`);
console.log(`============================================================`);
console.log(`📱 شماره دریافت‌کننده: ${testMobile}`);
console.log(`🔢 شناسه متن (BodyId): ${bodyId}`);
console.log(`🔑 کد تایید تست (۴ رقمی): ${testCode}`);
console.log(`🌐 در حال ارسال به کنسول ملی‌پیامک...\n`);

axios.post(
  `https://console.melipayamak.com/api/send/shared/${apiKey}`,
  { bodyId, to: testMobile, args: [testCode] },
  { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
)
.then(res => {
  console.log('✅ پاسخ سرور ملی‌پیامک:');
  console.log(JSON.stringify(res.data, null, 2));
  if (res.data && res.data.recId) {
    console.log(`\n🎉 پیامک با موفقیت ارسال شد! شناسه پیگیری (recId): ${res.data.recId}`);
  } else {
    console.log(`\n⚠️ پیامک ارسال نشد. پیام سرور: ${res.data?.status || 'نامشخص'}`);
  }
})
.catch(err => {
  console.error('❌ خطا در ارتباط با وب‌سرویس:');
  if (err.response) {
    console.error('کد وضعیت HTTP:', err.response.status);
    console.error('پاسخ سرور:', JSON.stringify(err.response.data, null, 2));
  } else {
    console.error('خطای شبکه:', err.message);
  }
});
