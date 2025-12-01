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

const listPopular = async () => {
    await connectDB();

    try {
        console.log('\n--- All Popular Categories ---');
        const popular = await Category.find({ isPopular: true });

        if (popular.length === 0) {
            console.log("No popular categories found.");
        }

        popular.forEach(c => {
            console.log(`ID: ${c._id}`);
            console.log(`Name: ${c.name}`);
            console.log(`Parent: ${c.parent}`);
            console.log(`IsActive: ${c.isActive}`);
            console.log(`IsPopular: ${c.isPopular}`);
            console.log('-------------------');
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
};

listPopular();
