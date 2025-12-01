const mongoose = require('mongoose');

const connectLocalDB = async () => {
    try {
        // Force local connection
        await mongoose.connect('mongodb://localhost:27017/welfvita', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 2000 // Short timeout
        });
        console.log('Connected to LOCAL DB');
    } catch (err) {
        console.log('Could not connect to Local DB (might not be running)');
        process.exit(0);
    }
};

const checkLocal = async () => {
    await connectLocalDB();

    try {
        const count = await mongoose.connection.db.collection('categories').countDocuments();
        console.log(`Total Categories in LOCAL DB: ${count}`);

        const specific = await mongoose.connection.db.collection('categories').find({ name: /دوربین مداربسته ip/ }).toArray();
        console.log(`Found in LOCAL DB: ${specific.length}`);
        specific.forEach(c => {
            console.log(`- ID: ${c._id}, Name: ${c.name}, isFeatured: ${c.isFeatured}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
};

checkLocal();
