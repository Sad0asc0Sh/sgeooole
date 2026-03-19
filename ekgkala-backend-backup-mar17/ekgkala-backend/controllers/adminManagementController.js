const Admin = require('../models/Admin')
const { ROLES, PERMISSIONS } = require('../config/rbac')

const STAFF_ROLES = ['support', 'editor', 'admin', 'manager', 'superadmin']

// Role hierarchy (higher = more privileged)
const ROLE_LEVELS = {
  support: 2,
  editor: 3,
  admin: 4,
  manager: 5,
  superadmin: 6,
}

const getRoleLevel = (role) => ROLE_LEVELS[role] || 0
const getPermissionsForRole = (role) => ROLES[role] || []

// لیست تمام ادمین‌ها (admin / manager / superadmin)
exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find({
      role: { $in: STAFF_ROLES },
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
    const actorRole = req.user?.role || 'user'
    const actorLevel = getRoleLevel(actorRole)
    const actorPermissions = getPermissionsForRole(actorRole)
    const canManageRoles = actorPermissions.includes(PERMISSIONS.ADMIN_MANAGE_ROLE)

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'لطفاً نام، ایمیل، رمز عبور و نقش را تکمیل کنید.',
      })
    }

    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `نقش نامعتبر است. نقش‌های مجاز: ${STAFF_ROLES.join(', ')}`,
      })
    }

    // Only users who can manage admin roles can choose the role during creation (defense-in-depth)
    if (!canManageRoles && actorRole !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'شما مجوز مدیریت نقش ادمین‌ها را ندارید.',
      })
    }

    // Hierarchy rule: cannot assign role >= your own (except superadmin)
    const targetLevel = getRoleLevel(role)
    if (actorRole !== 'superadmin' && targetLevel >= actorLevel) {
      return res.status(403).json({
        success: false,
        message: 'نمی‌توانید نقشی هم‌سطح یا بالاتر از خود اختصاص دهید.',
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

    const actorId = req.user?._id?.toString()
    const actorRole = req.user?.role || 'user'
    const actorLevel = getRoleLevel(actorRole)
    const actorPermissions = getPermissionsForRole(actorRole)
    const canManageRoles = actorPermissions.includes(PERMISSIONS.ADMIN_MANAGE_ROLE)

    const admin = await Admin.findById(req.params.id)

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'کاربر ادمین با این شناسه یافت نشد.',
      })
    }

    if (!STAFF_ROLES.includes(admin.role)) {
      return res.status(400).json({
        success: false,
        message: 'این حساب در لیست نقش‌های ادمین قابل مدیریت نیست.',
      })
    }

    const targetLevel = getRoleLevel(admin.role)
    const isSelf = actorId && admin._id.toString() === actorId
    const originalRole = admin.role
    const originalIsActive = admin.isActive

    // Cannot edit equal/higher roles (except yourself for basic info)
    if (actorRole !== 'superadmin' && targetLevel >= actorLevel && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'اجازه ویرایش ادمین با سطح دسترسی برابر یا بالاتر را ندارید.',
      })
    }

    // Determine intended state after changes (for safety checks)
    let nextRole = admin.role
    let nextIsActive = admin.isActive
    if (isActive !== undefined) nextIsActive = isActive
    if (role !== undefined) {
      if (!STAFF_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'نقش ارسال‌شده معتبر نیست.',
        })
      }
      nextRole = role
    }

    if (name !== undefined) admin.name = name
    if (email !== undefined) admin.email = email
    if (role !== undefined) {
      // Self role change is blocked (prevents self-promotion/demotion accidents)
      if (isSelf && role !== admin.role) {
        return res.status(403).json({
          success: false,
          message: 'برای امنیت بیشتر، تغییر نقش حساب خودتان مجاز نیست.',
        })
      }

      // Role changes require explicit permission (defense-in-depth)
      if (role !== admin.role && !canManageRoles && actorRole !== 'superadmin') {
        return res.status(403).json({
          success: false,
          message: 'شما مجوز تغییر نقش ادمین‌ها را ندارید.',
        })
      }

      const desiredLevel = getRoleLevel(role)
      if (actorRole !== 'superadmin' && desiredLevel >= actorLevel) {
        return res.status(403).json({
          success: false,
          message: 'نمی‌توانید نقشی هم‌سطح یا بالاتر از خود اختصاص دهید.',
        })
      }

      // Only superadmin can assign superadmin explicitly
      if (role === 'superadmin' && actorRole !== 'superadmin') {
        return res.status(403).json({
          success: false,
          message: 'اختصاص نقش سوپرادمین فقط توسط سوپرادمین امکان‌پذیر است.',
        })
      }

      admin.role = role
    }
    if (isActive !== undefined) admin.isActive = isActive

    // Protect last active superadmin from deactivation/demotion
    if (originalRole === 'superadmin' && originalIsActive === true) {
      const isLosingSuperadmin =
        nextRole !== 'superadmin' || nextIsActive === false

      if (isLosingSuperadmin) {
        const activeSuperadminsCount = await Admin.countDocuments({
          role: 'superadmin',
          isActive: true,
        })

        if (activeSuperadminsCount <= 1) {
          return res.status(400).json({
            success: false,
            message: 'امکان غیرفعال‌سازی/تغییر نقش آخرین سوپرادمین فعال وجود ندارد.',
          })
        }
      }
    }

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

    // Prevent deleting the last active superadmin
    if (admin.role === 'superadmin' && admin.isActive === true) {
      const activeSuperadminsCount = await Admin.countDocuments({
        role: 'superadmin',
        isActive: true,
      })

      if (activeSuperadminsCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'امکان حذف آخرین سوپرادمین فعال وجود ندارد.',
        })
      }
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
