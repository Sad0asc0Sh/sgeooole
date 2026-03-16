const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const { sendOtpSMS } = require('./utils/notificationService');
  
  console.log('در حال ارسال OTP...');
  try {
    const result = await sendOtpSMS('09357510443');
    console.log('نتیجه:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('خطا:', err.message, '| کد:', err.code);
  }
  
  await mongoose.disconnect();
}).catch(console.error);
