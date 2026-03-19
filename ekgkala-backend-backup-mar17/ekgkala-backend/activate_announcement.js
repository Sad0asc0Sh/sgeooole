const mongoose = require('mongoose');
require('dotenv').config();
const Announcement = require('./models/Announcement');

async function activate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala');
        const ann = await Announcement.findOne({});
        if (ann) {
            ann.isActive = true;
            await ann.save();
            console.log('Activated announcement:', ann._id);
        } else {
            console.log('No announcement found to activate');
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}
activate();
