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

const deleteStuckCategory = async () => {
    await connectDB();

    try {
        const idToDelete = '692d61e51addd6b60fc8db0c';
        console.log(`\n--- Attempting to delete category ${idToDelete} ---`);

        const category = await Category.findById(idToDelete);
        if (!category) {
            console.log('Category not found!');
        } else {
            console.log(`Found category: ${category.name}`);
            await Category.deleteOne({ _id: idToDelete });
            console.log('Category deleted successfully.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
};

deleteStuckCategory();
