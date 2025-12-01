const mongoose = require('mongoose');
require('dotenv').config();
const Category = require('./models/Category');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/welfvita', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to DB');
    } catch (err) {
        console.error('DB Connection Error:', err);
        process.exit(1);
    }
};

const listAll = async () => {
    await connectDB();

    try {
        const count = await Category.countDocuments();
        console.log(`\nTotal Categories in DB: ${count}`);

        const categories = await Category.find({}).limit(10);
        categories.forEach(c => {
            console.log(`- ${c.name} (${c._id})`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
};

listAll();
