const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const User = require('./models/User');
const Notification = require('./models/Notification');
const Announcement = require('./models/Announcement');

async function debug() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala');
        console.log('Connected to DB');

        // 1. Check Announcements
        const announcements = await Announcement.find({});
        console.log('--- All Announcements ---');
        console.log(JSON.stringify(announcements, null, 2));

        const activeAnnouncement = await Announcement.findOne({ isActive: true });
        console.log('--- Active Announcement ---');
        console.log(activeAnnouncement);

        // 2. Check Users (get first one)
        const user = await User.findOne({});
        if (!user) {
            console.log('No users found');
            return;
        }
        console.log('--- Test User ---');
        console.log(`ID: ${user._id}, Name: ${user.name}, Mobile: ${user.mobile}`);

        // 3. Check Notifications for this user
        const notifications = await Notification.find({ user: user._id });
        console.log(`--- Notifications for User ${user._id} ---`);
        console.log(JSON.stringify(notifications, null, 2));

        // 4. Simulate Controller Logic
        let allMessages = [...notifications.map(n => n.toObject())];
        if (activeAnnouncement) {
            const announcementNotification = {
                _id: activeAnnouncement._id,
                title: 'اطلاعیه عمومی',
                message: activeAnnouncement.message,
                type: activeAnnouncement.type || 'info',
                isRead: false,
                createdAt: activeAnnouncement.createdAt,
                isAnnouncement: true,
                link: activeAnnouncement.link
            };
            allMessages.unshift(announcementNotification);
        }

        console.log('--- Final API Response Data ---');
        console.log(JSON.stringify(allMessages, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}

debug();
