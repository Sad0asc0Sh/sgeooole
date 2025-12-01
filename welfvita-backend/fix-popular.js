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

const fixPopular = async () => {
    await connectDB();

    try {
        const idToFix = '69177ccbb62393adad60495c';
        console.log(`\n--- Attempting to fix category ${idToFix} ---`);

        const category = await Category.findById(idToFix);
        if (!category) {
            console.log('Category not found!');
        } else {
            console.log(`Found category: ${category.name}, isPopular: ${category.isPopular}`);
            category.isPopular = false;
            await category.save();
            console.log('Category updated successfully. isPopular is now false.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
};

fixPopular();
