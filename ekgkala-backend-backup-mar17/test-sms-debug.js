const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Settings = require('./models/Settings');
  
  const settings = await Settings.findOne().select(
    '+notificationSettings.smsApiKey +notificationSettings.smsUsername +notificationSettings.smsPassword'
  );
  
  const pathToken = settings?.notificationSettings?.smsApiKey;
  console.log('pathToken موجود:', !!pathToken);
  console.log('pathToken مقدار:', pathToken);
  console.log('URL کامل:', `https://console.melipayamak.com/api/send/otp/${pathToken}`);
  
  try {
    const response = await axios.post(
      `https://console.melipayamak.com/api/send/otp/${pathToken}`,
      { to: '09357510443' },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );
    console.log('✅ موفق:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Status Code:', error.response?.status);
    console.error('❌ Response Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('❌ Response Headers:', JSON.stringify(error.response?.headers, null, 2));
  }
  
  await mongoose.disconnect();
}).catch(console.error);
