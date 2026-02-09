const mongoose = require('mongoose');
require('dotenv').config();

// List of collections to clear (Transactional Data)
// These are the collection names in MongoDB (usually lowercase plural of model name)
const COLLECTIONS_TO_CLEAR = [
    'orders',
    'tickets',
    'carts',
    'notifications',
    'auditlogs',
    'chathistories',
    'rmas',
    'otps',
    'reviews',
    'sales',
    'newsletters',
    // 'users', // Uncomment to clear customers (BE CAREFUL: might delete admins if not filtered)
];

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (err) {
        console.error(`❌ Error connecting to MongoDB: ${err.message}`);
        process.exit(1);
    }
};

const wipeData = async () => {
    const conn = await connectDB();

    console.log('⚠️  STARTING DATABASE WIPE ⚠️');
    console.log('Target Collections:', COLLECTIONS_TO_CLEAR.join(', '));
    console.log('---------------------------------------------------');

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question('⚠️  Are you sure you want to delete these collections? (yes/no): ', async (answer) => {
        if (answer.toLowerCase() !== 'yes') {
            console.log('❌ Operation cancelled.');
            readline.close();
            await mongoose.connection.close();
            process.exit(0);
        }

        console.log('🚀 Starting deletion...');

        try {
            const collections = await mongoose.connection.db.listCollections().toArray();
            const collectionNames = collections.map(c => c.name);

            for (const collectionName of COLLECTIONS_TO_CLEAR) {
                if (collectionNames.includes(collectionName)) {
                    try {
                        const result = await mongoose.connection.db.collection(collectionName).deleteMany({});
                        console.log(`🗑️  Cleared ${collectionName}: ${result.deletedCount} documents deleted.`);
                    } catch (err) {
                        console.error(`❌ Failed to clear ${collectionName}: ${err.message}`);
                    }
                } else {
                    console.log(`⚠️  Collection ${collectionName} not found, skipping.`);
                }
            }

            console.log('---------------------------------------------------');
            console.log('✅ Database wipe completed successfully.');

            // Optional: Clear Users with role 'user' only?
            // const User = require('../models/User');
            // const result = await User.deleteMany({ role: 'user' });
            // console.log(`🗑️  Cleared Customers (role=user): ${result.deletedCount} documents deleted.`);

        } catch (err) {
            console.error('❌ Error during wipe:', err);
            await mongoose.connection.close();
            process.exit(1);
        } finally {
            readline.close();
            await mongoose.connection.close();
            console.log('MongoDB connection closed.');
            process.exit(0);
        }
    });
};

wipeData();
