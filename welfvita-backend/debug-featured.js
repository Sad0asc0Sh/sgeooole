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

const listFeatured = async () => {
    await connectDB();

    try {
        console.log('\n--- All Featured Categories ---');
        const featured = await Category.find({ isFeatured: true });

        if (featured.length === 0) {
            console.log("No featured categories found.");
        }

        featured.forEach(c => {
            console.log(`ID: ${c._id}`);
            console.log(`Name: ${c.name}`);
            console.log(`Parent: ${c.parent}`);
            console.log(`IsActive: ${c.isActive}`);
            console.log(`IsFeatured: ${c.isFeatured}`);
            console.log('-------------------');
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
};

listFeatured();
