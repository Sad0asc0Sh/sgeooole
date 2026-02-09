const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });

const Cart = require('./models/Cart');
const User = require('./models/User');

async function debugCarts() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        console.log('\n--- DIAGNOSING MOST RECENT CART ---');
        // Fetch RAW cart without populate
        const rawCart = await Cart.findOne({}).sort({ updatedAt: -1 }).lean();

        if (!rawCart) {
            console.log('No carts found in database.');
        } else {
            console.log(`Cart ID: ${rawCart._id}`);
            console.log(`Raw User Field: ${rawCart.user} (Type: ${typeof rawCart.user})`);
            console.log(`Status: ${rawCart.status}`);
            console.log(`Items: ${rawCart.items ? rawCart.items.length : 0}`);
            console.log(`Updated At: ${rawCart.updatedAt}`);

            if (rawCart.user) {
                console.log(`\nChecking User with ID: ${rawCart.user}...`);
                const userDoc = await User.findById(rawCart.user);
                if (userDoc) {
                    console.log('User FOUND!');
                    console.log(`Name: ${userDoc.name}`);
                    console.log(`Email: ${userDoc.email}`);
                } else {
                    console.log('CRITICAL: User NOT FOUND in "users" collection!');
                    console.log('This explains why populate() returns null.');
                }
            } else {
                console.log('CRITICAL: Cart has no user ID!');
            }
        }

        console.log('\n--- END DIAGNOSIS ---');
        process.exit(0);
    } catch (error) {
        console.error('Debug Error:', error);
        process.exit(1);
    }
}

debugCarts();
