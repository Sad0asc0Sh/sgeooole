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

const debugCategories = async () => {
    await connectDB();

    try {
        console.log('\n--- Searching for "Featured" Categories ---');
        const featured = await Category.find({ isFeatured: true });
        console.log(`Found ${featured.length} featured categories:`);
        featured.forEach(c => {
            console.log(`- ID: ${c._id}, Name: "${c.name}", isActive: ${c.isActive}, isFeatured: ${c.isFeatured}`);
        });

        console.log('\n--- Searching for Category "دوربین مداربسته ip" ---');
        const specific = await Category.find({ name: /دوربین/i });
        console.log(`Found ${specific.length} categories matching "دوربین":`);
        specific.forEach(c => {
            console.log(`- ID: ${c._id}, Name: "${c.name}", isActive: ${c.isActive}, isFeatured: ${c.isFeatured}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
};

debugCategories();
