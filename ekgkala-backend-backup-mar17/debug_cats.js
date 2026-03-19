require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Category = require('./models/Category');

async function test() {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    const cats = await Category.find({}).select('name parent isActive isDeleted').lean();
    console.log(JSON.stringify(cats, null, 2));
    process.exit(0);
}

test().catch(console.error);
