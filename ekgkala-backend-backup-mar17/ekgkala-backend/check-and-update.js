const mongoose = require('mongoose');
require('dotenv').config();

const NEW_API_KEY = 'کلید-جدید-را-اینجا-بگذار';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const collection = db.collection('settings');

  const count = await collection.countDocuments();
  console.log('تعداد سندها:', count);

  const sample = await collection.findOne({});
  console.log('کلیدهای موجود:', Object.keys(sample || {}));
  console.log('notificationSettings:', JSON.stringify(sample?.notificationSettings, null, 2));

  const result = await collection.updateOne(
    {},
    { $set: { 'notificationSettings.smsApiKey': NEW_API_KEY } }
  );
  console.log('نتیجه آپدیت:', result.modifiedCount > 0 ? '✅ موفق' : '❌ ناموفق');

  const updated = await collection.findOne({});
  console.log('کلید جدید:', updated?.notificationSettings?.smsApiKey);

  await mongoose.disconnect();
}).catch(console.error);
