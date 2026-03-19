const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala';
        console.log('Connecting to:', uri);
        const conn = await mongoose.connect(uri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        const collection = mongoose.connection.collection('users');

        // List indexes
        const indexes = await collection.indexes();
        console.log('Current indexes:', indexes);

        // Drop mobile_1 index
        try {
            await collection.dropIndex('mobile_1');
            console.log('Index mobile_1 dropped successfully');
        } catch (err) {
            console.log('Error dropping mobile_1 (might not exist):', err.message);
        }

        // Drop email_1 index just in case
        try {
            await collection.dropIndex('email_1');
            console.log('Index email_1 dropped successfully');
        } catch (err) {
            console.log('Error dropping email_1 (might not exist):', err.message);
        }

        // Drop googleId_1 index just in case
        try {
            await collection.dropIndex('googleId_1');
            console.log('Index googleId_1 dropped successfully');
        } catch (err) {
            console.log('Error dropping googleId_1 (might not exist):', err.message);
        }

        console.log('Done. Exiting...');
        process.exit(0);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

connectDB();
