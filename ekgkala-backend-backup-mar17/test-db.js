const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  const Settings = require('./models/Settings');
  
  console.log('=== تست بدون select ===');
  const s1 = await Settings.findOne();
  console.log('Full object keys:', Object.keys(s1?.notificationSettings || {}));
  console.log('smsApiKey exists:', !!s1?.notificationSettings?.smsApiKey);
  console.log('smsApiKey value length:', s1?.notificationSettings?.smsApiKey?.length);
  
  console.log('\n=== تست با select ===');
  const s2 = await Settings.findOne().select('+notificationSettings.smsApiKey +notificationSettings.smsUsername +notificationSettings.smsPassword');
  console.log('smsApiKey exists:', !!s2?.notificationSettings?.smsApiKey);
  console.log('smsApiKey value length:', s2?.notificationSettings?.smsApiKey?.length);
  
  await mongoose.disconnect();
}).catch(console.error);
