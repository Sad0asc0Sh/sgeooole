const mongoose = require('mongoose');
require('dotenv').config();

const NEW_API_KEY = 'کلید-جدید-را-اینجا-بگذار';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Settings = require('./models/Settings');
  
  const result = await Settings.findOneAndUpdate(
    {},
    { $set: { 'notificationSettings.smsApiKey': NEW_API_KEY } },
    { new: true }
  );
  
  console.log('آپدیت شد:', result?.notificationSettings?.smsApiKey ? '✅' : '❌');
  await mongoose.disconnect();
}).catch(console.error);
