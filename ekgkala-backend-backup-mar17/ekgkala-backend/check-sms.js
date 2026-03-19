const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const settings = await db.collection('settings').findOne({});
  if (!settings) {
    console.log('❌ هیچ سندی در collection settings پیدا نشد!');
    process.exit(1);
  }
  console.log('=== تمام فیلدهای settings ===');
  console.log(JSON.stringify(settings, null, 2));
  await mongoose.disconnect();
}).catch(e => { console.error('DB Error:', e.message); process.exit(1); });
