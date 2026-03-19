const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const raw = await db.collection('settings').findOne({});
  
  console.log('=== notificationSettings ===');
  console.log(JSON.stringify(raw.notificationSettings, null, 2));
  
  console.log('\n=== بررسی مسیرها ===');
  console.log('raw.notificationSettings:', raw.notificationSettings);
  console.log('raw.notificationSettings?.smsApiKey:', raw.notificationSettings?.smsApiKey);
  console.log('raw.notificationSettings?.smsUsername:', raw.notificationSettings?.smsUsername);
  
  const enabled = !!(raw.notificationSettings && 
    (raw.notificationSettings.smsApiKey || raw.notificationSettings.smsUsername));
  console.log('\nenabled result:', enabled);

  // حالا با Settings Model
  const Settings = require('./models/Settings');
  const settings = await Settings.findOne();
  console.log('\n=== از طریق Settings Model ===');
  console.log('settings.notificationSettings:', settings.notificationSettings);
  console.log('settings.notificationSettings?.smsApiKey:', settings.notificationSettings?.smsApiKey);
  
  const enabledModel = !!(settings.notificationSettings && 
    (settings.notificationSettings.smsApiKey || settings.notificationSettings.smsUsername));
  console.log('enabled از Model:', enabledModel);

  await mongoose.disconnect();
}).catch(e => { console.error('DB Error:', e.message); process.exit(1); });
