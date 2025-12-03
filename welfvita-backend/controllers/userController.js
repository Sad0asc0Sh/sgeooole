// ✅ FIX: Use correct User model (Customer model, not Admin model)
const User = require('../models/User')

// Role hierarchy used for safety checks
const ROLE_LEVELS = {
  user: 1,
  manager: 2,
  admin: 3,
  superadmin: 4,
}

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

    // By default, this endpoint is used for customers (role = user)
    const allowedRoles = ['user', 'admin', 'manager', 'superadmin']
    if (req.query.role && allowedRoles.includes(req.query.role)) {
      filter.role = req.query.role
    } else {
      filter.role = 'user'
    }

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
    const { name, email, phoneNumber, isActive, role } = req.body || {}

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

    // For non-superadmin, this endpoint is only for regular customers (role = user)
    if (!isSuperAdmin && user.role !== 'user') {
      return res.status(403).json({
        success: false,
        message:
          'فقط superadmin می‌تواند اطلاعات ادمین‌ها و مدیران را ویرایش کند.',
      })
    }

    // Never allow editing someone with higher role level
    if (targetCurrentLevel > currentLevel) {
      return res.status(403).json({
        success: false,
        message: 'اجازه ویرایش کاربری با سطح دسترسی بالاتر را ندارید.',
      })
    }

    // Role change rules
    if (role !== undefined) {
      const newRoleLevel = ROLE_LEVELS[role]

      if (!newRoleLevel) {
        return res.status(400).json({
          success: false,
          message: 'نقش ارسال‌شده معتبر نیست.',
        })
      }

      // Non-superadmin cannot change role at all (even از user به admin/manager)
      if (!isSuperAdmin && role !== user.role) {
        return res.status(403).json({
          success: false,
          message:
            'فقط superadmin می‌تواند نقش کاربران را به admin/manager/superadmin تغییر دهد.',
        })
      }

      // Superadmin cannot promote someone above their own level (theoretically)
      if (isSuperAdmin && newRoleLevel > currentLevel) {
        return res.status(403).json({
          success: false,
          message: 'امکان ارتقای نقش به سطحی بالاتر از superadmin وجود ندارد.',
        })
      }

      user.role = role
    }

    if (name !== undefined) user.name = name
    if (email !== undefined) user.email = email
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber
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

