const Admin = require('../models/Admin')

// لیست تمام ادمین‌ها (admin / manager / superadmin)
exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find({
      role: { $in: ['admin', 'manager', 'superadmin'] },
    })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean()

    res.json({
      success: true,
      data: admins,
    })
  } catch (error) {
    console.error('Error fetching admins:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لیست ادمین‌ها',
      error: error.message,
    })
  }
}

// ایجاد کاربر ادمین جدید
exports.createAdminUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {}

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'لطفاً نام، ایمیل، رمز عبور و نقش را تکمیل کنید.',
      })
    }

    if (!['admin', 'manager'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'نقش نامعتبر است. فقط نقش‌های admin و manager مجاز هستند.',
      })
    }

    const admin = await Admin.create({
      name,
      email,
      password,
      role,
      isActive: true,
    })

    const safeAdmin = admin.toJSON()

    res.status(201).json({
      success: true,
      message: 'ادمین جدید با موفقیت ایجاد شد.',
      data: safeAdmin,
    })
  } catch (error) {
    console.error('Error creating admin user:', error)

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'برای این ایمیل قبلاً کاربری ثبت شده است.',
      })
    }

    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد کاربر ادمین جدید',
      error: error.message,
    })
  }
}

// به‌روزرسانی اطلاعات کاربر ادمین
exports.updateAdminUser = async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body || {}

    const admin = await Admin.findById(req.params.id)

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'کاربر ادمین با این شناسه یافت نشد.',
      })
    }

    if (name !== undefined) admin.name = name
    if (email !== undefined) admin.email = email
    if (role !== undefined) admin.role = role
    if (isActive !== undefined) admin.isActive = isActive

    await admin.save()

    const updated = await Admin.findById(admin._id).select('-password').lean()

    res.json({
      success: true,
      message: 'اطلاعات ادمین با موفقیت به‌روزرسانی شد.',
      data: updated,
    })
  } catch (error) {
    console.error('Error updating admin user:', error)

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'ایمیل وارد شده قبلاً استفاده شده است.',
      })
    }

    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی اطلاعات ادمین',
      error: error.message,
    })
  }
}

// حذف کاربر ادمین
exports.deleteAdminUser = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id)

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'کاربر ادمین با این شناسه یافت نشد.',
      })
    }

    // جلوگیری از حذف حساب جاری سوپرادمین
    if (admin._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'امکان حذف حساب کاربری خودتان وجود ندارد.',
      })
    }

    await admin.deleteOne()

    res.json({
      success: true,
      message: 'ادمین با موفقیت حذف شد.',
    })
  } catch (error) {
    console.error('Error deleting admin user:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف کاربر ادمین',
      error: error.message,
    })
  }
}

