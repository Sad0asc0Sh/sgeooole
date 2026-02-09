// ✅ FIX: Use correct User model (Customer model, not Admin model)
const User = require('../models/User')

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

    const currentRole = req.user?.role || 'user'
    const currentLevel = ROLE_LEVELS[currentRole] || 0
    const isSuperAdmin = currentRole === 'superadmin'

    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربر مورد نظر یافت نشد',
      })
    }

    const targetCurrentLevel = ROLE_LEVELS[user.role] || 0

    // Cannot edit someone with higher or equal role level (except yourself for basic info)
    if (targetCurrentLevel >= currentLevel && user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'اجازه ویرایش کاربری با سطح دسترسی برابر یا بالاتر را ندارید.',
      })
    }

    // Role change rules
    if (role !== undefined && role !== user.role) {
      // Validate role
      if (!ALL_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'نقش ارسال‌شده معتبر نیست.',
        })
      }

      const newRoleLevel = ROLE_LEVELS[role]

      // Cannot assign role higher than or equal to your own level
      if (newRoleLevel >= currentLevel) {
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
    if (email !== undefined) user.email = email
    if (mobile !== undefined) {
      // ✅ FIX: Check if mobile already exists for another user
      if (mobile !== user.mobile) {
        const existingUser = await User.findOne({ mobile, _id: { $ne: user._id } })
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'این شماره موبایل قبلاً ثبت شده است.'
          })
        }
      }
      user.mobile = mobile // ✅ FIX: تغییر از phoneNumber به mobile
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
    console.error('Error updating user:', error)

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'ایمیل وارد شده قبلاً استفاده شده است.',
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

