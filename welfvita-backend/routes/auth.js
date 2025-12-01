const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const Admin = require('../models/Admin')
const { sendResetPasswordEmail } = require('../utils/notificationService')
const { protect } = require('../middleware/auth')
const { upload } = require('../middleware/upload')
// const { updateMyProfile, updateMyAvatar } = require('../controllers/authController') // REMOVED: This was for Admin
const {
  sendOtp,
  verifyOtp,
  getProfile: getCustomerProfile,
  googleLogin,
  completeProfile,
  loginWithPassword,
  forgotPassword,
  resetPassword,
  updateProfile, // NEW
  updateAvatar, // NEW
  addAddress, // NEW
  updateAddress, // NEW
  deleteAddress, // NEW
  sendBindOtp, // NEW
  verifyBindOtp, // NEW
  sendEmailOtp,
  verifyEmailOtp,
} = require('../controllers/customerAuthController')

console.log('DEBUG: sendEmailOtp type:', typeof sendEmailOtp);

// JWT configuration
const JWT_SECRET =
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
// مدت اعتبار توکن (پیش‌فرض ۹۰ دقیقه)
const JWT_EXPIRE = process.env.JWT_EXPIRE || '5h'

// ============================================
// Helper: generate JWT token
// ============================================
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  })
}

// ============================================
// CUSTOMER AUTHENTICATION ROUTES (OTP-based)
// ============================================

// Debug Middleware
router.use((req, res, next) => {
  console.log(`[AUTH ROUTER] ${req.method} ${req.path}`)
  next()
})

// POST /api/auth/send-otp
// Send OTP code to customer mobile number
router.post('/send-otp', sendOtp)

// POST /api/auth/verify-otp
// Verify OTP and login customer
router.post('/verify-otp', verifyOtp)

// POST /api/auth/google
// Google Login - Verify Google ID token and login/register user
router.post('/google', googleLogin)

// POST /api/auth/login-password
// Login with username/mobile/email + password
router.post('/login-password', loginWithPassword)

// POST /api/auth/forgot-password
// Send password reset email to customer
router.post('/forgot-password', forgotPassword)

// PUT /api/auth/reset-password/:token
// Reset customer password using token from email
router.put('/reset-password/:token', resetPassword)

// PUT /api/auth/complete-profile
// Complete profile by setting password and username (requires authentication)
router.put('/complete-profile', protect, completeProfile)

// GET /api/auth/profile
// Get customer profile (requires authentication)
router.get('/profile', protect, getCustomerProfile)

// ============================================
// CUSTOMER PROFILE & ADDRESS ROUTES
// ============================================

// PUT /api/auth/me/update
// Update customer profile (name, email, password)
router.put('/me/update', protect, updateProfile)

// POST /api/auth/bind-mobile/send-otp
router.post('/bind-mobile/send-otp', protect, sendBindOtp)

// POST /api/auth/bind-mobile/verify
router.post('/bind-mobile/verify', protect, verifyBindOtp)

// POST /api/auth/change-email/send-otp
router.post('/change-email/send-otp', protect, sendEmailOtp)

// POST /api/auth/change-email/verify
router.post('/change-email/verify', protect, verifyEmailOtp)

// PUT /api/auth/me/avatar
// Update customer avatar
router.put('/me/avatar', protect, upload.single('avatar'), updateAvatar)

// POST /api/auth/addresses
// Add new address
router.post('/addresses', protect, addAddress)

// PUT /api/auth/addresses/:addressId
// Update address
router.put('/addresses/:addressId', protect, updateAddress)

// DELETE /api/auth/addresses/:addressId
// Delete address
router.delete('/addresses/:addressId', protect, deleteAddress)


// ============================================
// ADMIN AUTHENTICATION ROUTES (Email/Password)
// ============================================

// ============================================
// Shared login handler with optional role check
// ============================================
const makeLoginHandler = (allowedRoles) => async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'ایمیل و رمز عبور الزامی است.',
      })
    }

    const admin = await Admin.findOne({ email }).select('+password')

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'ایمیل یا رمز عبور نادرست است.',
      })
    }

    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'حساب کاربری ادمین غیرفعال است.',
      })
    }

    // If allowedRoles is provided, enforce role check (for admin login)
    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      if (!allowedRoles.includes(admin.role)) {
        return res.status(403).json({
          success: false,
          message: 'شما دسترسی لازم برای ورود به پنل ادمین را ندارید.',
        })
      }
    }

    const isPasswordMatch = await admin.comparePassword(password)

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'ایمیل یا رمز عبور نادرست است.',
      })
    }

    admin.lastLogin = new Date()
    await admin.save()

    const token = generateToken(admin._id)
    const adminData = admin.toJSON()

    console.log('Admin login successful:', admin.email)

    return res.json({
      success: true,
      message: 'ورود با موفقیت انجام شد.',
      data: {
        user: adminData,
        token,
      },
      accessToken: token,
      expiresIn: JWT_EXPIRE,
    })
  } catch (error) {
    console.error('Error in admin login:', error)
    return res.status(500).json({
      success: false,
      message: `خطا در ورود به سیستم: ${error.message}`,
      error: error.message,
    })
  }
}

// ============================================
// POST /api/auth/admin/login  (admin panel)
// ============================================
router.post(
  '/admin/login',
  makeLoginHandler(['admin', 'manager', 'superadmin']),
)

// ============================================
// POST /api/auth/login  (frontend store)
// ============================================
router.post('/login', makeLoginHandler(null))

// ============================================
// GET /api/auth/me
// ============================================
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'توکن ارسال نشده است.',
      })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET)

    const admin = await Admin.findById(decoded.id)

    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'کاربر ادمین یافت نشد یا غیرفعال است.',
      })
    }

    return res.json({
      success: true,
      data: admin,
    })
  } catch (error) {
    console.error('Error in /me endpoint:', error)

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'توکن نامعتبر است.',
      })
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'توکن منقضی شده است - لطفاً مجدداً وارد شوید.',
      })
    }

    return res.status(500).json({
      success: false,
      message: 'خطا در دریافت کاربر فعلی',
      error: error.message,
    })
  }
})

// ============================================
// POST /api/auth/register
// ============================================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'نام، ایمیل و رمز عبور الزامی است.',
      })
    }

    const existingAdmin = await Admin.findOne({ email })

    if (existingAdmin) {
      const token = generateToken(existingAdmin._id)
      console.log(
        'Account already exists, returning success:',
        existingAdmin.email,
      )

      return res.status(200).json({
        success: true,
        message: 'حساب کاربری قبلاً ایجاد شده است.',
        data: {
          user: existingAdmin,
          token,
        },
        accessToken: token,
        expiresIn: JWT_EXPIRE,
      })
    }

    const admin = await Admin.create({
      name,
      email,
      password,
      role: 'user',
    })

    const token = generateToken(admin._id)

    console.log('Admin registered:', admin.email)

    return res.status(201).json({
      success: true,
      message: 'ادمین با موفقیت ثبت شد.',
      data: {
        user: admin,
        token,
      },
      accessToken: token,
      expiresIn: JWT_EXPIRE,
    })
  } catch (error) {
    console.error('Error in admin registration:', error)
    return res.status(500).json({
      success: false,
      message: 'خطا در ثبت ادمین',
      error: error.message,
    })
  }
})

// ============================================
// POST /api/auth/admin/forgot-password
// درخواست بازنشانی رمز عبور (ارسال ایمیل)
// ============================================
router.post('/admin/forgot-password', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'ایمیل الزامی است.',
      })
    }

    // پیدا کردن کاربر ادمین با این ایمیل
    const user = await Admin.findOne({
      email,
      role: { $in: ['admin', 'manager', 'superadmin'] },
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربر ادمین با این ایمیل یافت نشد.',
      })
    }

    // ایجاد توکن بازنشانی
    const resetToken = user.getResetPasswordToken()

    // ذخیره کاربر با توکن
    await user.save({ validateBeforeSave: false })

    // ساخت URL بازنشانی
    // برای پنل ادمین که روی پورت 3000 اجرا می‌شود
    const resetUrl = `${process.env.ADMIN_URL || 'http://localhost:3000'}/reset-password/${resetToken}`

    // ارسال ایمیل
    await sendResetPasswordEmail(user.email, user.name, resetUrl)

    res.status(200).json({
      success: true,
      message: 'ایمیل بازنشانی رمز عبور با موفقیت ارسال شد. لطفاً صندوق ورودی خود را بررسی کنید.',
    })
  } catch (error) {
    console.error('Error in forgot password:', error)

    // در صورت خطا، توکن را پاک کنیم
    if (req.body.email) {
      const user = await Admin.findOne({ email: req.body.email })
      if (user) {
        user.resetPasswordToken = undefined
        user.resetPasswordExpire = undefined
        await user.save({ validateBeforeSave: false })
      }
    }

    res.status(500).json({
      success: false,
      message: 'خطا در ارسال ایمیل بازنشانی رمز عبور. لطفاً دوباره تلاش کنید.',
      error: error.message,
    })
  }
})

// ============================================
// PUT /api/auth/admin/reset-password/:token
// بازنشانی رمز عبور با استفاده از توکن
// ============================================
router.put('/admin/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'رمز عبور جدید الزامی است.',
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.',
      })
    }

    // هش کردن توکن دریافتی از URL
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex')

    // پیدا کردن کاربر با توکن و زمان معتبر
    const user = await Admin.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }, // توکن هنوز منقضی نشده
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'توکن نامعتبر یا منقضی شده است. لطفاً دوباره درخواست دهید.',
      })
    }

    // تنظیم رمز عبور جدید (pre-save hook آن را هش می‌کند)
    user.password = password
    user.resetPasswordToken = undefined
    user.resetPasswordExpire = undefined

    await user.save()

    console.log('Password reset successful for:', user.email)

    res.status(200).json({
      success: true,
      message: 'رمز عبور با موفقیت تغییر کرد. اکنون می‌توانید با رمز جدید وارد شوید.',
    })
  } catch (error) {
    console.error('Error in reset password:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در بازنشانی رمز عبور. لطفاً دوباره تلاش کنید.',
      error: error.message,
    })
  }
})

// ============================================
// PUT /api/auth/me/update
// به‌روزرسانی اطلاعات پروفایل (نام، ایمیل، رمز عبور)
// ============================================
// router.put('/me/update', protect, updateMyProfile) // REMOVED: Replaced by customerAuthController.updateProfile

// ============================================
// PUT /api/auth/me/avatar
// به‌روزرسانی آواتار کاربر
// ============================================
// router.put('/me/avatar', protect, upload.single('avatar'), updateMyAvatar) // REMOVED: Replaced by customerAuthController.updateAvatar

module.exports = router
