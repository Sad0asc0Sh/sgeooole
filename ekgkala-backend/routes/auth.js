const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const Admin = require('../models/Admin')
const redis = require('../utils/redis')
const { sendResetPasswordEmail } = require('../utils/notificationService')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')
const { requireCaptcha } = require('../middleware/requireCaptcha')
const { generateCaptcha } = require('../utils/nativeCaptcha')
const { getPermissions } = require('../config/rbac')
const { upload } = require('../middleware/upload')

const ROLE_LEVELS = {
  user: 1,
  support: 2,
  editor: 3,
  admin: 4,
  manager: 5,
  superadmin: 6,
}
const getRoleLevel = (role) => ROLE_LEVELS[role] || 0

// Joi Validation
const validate = require('../middleware/validate')
const {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  sendOtpSchema,
  verifyOtpSchema,
} = require('../validators/joiSchemas/authSchemas')
const { addressSchema, addressUpdateSchema } = require('../validators/joiSchemas/userSchemas')
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

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set for authentication')
}
const JWT_EXPIRE = process.env.JWT_EXPIRE || '5h'
const JWT_ISSUER = process.env.JWT_ISSUER || 'ekgkala-api'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ekgkala-clients'
const COOKIE_MAX_AGE_MS = Number(process.env.JWT_COOKIE_MAX_AGE || 24 * 60 * 60 * 1000)

// ============================================
// Helper: generate JWT token
// ============================================
const generateToken = (userId, role = 'admin', type = role === 'user' ? 'customer' : 'admin') => {
  return jwt.sign(
    { id: userId, type, role },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRE,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
  )
}

const setAuthCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE_MS,
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

// GET /api/auth/captcha
// Generate native SVG Captcha challenge
router.get('/captcha', async (req, res) => {
  try {
    const result = await generateCaptcha()
    res.json({
      success: true,
      captchaId: result.captchaId,
      svg: result.svg,
      expiresIn: result.expiresIn,
    })
  } catch (err) {
    console.error('[CAPTCHA GENERATE ERROR]', err)
    res.status(500).json({
      success: false,
      message: 'خطا در تولید کد کپچا',
    })
  }
})

// POST /api/auth/send-otp
// Send OTP code to customer mobile number
router.post('/send-otp', requireCaptcha, validate(sendOtpSchema), sendOtp)

// POST /api/auth/verify-otp
// Verify OTP and login customer
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp)

// POST /api/auth/google
// Google Login - Verify Google ID token and login/register user
router.post('/google', googleLogin)

// POST /api/auth/login-password
// Login with username/mobile/email + password
router.post('/login-password', validate(loginSchema), loginWithPassword)

// POST /api/auth/forgot-password
// Send password reset email to customer
router.post('/forgot-password', requireCaptcha, validate(forgotPasswordSchema), forgotPassword)

// PUT /api/auth/reset-password/:token
// Reset customer password using token from email
router.put('/reset-password/:token', validate(resetPasswordSchema), resetPassword)

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
router.put('/me/update', protect, validate(updateProfileSchema), updateProfile)

// POST /api/auth/bind-mobile/send-otp
router.post('/bind-mobile/send-otp', protect, requireCaptcha, sendBindOtp)

// POST /api/auth/bind-mobile/verify
router.post('/bind-mobile/verify', protect, verifyBindOtp)

// POST /api/auth/change-email/send-otp
router.post('/change-email/send-otp', protect, requireCaptcha, sendEmailOtp)

// POST /api/auth/change-email/verify
router.post('/change-email/verify', protect, verifyEmailOtp)

// PUT /api/auth/me/avatar
// Update customer avatar
router.put('/me/avatar', protect, upload.single('avatar'), updateAvatar)

// POST /api/auth/addresses
// Add new address
router.post('/addresses', protect, validate(addressSchema), addAddress)

// PUT /api/auth/addresses/:addressId
// Update address
router.put('/addresses/:addressId', protect, validate(addressUpdateSchema), updateAddress)

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
    } else if (admin.role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'حساب‌های مدیریتی باید از طریق پنل ادمین وارد شوند.',
      })
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

    const tokenType = Array.isArray(allowedRoles) && allowedRoles.length > 0 ? 'admin' : 'customer'
    const token = generateToken(admin._id, admin.role, tokenType)
    const adminData = admin.toJSON()
    const permissions = getPermissions(admin.role || 'guest')

    console.log('Admin login successful:', admin.email)

    setAuthCookie(res, token)

    return res.json({
      success: true,
      message: 'ورود با موفقیت انجام شد.',
      data: {
        user: adminData,
        permissions,
        token,
      },
      accessToken: token,
      expiresIn: JWT_EXPIRE,
    })
  } catch (error) {
    console.error('Error in admin login:', error)
    return res.status(500).json({
      success: false,
      message: 'خطا در ورود به سیستم',
    })
  }
}

// ============================================
// POST /api/auth/admin/login  (admin panel)
// ============================================
router.post(
  '/admin/login',
  makeLoginHandler(['admin', 'manager', 'superadmin', 'editor', 'support']),
)

// ============================================
// POST /api/auth/login  (frontend store)
// ============================================
router.post('/login', makeLoginHandler(null))

// ============================================
// GET /api/auth/me
// ============================================
router.get('/me', protect, async (req, res) => {
  try {
    if (req.userType === 'customer' || req.user.role === 'user') {
      return res.status(403).json({
        success: false,
        message: 'دسترسی به بخش مدیریت مجاز نیست.',
      })
    }

    const permissions = getPermissions(req.user.role || 'guest')

    return res.json({
      success: true,
      data: req.user,
      permissions,
    })
  } catch (error) {
    console.error('Error in /me endpoint:', error)
    return res.status(500).json({
      success: false,
      message: 'خطا در دریافت کاربر فعلی',
    })
  }
})

// ============================================
// POST /api/auth/logout
// ============================================
router.post('/logout', async (req, res) => {
  try {
    let token
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    }
    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/)
      if (match) token = decodeURIComponent(match[1])
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET, {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          algorithms: ['HS256'],
        })
        const remainingSeconds = decoded?.exp
          ? Math.max(1, decoded.exp - Math.floor(Date.now() / 1000))
          : 86400
        await redis.blacklistToken(token, remainingSeconds)
      } catch (_) {
        // Ignore invalid/expired token on logout
      }
    }

    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    })

    return res.json({
      success: true,
      message: 'خروج با موفقیت انجام شد.',
    })
  } catch (error) {
    console.error('Error in logout:', error)
    return res.status(500).json({
      success: false,
      message: 'خطا در خروج از سیستم',
    })
  }
})

// ============================================
// ============================================
// POST /api/auth/register
// ============================================

router.post('/register', protect, checkPermission(PERMISSIONS.ADMIN_CREATE), async (req, res) => {
  try {
    const { name, email, password, role } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'نام، ایمیل و رمز عبور الزامی است.',
      })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const existingAdmin = await Admin.findOne({ email: normalizedEmail })

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'کاربری با این ایمیل قبلاً ثبت شده است.',
      })
    }

    const allowedRoles = ['admin', 'manager', 'superadmin', 'editor', 'support']
    const safeRole = allowedRoles.includes(role) ? role : 'admin'
    const actorRole = req.user?.role || 'user'

    if (actorRole !== 'superadmin' && getRoleLevel(safeRole) >= getRoleLevel(actorRole)) {
      return res.status(403).json({
        success: false,
        message: 'نمی‌توانید نقشی هم‌سطح یا بالاتر از خود اختصاص دهید.',
      })
    }

    const admin = await Admin.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      role: safeRole,
    })

    console.log('Admin registered:', admin.email)

    return res.status(201).json({
      success: true,
      message: 'کاربر ادمین با موفقیت ایجاد شد.',
      data: {
        user: admin,
      },
    })
  } catch (error) {
    console.error('Error in admin registration:', error)
    return res.status(500).json({
      success: false,
      message: 'خطا در ثبت‌نام ادمین',
    })
  }
})
// POST /api/auth/admin/forgot-password
// درخواست بازنشانی رمز عبور (ارسال ایمیل)
// ============================================
router.post('/admin/forgot-password', requireCaptcha, async (req, res) => {
  const genericResponse = {
    success: true,
    message: 'در صورت ثبت بودن ایمیل در سیستم مدیریتی، لینک بازنشانی رمز عبور ارسال می‌شود.',
  }

  try {
    const { email } = req.body

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'ایمیل الزامی است.',
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // پیدا کردن کاربر ادمین با این ایمیل
    const user = await Admin.findOne({
      email: normalizedEmail,
      role: { $in: ['admin', 'manager', 'superadmin', 'editor', 'support'] },
      isActive: true,
    })

    if (!user) {
      return res.status(200).json(genericResponse)
    }

    // ایجاد توکن بازنشانی
    const resetToken = user.getResetPasswordToken()

    // ذخیره کاربر با توکن
    await user.save({ validateBeforeSave: false })

    // ساخت URL بازنشانی
    const resetUrl = `${process.env.ADMIN_URL || 'http://localhost:3001'}/reset-password/${resetToken}`

    try {
      await sendResetPasswordEmail(user.email, user.name, resetUrl)
    } catch (emailError) {
      console.error('Error sending admin reset password email:', emailError.message)
      user.resetPasswordToken = undefined
      user.resetPasswordExpire = undefined
      await user.save({ validateBeforeSave: false })
    }

    return res.status(200).json(genericResponse)
  } catch (error) {
    console.error('Error in forgot password:', error)
    return res.status(500).json({
      success: false,
      message: 'خطا در پردازش درخواست بازنشانی رمز عبور.',
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

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'رمز عبور جدید الزامی است.',
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.',
      })
    }

    // هش کردن توکن دریافتی از URL
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(String(req.params.token || ''))
      .digest('hex')

    // پیدا کردن کاربر با توکن و زمان معتبر
    const user = await Admin.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }, // توکن هنوز منقضی نشده
      role: { $in: ['admin', 'manager', 'superadmin', 'editor', 'support'] },
      isActive: true,
    }).select('+password +resetPasswordToken +resetPasswordExpire')

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
    })
  }
})

// ============================================
// PUT /api/auth/admin/profile
// به‌روزرسانی پروفایل ادمین (نام، ایمیل، رمز عبور)
// ============================================
router.put('/admin/profile', protect, async (req, res) => {
  try {
    if (req.userType === 'customer' || req.user.role === 'user') {
      return res.status(403).json({
        success: false,
        message: 'شما دسترسی لازم برای این عملیات را ندارید.',
      })
    }

    const admin = await Admin.findById(req.user._id).select('+password')

    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'کاربر ادمین یافت نشد یا غیرفعال است.',
      })
    }

    // بررسی نقش ادمین
    const adminRoles = ['admin', 'manager', 'superadmin', 'editor', 'support']
    if (!adminRoles.includes(admin.role)) {
      return res.status(403).json({
        success: false,
        message: 'شما دسترسی لازم برای این عملیات را ندارید.',
      })
    }

    const { name, email, password, currentPassword } = req.body

    // به‌روزرسانی نام
    if (name && typeof name === 'string' && name.trim()) {
      admin.name = name.trim()
    }

    // به‌روزرسانی ایمیل (با بررسی یکتایی)
    if (email && typeof email === 'string' && email.trim() && email.trim().toLowerCase() !== admin.email) {
      const normalizedEmail = email.trim().toLowerCase()
      const existingAdmin = await Admin.findOne({ email: normalizedEmail, _id: { $ne: admin._id } })
      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          message: 'این ایمیل قبلاً توسط کاربر دیگری استفاده شده است.',
        })
      }
      admin.email = normalizedEmail
    }

    let passwordUpdated = false
    // به‌روزرسانی رمز عبور (با تایید رمز فعلی)
    if (password && typeof password === 'string' && password.trim()) {
      if (!currentPassword || typeof currentPassword !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'برای تغییر رمز عبور، وارد کردن رمز عبور فعلی الزامی است.',
        })
      }
      const isCurrentValid = await admin.comparePassword(currentPassword)
      if (!isCurrentValid) {
        return res.status(401).json({
          success: false,
          message: 'رمز عبور فعلی نادرست است.',
        })
      }
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.',
        })
      }
      admin.password = password
      passwordUpdated = true
    }

    await admin.save()

    console.log('Admin profile updated:', admin.email)

    const responsePayload = {
      success: true,
      message: 'پروفایل با موفقیت به‌روزرسانی شد.',
      data: admin.toJSON(),
    }

    if (passwordUpdated) {
      const newToken = generateToken(admin._id, admin.role, 'admin')
      setAuthCookie(res, newToken)
      responsePayload.token = newToken
    }

    res.status(200).json(responsePayload)
  } catch (error) {
    console.error('Error updating admin profile:', error)

    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی پروفایل.',
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
