const Announcement = require('../models/Announcement')

/**
 * @desc    دریافت اعلان فعال (روت عمومی برای سایت مشتری)
 * @route   GET /api/announcements/active
 * @access  Public
 */
exports.getActiveAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findOne({ isActive: true })

    // اگر اعلان فعالی وجود ندارد، null برگردان
    res.status(200).json({
      success: true,
      data: announcement,
    })
  } catch (error) {
    console.error('Error fetching active announcement:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت اعلان فعال',
      error: error.message,
    })
  }
}

/**
 * @desc    دریافت تمام اعلانات (برای پنل ادمین)
 * @route   GET /api/announcements/admin
 * @access  Private/Admin
 */
exports.getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 }) // جدیدترین‌ها اول

    res.status(200).json({
      success: true,
      count: announcements.length,
      data: announcements,
    })
  } catch (error) {
    console.error('Error fetching announcements:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لیست اعلانات',
      error: error.message,
    })
  }
}

/**
 * @desc    ایجاد اعلان جدید
 * @route   POST /api/announcements/admin
 * @access  Private/Admin
 */
exports.createAnnouncement = async (req, res) => {
  try {
    const { message, link, type, isActive } = req.body

    // اعتبارسنجی
    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'متن اعلان الزامی است',
      })
    }

    const announcement = await Announcement.create({
      message: message.trim(),
      link: link?.trim() || null,
      type: type || 'info',
      isActive: Boolean(isActive),
    })

    console.log('Announcement created:', announcement._id)

    res.status(201).json({
      success: true,
      message: 'اعلان با موفقیت ایجاد شد',
      data: announcement,
    })
  } catch (error) {
    console.error('Error creating announcement:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد اعلان',
      error: error.message,
    })
  }
}

/**
 * @desc    به‌روزرسانی اعلان
 * @route   PUT /api/announcements/admin/:id
 * @access  Private/Admin
 */
exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params
    const { message, link, type, isActive } = req.body

    const announcement = await Announcement.findById(id)

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'اعلان یافت نشد',
      })
    }

    // به‌روزرسانی فیلدها
    if (message !== undefined) announcement.message = message.trim()
    if (link !== undefined) announcement.link = link?.trim() || null
    if (type !== undefined) announcement.type = type
    if (isActive !== undefined) announcement.isActive = Boolean(isActive)

    await announcement.save() // pre-save hook اجرا می‌شود

    console.log('Announcement updated:', announcement._id)

    res.status(200).json({
      success: true,
      message: 'اعلان با موفقیت به‌روزرسانی شد',
      data: announcement,
    })
  } catch (error) {
    console.error('Error updating announcement:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی اعلان',
      error: error.message,
    })
  }
}

/**
 * @desc    حذف اعلان
 * @route   DELETE /api/announcements/admin/:id
 * @access  Private/Admin
 */
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params

    const announcement = await Announcement.findById(id)

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'اعلان یافت نشد',
      })
    }

    await announcement.deleteOne()

    console.log('Announcement deleted:', id)

    res.status(200).json({
      success: true,
      message: 'اعلان با موفقیت حذف شد',
    })
  } catch (error) {
    console.error('Error deleting announcement:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف اعلان',
      error: error.message,
    })
  }
}
