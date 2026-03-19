const Notification = require('../models/Notification')
const User = require('../models/User')

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
exports.getUserNotifications = async (req, res) => {
    try {
        console.log('GET /api/notifications request from user:', req.user._id)

        // Fetch user specific notifications
        const notifications = await Notification.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean()

        // Fetch active announcement
        const Announcement = require('../models/Announcement')
        const activeAnnouncement = await Announcement.findOne({ isActive: true }).lean()

        let allMessages = [...notifications]

        if (activeAnnouncement) {
            // Convert announcement to notification format
            const announcementNotification = {
                _id: activeAnnouncement._id,
                title: 'اطلاعیه عمومی',
                message: activeAnnouncement.message,
                type: activeAnnouncement.type || 'info',
                isRead: false, // Announcements are always shown as unread until dismissed (logic to be improved if needed)
                createdAt: activeAnnouncement.createdAt,
                isAnnouncement: true,
                link: activeAnnouncement.link
            }
            // Add to top
            allMessages.unshift(announcementNotification)
        }

        console.log(`Found ${notifications.length} notifications + ${activeAnnouncement ? 1 : 0} announcement for user ${req.user._id}`)

        res.json({
            success: true,
            count: allMessages.length,
            data: allMessages,
        })
    } catch (error) {
        console.error('Get notifications error:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در دریافت اعلانات',
        })
    }
}

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
    try {
        // If it's an announcement (we can't mark it as read in DB for specific user easily without a separate model)
        // For now, we just return success if it looks like an announcement ID (or we can handle it on frontend)
        // But wait, the frontend calls this endpoint with the ID.
        // If the ID is from Announcement, Notification.findById will fail or return null.

        const notification = await Notification.findById(req.params.id)

        if (!notification) {
            // Check if it is an announcement
            const Announcement = require('../models/Announcement')
            const announcement = await Announcement.findById(req.params.id)
            if (announcement) {
                // It's an announcement. We can't "mark as read" in the database for this user specifically 
                // without a "UserAnnouncementRead" model.
                // For now, let's just return success so frontend updates UI (optimistic UI).
                return res.json({
                    success: true,
                    data: { ...announcement.toObject(), isRead: true }
                })
            }

            return res.status(404).json({
                success: false,
                message: 'اعلان یافت نشد',
            })
        }

        // Check if notification belongs to user
        if (notification.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({
                success: false,
                message: 'شما اجازه دسترسی به این اعلان را ندارید',
            })
        }

        notification.isRead = true
        await notification.save()

        res.json({
            success: true,
            data: notification,
        })
    } catch (error) {
        console.error('Mark as read error:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در به‌روزرسانی وضعیت اعلان',
        })
    }
}

// @desc    Send notification (Admin)
// @route   POST /api/notifications/send
// @access  Private/Admin
exports.sendNotification = async (req, res) => {
    try {
        const { userId, title, message, type } = req.body
        console.log('POST /api/notifications/send request:', { userId, title, type })

        if (!userId || !title || !message) {
            return res.status(400).json({
                success: false,
                message: 'لطفاً شناسه کاربر، عنوان و متن پیام را وارد کنید',
            })
        }

        const user = await User.findById(userId)
        if (!user) {
            console.log('User not found:', userId)
            return res.status(404).json({
                success: false,
                message: 'کاربر مورد نظر یافت نشد',
            })
        }

        const notification = await Notification.create({
            user: userId,
            title,
            message,
            type: type || 'info',
        })

        console.log('Notification created:', notification)

        res.status(201).json({
            success: true,
            data: notification,
            message: 'اعلان با موفقیت ارسال شد',
        })
    } catch (error) {
        console.error('Send notification error:', error)
        res.status(500).json({
            success: false,
            message: 'خطا در ارسال اعلان',
        })
    }
}
