// ✅ FIX: Use correct User model (Customer model, not Admin model)
const User = require('../models/User')
const logger = require('../utils/logger')
const { ROLES, PERMISSIONS } = require('../config/rbac')

// Role hierarchy used for safety checks - RBAC System
// Higher number = higher privilege
const ROLE_LEVELS = {
  user: 1,
  support: 2,
  editor: 3,
  admin: 4,
  manager: 5,
  superadmin: 6,
}

// All valid roles in the system
const ALL_ROLES = ['user', 'support', 'editor', 'admin', 'manager', 'superadmin']

const getRoleLevel = (role) => ROLE_LEVELS[role] || 0
const getPermissionsForRole = (role) => ROLES[role] || []

// ============================================
// GET /api/users/admin/all
// List users (primarily customers) with filters & pagination
// ============================================
exports.getAllUsersAsAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    const search = req.query.search || ''
    const filter = {}

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]
    }

    // Filter by role - supports all RBAC roles
    if (req.query.role && ALL_ROLES.includes(req.query.role)) {
      filter.role = req.query.role
    }
    // If no role filter, show all roles (not just 'user')

    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true'
    }

    const totalUsers = await User.countDocuments(filter)
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    res.json({
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لیست کاربران',
      error: error.message,
    })
  }
}

// ============================================
// GET /api/users/admin/:id
// Get single user by id
// ============================================
exports.getUserByIdAsAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean()

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربر مورد نظر یافت نشد',
      })
    }

    res.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error('Error fetching user by id:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت جزئیات کاربر',
      error: error.message,
    })
  }
}

// ============================================
// PUT /api/users/admin/:id
// Update user profile (primarily customers)
// Only superadmin can change roles; other admins can edit customer info only.
// ============================================
exports.updateUserAsAdmin = async (req, res) => {
  try {
    const { name, email, mobile, isActive, role } = req.body || {} // ✅ FIX: تغییر phoneNumber به mobile
    const requestId = req.headers?.['x-request-id'] || 'unknown'

    logger.info(`[USER UPDATE] Start - target: ${req.params.id}, by: ${req.user?._id}, requestId: ${requestId}`, {
      targetId: req.params.id,
      updatedFields: Object.keys(req.body || {}),
      requestId,
    })

    const currentRole = req.user?.role || 'user'
    const currentLevel = getRoleLevel(currentRole)
    const isSuperAdmin = currentRole === 'superadmin'
    const currentPermissions = getPermissionsForRole(currentRole)
    const canManageRoles = currentPermissions.includes(PERMISSIONS.USER_MANAGE_ROLE)

    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربر مورد نظر یافت نشد',
      })
    }

    const targetCurrentLevel = getRoleLevel(user.role)
    const isSelf = user._id.toString() === req.user._id.toString()

    // Cannot edit someone with higher or equal role level (except yourself for basic info)
    if (!isSuperAdmin && targetCurrentLevel >= currentLevel && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'اجازه ویرایش کاربری با سطح دسترسی برابر یا بالاتر را ندارید.',
      })
    }

    // Role change rules
    if (role !== undefined && role !== user.role) {
      // Only roles with USER_MANAGE_ROLE permission can change roles
      if (!canManageRoles) {
        return res.status(403).json({
          success: false,
          message: 'شما مجوز تغییر نقش کاربران را ندارید.',
        })
      }

      // Validate role
      if (!ALL_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'نقش ارسال‌شده معتبر نیست.',
        })
      }

      const newRoleLevel = getRoleLevel(role)

      // Cannot assign role higher than or equal to your own level
      if (!isSuperAdmin && newRoleLevel >= currentLevel) {
        return res.status(403).json({
          success: false,
          message: 'نمی‌توانید نقشی هم‌سطح یا بالاتر از خودتان اختصاص دهید.',
        })
      }

      // Log the role change for audit
      console.log(`[ROLE CHANGE] User ${user._id}: ${user.role} -> ${role} by ${req.user._id} (${currentRole})`)

      user.role = role
    }

    if (name !== undefined) user.name = name

    // Safety: normalize avatar field if it is a plain string (legacy data)
    if (user.avatar && typeof user.avatar === 'string') {
      user.avatar = { url: user.avatar, public_id: null }
    }

    if (email !== undefined) {
      const normalizedEmail = email ? email.trim().toLowerCase() : null
      if (normalizedEmail && normalizedEmail !== user.email) {
        const existingEmail = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } })
        if (existingEmail) {
          return res.status(400).json({
            success: false,
            message: 'این ایمیل قبلاً ثبت شده است.',
          })
        }
      }
      user.email = normalizedEmail || undefined
    }
    if (mobile !== undefined) {
      const normalizedMobile = mobile ? mobile.trim() : null
      if (normalizedMobile && normalizedMobile !== user.mobile) {
        const existingMobile = await User.findOne({ mobile: normalizedMobile, _id: { $ne: user._id } })
        if (existingMobile) {
          return res.status(400).json({
            success: false,
            message: 'این شماره موبایل قبلاً ثبت شده است.',
          })
        }
      }
      user.mobile = normalizedMobile || undefined
    }
    if (isActive !== undefined) user.isActive = isActive

    await user.save()

    const updatedUser = await User.findById(user._id).select('-password').lean()

    res.json({
      success: true,
      message: 'اطلاعات کاربر با موفقیت به‌روزرسانی شد.',
      data: updatedUser,
    })
  } catch (error) {
    const requestId = req.headers?.['x-request-id'] || 'unknown'
    const errorDetails = {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
      keyPattern: error.keyPattern,
      requestId,
      targetUserId: req.params?.id,
    }
    logger.error(`[USER UPDATE] Failed - target: ${req.params?.id}, error: ${error.message}`, errorDetails)
    console.error('Error updating user:', error.message, error.stack)

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0]
      const fieldMessages = {
        mobile: 'این شماره موبایل قبلاً ثبت شده است.',
        email: 'ایمیل وارد شده قبلاً استفاده شده است.',
        username: 'این نام کاربری قبلاً استفاده شده است.',
      }
      return res.status(400).json({
        success: false,
        message: fieldMessages[duplicateField] || 'مقدار وارد شده تکراری است.',
      })
    }

    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی اطلاعات کاربر',
      error: error.message,
    })
  }
}

// ============================================
// DELETE /api/users/admin/:id
// Delete user (admin-only route guarded at router level)
// ============================================
exports.deleteUserAsAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربر مورد نظر یافت نشد',
      })
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'نمی‌توانید حساب کاربری خودتان را حذف کنید.',
      })
    }

    await User.findByIdAndDelete(req.params.id)

    res.json({
      success: true,
      message: 'کاربر با موفقیت حذف شد.',
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در حذف کاربر',
      error: error.message,
    })
  }
}
