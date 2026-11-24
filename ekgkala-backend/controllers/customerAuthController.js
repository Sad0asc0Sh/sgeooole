const crypto = require('crypto')
const { uploadToParsPack, deleteFromParsPack } = require('../lib/parspackS3')
const jwt = require('jsonwebtoken')
const axios = require('axios')
const { OAuth2Client } = require('google-auth-library')
const User = require('../models/User')
const OTP = require('../models/OTP')
const Order = require('../models/Order')
const { sendVerificationEmail, sendOtpSMS, getSmsSettings } = require('../utils/notificationService')
const { normalizeIranMobile } = require('../utils/phone')
const { isValidNationalCode, isValidSheba } = require('../utils/validators')
const { getClientIp } = require('../utils/clientIp')
const { checkIpRateLimit, recordIpRequest, inspectBotTelemetry } = require('../middleware/botProtection')

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set for customer auth')
}
const JWT_EXPIRE = process.env.JWT_EXPIRE_CUSTOMER || '30d'
const JWT_ISSUER = process.env.JWT_ISSUER || 'ekgkala-api'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ekgkala-clients'
const COOKIE_MAX_AGE_MS = Number(process.env.JWT_COOKIE_MAX_AGE || 24 * 60 * 60 * 1000)

// Google OAuth Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const OTP_SITE_WIDE_HOURLY_CAP = Number(process.env.OTP_SITE_WIDE_HOURLY_CAP || 80);

async function checkSiteWideOtpCircuitBreaker() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await OTP.countDocuments({ createdAt: { $gte: oneHourAgo } });
  if (count >= OTP_SITE_WIDE_HOURLY_CAP) {
    return {
      allowed: false,
      count,
      message: 'محدودیت کل سایت برای ارسال کد فعال شده است. لطفاً دقایقی دیگر تلاش کنید.',
    };
  }
  return { allowed: true };
}

// Helpers
const generateToken = (userId) =>
  jwt.sign({ id: userId, type: 'customer' }, JWT_SECRET, { expiresIn: JWT_EXPIRE, issuer: JWT_ISSUER, audience: JWT_AUDIENCE })

const hashOtpCode = (code) =>
  crypto.createHash('sha256').update(String(code || '').trim()).digest('hex')

const verifyOtpHash = (storedValue, submittedCode) => {
  const normalizedStored = String(storedValue || '')
  const submittedHash = hashOtpCode(submittedCode)
  const expectedHash = /^[a-f0-9]{64}$/i.test(normalizedStored)
    ? normalizedStored.toLowerCase()
    : hashOtpCode(normalizedStored)
  return crypto.timingSafeEqual(
    Buffer.from(submittedHash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  )
}

const STRICT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const setAuthCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE_MS,
  })
}

// ======================
// OTP: Send code
// ======================
exports.sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;
    const clientIp = getClientIp(req);

    if (!mobile || !/^09\d{9}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'شماره موبایل نامعتبر است'
      });
    }

    // 0. Check Site-wide Circuit Breaker
    const siteWideCheck = await checkSiteWideOtpCircuitBreaker();
    if (!siteWideCheck.allowed) {
      console.warn(`[SITE-WIDE OTP CIRCUIT BREAKER] Tripped with ${siteWideCheck.count} OTPs sent in last hour. Blocked attempt for ${mobile}`);
      return res.status(429).json({
        success: false,
        message: siteWideCheck.message,
        code: 'SITE_WIDE_LIMIT_REACHED',
      });
    }

    // 1. Silent Trap: Check Honeypot & Bot Telemetry
    const botCheck = inspectBotTelemetry(req);
    if (botCheck.isBot) {
      console.warn(`[OTP BOT TRAP] Bot detected from IP ${clientIp} for mobile ${mobile}. Reason: ${botCheck.reason}`);
      // Tricking bot with Silent Success (No SMS sent)
      return res.json({
        success: true,
        message: 'کد تایید ارسال شد',
        expiresIn: 120
      });
    }

    // 2. Silent Trap: Check IP-level Rate Limit
    const ipLimit = checkIpRateLimit(clientIp);
    if (!ipLimit.allowed) {
      console.warn(`[OTP IP RATE LIMIT] Limit exceeded for IP ${clientIp} (${ipLimit.reason}). Silent success returned.`);
      return res.json({
        success: true,
        message: 'کد تایید ارسال شد',
        expiresIn: 120
      });
    }

    // 3. Check Mobile-level Rate Limit
    const rateLimit = await OTP.checkRateLimit(mobile);
    if (!rateLimit.allowed) {
      if (rateLimit.reason === 'cooldown') {
        // Active 90s cooldown period for the exact same user/number
        return res
          .status(429)
          .set('Retry-After', String(Math.max(rateLimit.retryAfter || 90, 1)))
          .json({ success: false, message: rateLimit.message, reason: rateLimit.reason });
      } else {
        // Daily/hourly limit exceeded for this mobile number -> Silent success trap
        console.warn(`[OTP MOBILE RATE LIMIT] Mobile ${mobile} hit limit (${rateLimit.reason}). Silent success returned.`);
        return res.json({
          success: true,
          message: 'کد تایید ارسال شد',
          expiresIn: 120
        });
      }
    }

    await OTP.cleanupOld(mobile);

    const code = String(crypto.randomInt(1000, 10000));
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    const otpRecord = new OTP({
      mobile,
      code: hashOtpCode(code),
      expiresAt,
      verified: false,
      attempts: 0
    });
    await otpRecord.save();
    recordIpRequest(clientIp);

    console.log('[OTP] Code saved and SMS sent for ' + mobile + ' from IP ' + clientIp);

    res.json({
      success: true,
      message: 'کد تایید ارسال شد',
      expiresIn: 120
    });

    sendOtpSMS(mobile, code).catch((err) => {
      console.error('[OTP] Background SMS failed for ' + mobile + ':', err.message);
    });

  } catch (error) {
    console.error('[OTP] Error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'خطا در ارسال کد تایید'
      });
    }
  }
};


exports.verifyOtp = async (req, res) => {
  try {
    const { mobile, code } = req.body
    if (!mobile || !code) {
      return res.status(400).json({ success: false, message: 'ورودی نامعتبر است.' })
    }
    if (!/^09\d{9}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: 'شماره موبایل نامعتبر است.' })
    }
    const normalizedCode = String(code).trim()
    if (normalizedCode.length !== 4 || !/^\d{4}$/.test(normalizedCode)) {
      return res.status(400).json({ success: false, message: 'کد باید ۴ رقمی باشد.' })
    }

    const now = new Date()
    const otp = await OTP.findOne({
      mobile,
      verified: false,
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 })

    if (!otp) {
      return res.status(400).json({ success: false, message: 'کد وارد شده معتبر نیست.' })
    }

    if (otp.attempts >= 3) {
      return res.status(400).json({ success: false, message: 'تعداد تلاش بیش از حد مجاز.' })
    }

    if (!verifyOtpHash(otp.code, normalizedCode)) {
      const nextAttempts = (otp.attempts || 0) + 1
      await OTP.updateOne(
        { _id: otp._id },
        {
          $inc: { attempts: 1 },
          ...(nextAttempts >= 3 ? { $set: { expiresAt: new Date() } } : {}),
        }
      )
      return res.status(400).json({
        success: false,
        message: nextAttempts >= 3 ? 'تعداد تلاش بیش از حد مجاز.' : 'کد وارد شده معتبر نیست.',
      })
    }

    const claimedOtp = await OTP.findOneAndUpdate(
      { _id: otp._id, verified: false, attempts: { $lt: 3 }, expiresAt: { $gt: new Date() } },
      { $set: { verified: true }, $inc: { attempts: 1 } },
      { new: true }
    )
    if (!claimedOtp) {
      return res.status(400).json({ success: false, message: 'کد وارد شده معتبر نیست.' })
    }

    let user = await User.findOne({ mobile }).select('+password')
    if (user && user.role && user.role !== 'user') {
      return res.status(403).json({ success: false, message: 'ورود حساب‌های مدیریتی از طریق OTP مجاز نیست.' })
    }
    if (user && !user.isActive) {
      return res.status(403).json({ success: false, message: 'حساب کاربری غیرفعال است.' })
    }
    if (!user) {
      user = new User({
        mobile,
        name: 'کاربر فروشگاه',
        wallet: 0,
        role: 'user',
        isActive: true,
      })
      await user.save()
      console.log(`[AUTH] New user created: ${mobile}`)
    }

    await user.updateLastLogin()
    const token = generateToken(user._id)
    await OTP.cleanupOld(mobile)

    // Check if user has completed profile (has password set)
    const isProfileComplete = !!user.password

    console.log(`[AUTH] User logged in: ${mobile}, Profile Complete: ${isProfileComplete}`)

    setAuthCookie(res, token)

    res.json({
      success: true,
      message: 'ورود موفق.',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          wallet: user.wallet,
          role: user.role,
          isActive: user.isActive,
          username: user.username,
          googleId: user.googleId,
        },
        token,
        isProfileComplete,
      },
      token,
      isProfileComplete,
    })
  } catch (error) {
    console.error('Error verifying OTP:', error)
    res.status(500).json({ success: false, message: 'خطا در تأیید کد', error: error.message })
  }
}

// ======================
// Profile
// ======================
exports.getProfile = async (req, res) => {
  try {
    const userId = req.userId || (req.user && req.user._id)

    const user = await User.findById(userId).select('+password')
    if (!user) {
      return res.status(404).json({ success: false, message: 'کاربر پیدا نشد.' })
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'حساب کاربری غیرفعال است.' })
    }

    const [pendingCount, processingCount, deliveredCount, cancelledCount] = await Promise.all([
      Order.countDocuments({
        user: user._id,
        orderStatus: 'Pending',
      }),
      Order.countDocuments({
        user: user._id,
        orderStatus: { $in: ['Processing', 'Shipped'] },
      }),
      Order.countDocuments({
        user: user._id,
        orderStatus: 'Delivered',
      }),
      Order.countDocuments({
        user: user._id,
        orderStatus: 'Cancelled',
      }),
    ])

    // Return complete user profile including personal and legal info
    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        wallet: user.wallet,
        walletBalance: user.wallet,
        role: user.role,
        isActive: user.isActive,
        isMashhadPickupEligible: Boolean(user.isMashhadPickupEligible),
        addresses: user.addresses,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        googleId: user.googleId,
        avatar: user.avatar,
        username: user.username,
        hasPassword: Boolean(user.password),
         // Personal Info
         nationalCode: user.nationalCode,
         birthDate: user.birthDate,
         gender: user.gender,
         birthPlace: user.birthPlace,
         landline: user.landline,
         secondMobile: user.secondMobile,
         province: user.province,
         city: user.city,
         shebaNumber: user.shebaNumber,
        // Legal Entity Info
        isLegal: user.isLegal,
        companyName: user.companyName,
        companyNationalId: user.companyNationalId,
        companyRegistrationId: user.companyRegistrationId,
        companyLandline: user.companyLandline,
        companyProvince: user.companyProvince,
        companyCity: user.companyCity,
        orderStats: {
          pending: pendingCount,
          processing: processingCount,
          delivered: deliveredCount,
          cancelled: cancelledCount,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    res.status(500).json({ success: false, message: 'خطا در دریافت پروفایل', error: error.message })
  }
}

// ======================
// Google Login
// ======================
exports.googleLogin = async (req, res) => {
  try {
    const { token } = req.body

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'توکن گوگل ارسال نشده است.' })
    }

    const googleClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim()
    if (!googleClientId || googleClientId.startsWith('CHANGE_ME')) {
      return res.status(503).json({ success: false, message: 'ورود با گوگل روی سرور پیکربندی نشده است.' })
    }

    let ticket
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: googleClientId,
      })
    } catch (error) {
      console.error('[GOOGLE AUTH] Token verification failed:', error?.message || error)
      return res.status(401).json({ success: false, message: 'توکن گوگل نامعتبر است.' })
    }

    const payload = ticket.getPayload()
    if (!payload || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ success: false, message: 'ایمیل حساب گوگل تایید نشده است.' })
    }

    const { sub: googleId, email, name, picture } = payload
    const normalizedEmail = String(email).trim().toLowerCase()

    // Strict Email-based Login (customers only)
    let user = await User.findOne({ email: normalizedEmail }).select('+password')

    if (user) {
      if (user.role && user.role !== 'user') {
        return res.status(403).json({ success: false, message: 'ورود حساب‌های مدیریتی از طریق گوگل مجاز نیست.' })
      }
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'حساب کاربری غیرفعال است.' })
      }

      let updated = false

      // Link Google ID if not present
      if (!user.googleId) {
        user.googleId = googleId
        updated = true
      } else if (user.googleId !== googleId) {
        console.warn(`[GOOGLE AUTH] Updating Google ID for ${normalizedEmail}`)
        user.googleId = googleId
        updated = true
      }

      // Sync Avatar
      if (picture && user.avatar !== picture) {
        user.avatar = picture
        updated = true
      }

      // Sync Name if missing or default
      if (!user.name || user.name === 'کاربر فروشگاه') {
        user.name = name || user.name
        updated = true
      }

      if (updated) {
        await user.save()
      }
    } else {
      // Create new user
      user = new User({
        googleId,
        email: normalizedEmail,
        name: name || 'کاربر فروشگاه',
        avatar: picture,
        wallet: 0,
        role: 'user',
        isActive: true,
      })
      await user.save()
    }

    await user.updateLastLogin()

    const appToken = generateToken(user._id)

    // Check if user has completed profile (has password set)
    const isProfileComplete = !!user.password

    console.log(`[GOOGLE AUTH] User logged in: ${email}, Profile Complete: ${isProfileComplete}`)

    setAuthCookie(res, appToken)

    res.json({
      success: true,
      message: 'ورود با گوگل موفق بود.',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          avatar: user.avatar,
          wallet: user.wallet,
          role: user.role,
          isActive: user.isActive,
          username: user.username,
          googleId: user.googleId,
        },
        token: appToken,
        isProfileComplete,
      },
      token: appToken,
      isProfileComplete,
    })
  } catch (error) {
    console.error('[GOOGLE AUTH] Error:', error)
    res.status(500).json({ success: false, message: `خطا در ورود با گوگل: ${error.message}`, error: error.message })
  }
}

// ======================
// Complete Profile (Set Password, Username, Name)
// ======================
exports.completeProfile = async (req, res) => {
  try {
    const { firstName, lastName, password, currentPassword } = req.body
    const userId = req.userId || (req.user && req.user._id)

    if (!userId) {
      return res.status(401).json({ success: false, message: 'احراز هویت نشده است.' })
    }

    // Validation
    if (!firstName || !lastName || !password) {
      return res.status(400).json({ success: false, message: 'نام، نام خانوادگی و رمز عبور الزامی است.' })
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, message: 'رمز عبور باید حداقل 6 کاراکتر باشد.' })
    }

    const user = await User.findById(userId).select('+password')
    if (!user) {
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' })
    }

    if (user.password) {
      if (!currentPassword || typeof currentPassword !== 'string') {
        return res.status(400).json({ success: false, message: 'برای تغییر رمز عبور، رمز فعلی الزامی است.' })
      }
      const isCurrentValid = await user.comparePassword(currentPassword)
      if (!isCurrentValid) {
        return res.status(401).json({ success: false, message: 'رمز عبور فعلی اشتباه است.' })
      }
    }

    // Update user
    user.name = `${String(firstName).trim()} ${String(lastName).trim()}`
    user.password = password // Will be hashed by pre-save hook

    await user.save()

    const freshToken = generateToken(user._id)
    setAuthCookie(res, freshToken)

    console.log(`[AUTH] Profile completed for user: ${user._id}`)

    res.json({
      success: true,
      message: 'پروفایل با موفقیت تکمیل شد.',
      token: freshToken,
      data: {
        token: freshToken,
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          mobile: user.mobile,
          email: user.email,
          wallet: user.wallet,
          role: user.role,
          isActive: user.isActive,
          hasPassword: true,
        },
      },
    })
  } catch (error) {
    console.error('Error completing profile:', error)
    res.status(500).json({ success: false, message: 'خطا در تکمیل پروفایل' })
  }
}

// ======================
// Login with Password (Username/Mobile/Email + Password)
// ======================
exports.loginWithPassword = async (req, res) => {
  try {
    const { identifier, password } = req.body

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'نام کاربری/موبایل و رمز عبور الزامی است.' })
    }

    const identifierString = String(identifier).trim();

    // Find user by username, mobile, or email
    const user = await User.findOne({
      $or: [
        { username: identifierString.toLowerCase() },
        { mobile: identifierString },
        { email: identifierString.toLowerCase() },
      ],
    }).select('+password')

    if (!user || !user.isActive || !user.password) {
      return res.status(401).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' })
    }

    if (user.role && user.role !== 'user') {
      return res.status(403).json({ success: false, message: 'لطفاً از طریق پنل مدیریت وارد شوید.' })
    }

    // Compare password
    const isPasswordMatch = await user.comparePassword(password)
    if (!isPasswordMatch) {
      return res.status(401).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' })
    }

    await user.updateLastLogin()
    const token = generateToken(user._id)

    console.log(`[AUTH] User logged in with password: ${identifier}`)

    setAuthCookie(res, token)

    res.json({
      success: true,
      message: 'ورود موفق.',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          username: user.username,
          mobile: user.mobile,
          email: user.email,
          wallet: user.wallet,
          role: user.role,
          isActive: user.isActive,
          googleId: user.googleId,
        },
        token,
        isProfileComplete: true,
      },
      token,
      isProfileComplete: true,
    })
  } catch (error) {
    console.error('Error in password login:', error)
    res.status(500).json({ success: false, message: 'خطا در ورود به سیستم. لطفا مجددا تلاش کنید.' })
  }
}

// Forgot Password
// ======================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'ایمیل الزامی است.',
      })
    }

    // Find customer user by email (never allow staff reset via customer endpoint)
    const user = await User.findOne({ email: String(email).trim().toLowerCase(), role: 'user', isActive: true })

    if (!user) {
      // Uniform response to prevent account/status enumeration
      return res.status(200).json({
        success: true,
        message: 'اگر این ایمیل در سیستم وجود داشته باشد، لینک بازیابی برای شما ارسال می‌شود.',
      })
    }

    // Generate reset token
    const resetToken = user.getResetPasswordToken()

    // Save user with token
    await user.save({ validateBeforeSave: false })

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`

    // RESPOND IMMEDIATELY - Don't wait for email to send
    res.status(200).json({
      success: true,
      message: 'اگر این ایمیل در سیستم وجود داشته باشد، لینک بازیابی برای شما ارسال می‌شود.',
    })

    // Send email in background (fire-and-forget)
    const { sendResetPasswordEmail } = require('../utils/notificationService')
    sendResetPasswordEmail(user.email, user.name, resetUrl)
      .then(() => {
        console.log(`[AUTH] Password reset email sent to: ${email}`)
      })
      .catch((emailError) => {
        console.error('[AUTH] Failed to send password reset email:', emailError.message)
        // Clean up token since email failed
        User.findByIdAndUpdate(user._id, {
          $unset: { resetPasswordToken: 1, resetPasswordExpire: 1 }
        }).catch(() => { })
      })

  } catch (error) {
    console.error('Error in forgot password:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در پردازش درخواست. لطفاً دوباره تلاش کنید.',
      error: error.message,
    })
  }
}

// ======================
// Reset Password
// ======================
exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body
    const { token } = req.params

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

    // Hash token to compare with database
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')

    // Find user by token and check if token is not expired (customers only)
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
      role: 'user',
      isActive: true,
    }).select('+password +resetPasswordToken +resetPasswordExpire')

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'لینک بازیابی نامعتبر یا منقضی شده است.',
      })
    }

    // Set new password
    user.password = password // Will be hashed by pre-save hook
    user.resetPasswordToken = undefined
    user.resetPasswordExpire = undefined
    await user.save()

    console.log(`[AUTH] Password reset successful for user: ${user.email}`)

    res.status(200).json({
      success: true,
      message: 'رمز عبور با موفقیت تغییر کرد. اکنون می‌توانید وارد شوید.',
    })
  } catch (error) {
    console.error('Error in reset password:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در تغییر رمز عبور. لطفاً دوباره تلاش کنید.',
      error: error.message,
    })
  }
}

// ======================
// Bind Mobile: Send OTP
// ======================
exports.sendBindOtp = async (req, res) => {
  try {
    const mobile = normalizeIranMobile(req.body.mobile)
    const userId = req.userId || (req.user && req.user._id)

    if (!mobile) {
      return res.status(400).json({ success: false, message: 'شماره موبایل نامعتبر است.' })
    }

    const clientIp = getClientIp(req);

    const siteWideCheck = await checkSiteWideOtpCircuitBreaker();
    if (!siteWideCheck.allowed) {
      console.warn(`[SITE-WIDE OTP CIRCUIT BREAKER] Tripped in sendBindOtp for ${mobile}`);
      return res.status(429).json({ success: false, message: siteWideCheck.message, code: 'SITE_WIDE_LIMIT_REACHED' });
    }

    const botCheck = inspectBotTelemetry(req);
    if (botCheck.isBot) {
      console.warn(`[BIND OTP BOT TRAP] Bot detected from IP ${clientIp} for mobile ${mobile}. Reason: ${botCheck.reason}`);
      return res.json({ success: true, message: 'کد تایید ارسال شد', expiresIn: 120 });
    }

    const ipLimit = checkIpRateLimit(clientIp);
    if (!ipLimit.allowed) {
      console.warn(`[BIND OTP IP RATE LIMIT] Limit exceeded for IP ${clientIp}. Silent success returned.`);
      return res.json({ success: true, message: 'کد تایید ارسال شد', expiresIn: 120 });
    }

    const smsSettings = await getSmsSettings()
    if (!smsSettings.configured) {
      return res.status(503).json({ success: false, message: 'سیستم پیامک در پنل ادمین تنظیم نشده است.' })
    }

    // Check if mobile is already used by another user
    const existingUser = await User.findOne({ mobile })
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'این شماره موبایل قبلاً توسط کاربر دیگری استفاده شده است.' })
    }

    const rateLimit = await OTP.checkRateLimit(mobile)
    if (!rateLimit.allowed) {
      return res
        .status(429)
        .set('Retry-After', String(Math.max(rateLimit.retryAfter || 90, 1)))
        .json({ success: false, message: rateLimit.message, reason: rateLimit.reason })
    }

    await OTP.cleanupOld(mobile)

    const code = String(crypto.randomInt(1000, 10000))
    let smsResult
    try {
      smsResult = await sendOtpSMS(mobile, code)
    } catch (smsError) {
      console.error(`[BIND OTP] SMS sending failed for ${mobile.slice(0, 3)}****${mobile.slice(-2)}:`, smsError.message)
      const err = new Error('خطا در ارسال پیامک. لطفا دوباره تلاش کنید.')
      err.code = smsError.code || 'SMS_PROVIDER_ERROR'
      throw err
    }

    const expiresAt = new Date(Date.now() + 2 * 60 * 1000)

    const otp = new OTP({ mobile, code: hashOtpCode(code), expiresAt, verified: false, attempts: 0 })
    await otp.save()

    const provider = smsResult?.provider ? ` (${smsResult.provider})` : ''
    console.log(`[BIND OTP] SMS accepted by provider${provider} for ${mobile.slice(0, 3)}****${mobile.slice(-2)}`)

    res.json({ success: true, message: 'کد تایید ارسال شد', expiresIn: 120 })
  } catch (error) {
    console.error('Error sending bind OTP:', error)
    res.status(500).json({ success: false, message: 'خطا در ارسال کد' })
  }
}

// ======================
// Bind Mobile: Verify OTP
// ======================
exports.verifyBindOtp = async (req, res) => {
  try {
    const mobile = normalizeIranMobile(req.body.mobile)
    const { code } = req.body
    const userId = req.userId || (req.user && req.user._id)

    if (!mobile || !code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'ورودی نامعتبر است.' })
    }
    const normalizedCode = code.trim()
    if (!/^\d{4}$/.test(normalizedCode)) {
      return res.status(400).json({ success: false, message: 'کد باید ۴ رقمی باشد.' })
    }

    const otp = await OTP.findOne({
      mobile,
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 })

    if (!otp) {
      return res.status(400).json({ success: false, message: 'کد وارد شده معتبر نیست.' })
    }

    if (otp.attempts >= 3) {
      return res.status(400).json({ success: false, message: 'تعداد تلاش بیش از حد مجاز.' })
    }

    if (!verifyOtpHash(otp.code, normalizedCode)) {
      const nextAttempts = (otp.attempts || 0) + 1
      await OTP.updateOne(
        { _id: otp._id },
        {
          $inc: { attempts: 1 },
          ...(nextAttempts >= 3 ? { $set: { expiresAt: new Date() } } : {}),
        }
      )
      return res.status(400).json({
        success: false,
        message: nextAttempts >= 3 ? 'تعداد تلاش بیش از حد مجاز.' : 'کد وارد شده معتبر نیست.',
      })
    }

    const claimedOtp = await OTP.findOneAndUpdate(
      { _id: otp._id, verified: false, attempts: { $lt: 3 }, expiresAt: { $gt: new Date() } },
      { $set: { verified: true }, $inc: { attempts: 1 } },
      { new: true }
    )
    if (!claimedOtp) {
      return res.status(400).json({ success: false, message: 'کد وارد شده معتبر نیست.' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' })
    }

    // Check again if mobile is taken (race condition)
    const existingUser = await User.findOne({ mobile })
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
      return res.status(400).json({ success: false, message: 'این شماره موبایل قبلاً توسط کاربر دیگری استفاده شده است.' })
    }

    user.mobile = mobile
    await user.save()
    await OTP.cleanupOld(mobile)

    console.log(`[AUTH] Mobile bound for user: ${user._id} -> ${mobile}`)

    res.json({
      success: true,
      message: 'شماره موبایل با موفقیت تایید و ثبت شد.',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          wallet: user.wallet,
          role: user.role,
          isActive: user.isActive,
          username: user.username,
          avatar: user.avatar,
          googleId: user.googleId
        }
      }
    })
  } catch (error) {
    console.error('Error verifying bind OTP:', error)
    res.status(500).json({ success: false, message: 'خطا در تأیید کد', error: error.message })
  }
}

// ======================
// Change Email: Send OTP
// ======================
exports.sendEmailOtp = async (req, res) => {
  try {
    const { email } = req.body
    const userId = req.userId || (req.user && req.user._id)

    // Check if user is logged in with Google
    const user = await User.findById(userId)
    if (user.googleId) {
      return res.status(400).json({ success: false, message: 'کاربران گوگل امکان تغییر ایمیل را ندارند.' })
    }

    if (!email || typeof email !== 'string' || !STRICT_EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'ایمیل نامعتبر است.' })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const clientIp = getClientIp(req);
    const siteWideCheck = await checkSiteWideOtpCircuitBreaker();
    if (!siteWideCheck.allowed) {
      console.warn(`[SITE-WIDE OTP CIRCUIT BREAKER] Tripped in sendEmailOtp for ${normalizedEmail}`);
      return res.status(429).json({ success: false, message: siteWideCheck.message, code: 'SITE_WIDE_LIMIT_REACHED' });
    }

    const botCheck = inspectBotTelemetry(req);
    if (botCheck.isBot) {
      console.warn(`[EMAIL OTP BOT TRAP] Bot detected from IP ${clientIp} for email ${normalizedEmail}.`);
      return res.json({ success: true, message: 'کد تایید ارسال شد', expiresIn: 120 });
    }

    const ipLimit = checkIpRateLimit(clientIp);
    if (!ipLimit.allowed) {
      console.warn(`[EMAIL OTP IP RATE LIMIT] Limit exceeded for IP ${clientIp}.`);
      return res.json({ success: true, message: 'کد تایید ارسال شد', expiresIn: 120 });
    }

    // Check if email is already used by another user
    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
      return res.status(400).json({ success: false, message: 'این ایمیل قبلاً توسط کاربر دیگری استفاده شده است.' })
    }

    const rateLimit = await OTP.checkRateLimit(normalizedEmail)
    if (!rateLimit.allowed) {
      return res
        .status(429)
        .set('Retry-After', String(Math.max(rateLimit.retryAfter || 90, 1)))
        .json({ success: false, message: rateLimit.message, reason: rateLimit.reason })
    }

    await OTP.cleanupOld(normalizedEmail)

    const code = String(crypto.randomInt(1000, 10000))
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000)

    const otp = new OTP({ email: normalizedEmail, code: hashOtpCode(code), expiresAt, verified: false, attempts: 0 })
    await otp.save()

    console.log(`[EMAIL OTP] Code generated for email: ${normalizedEmail}`)

    // Send Email (Asynchronous - Fire and Forget)
    sendVerificationEmail(normalizedEmail, code)
      .then(() => console.log(`[EMAIL OTP] Email sent successfully to ${normalizedEmail}`))
      .catch(err => console.error(`[EMAIL OTP] Failed to send email to ${normalizedEmail}:`, err))

    res.json({ success: true, message: 'کد تایید به ایمیل ارسال شد', expiresIn: 120 })
  } catch (error) {
    console.error('Error sending email OTP:', error)
    res.status(500).json({ success: false, message: 'خطا در ارسال کد' })
  }
}

// ======================
// Change Email: Verify OTP
// ======================
exports.verifyEmailOtp = async (req, res) => {
  try {
    const { email, code } = req.body
    const userId = req.userId || (req.user && req.user._id)

    if (!email || typeof email !== 'string' || !code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'ورودی نامعتبر است.' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedCode = code.trim()
    if (!STRICT_EMAIL_REGEX.test(normalizedEmail) || !/^\d{4}$/.test(normalizedCode)) {
      return res.status(400).json({ success: false, message: 'ورودی نامعتبر است.' })
    }

    const otp = await OTP.findOne({
      email: normalizedEmail,
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 })

    if (!otp) {
      return res.status(400).json({ success: false, message: 'کد وارد شده معتبر نیست.' })
    }

    if (otp.attempts >= 3) {
      return res.status(400).json({ success: false, message: 'تعداد تلاش بیش از حد مجاز.' })
    }

    if (!verifyOtpHash(otp.code, normalizedCode)) {
      const nextAttempts = (otp.attempts || 0) + 1
      await OTP.updateOne(
        { _id: otp._id },
        {
          $inc: { attempts: 1 },
          ...(nextAttempts >= 3 ? { $set: { expiresAt: new Date() } } : {}),
        }
      )
      return res.status(400).json({
        success: false,
        message: nextAttempts >= 3 ? 'تعداد تلاش بیش از حد مجاز.' : 'کد وارد شده معتبر نیست.',
      })
    }

    const claimedOtp = await OTP.findOneAndUpdate(
      { _id: otp._id, verified: false, attempts: { $lt: 3 }, expiresAt: { $gt: new Date() } },
      { $set: { verified: true }, $inc: { attempts: 1 } },
      { new: true }
    )
    if (!claimedOtp) {
      return res.status(400).json({ success: false, message: 'کد وارد شده معتبر نیست.' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' })
    }

    if (user.googleId) {
      return res.status(400).json({ success: false, message: 'کاربران گوگل امکان تغییر ایمیل را ندارند.' })
    }

    // Check again if email is taken
    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
      return res.status(400).json({ success: false, message: 'این ایمیل قبلاً توسط کاربر دیگری استفاده شده است.' })
    }

    user.email = normalizedEmail
    await user.save()
    await OTP.cleanupOld(normalizedEmail)

    console.log(`[AUTH] Email updated for user: ${user._id} -> ${email}`)

    res.json({
      success: true,
      message: 'ایمیل با موفقیت تغییر کرد.',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          wallet: user.wallet,
          role: user.role,
          isActive: user.isActive,
          username: user.username,
          avatar: user.avatar,
          googleId: user.googleId
        }
      }
    })
  } catch (error) {
    console.error('Error verifying email OTP:', error)
    res.status(500).json({ success: false, message: 'خطا در تأیید کد', error: error.message })
  }
}

// ======================
// Update Profile (Name, Email, Password, Personal Info, Legal Info)
// ======================
exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      currentPassword,
      mobile, // Blocked below unless matching existing mobile
      // Personal Info
      nationalCode,
      birthDate,
      gender,
      birthPlace,
      landline,
      secondMobile,
      province,
      city,
      shebaNumber,
      // Legal Entity Info
      isLegal,
      companyName,
      companyNationalId,
      companyRegistrationId,
      companyLandline,
      companyProvince,
      companyCity
    } = req.body
    const userId = req.userId || (req.user && req.user._id)

    const user = await User.findById(userId).select('+password')
    if (!user) {
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' })
    }

    // Email update must be done through OTP verification flow
    if (email !== undefined && email !== user.email) {
      return res.status(400).json({
        success: false,
        message: 'برای تغییر ایمیل باید از طریق تایید کد ایمیل اقدام کنید.',
      })
    }

    // Mobile update must also be done through OTP verification flow (/api/auth/bind-mobile/*)
    if (mobile !== undefined && mobile !== '' && mobile !== user.mobile) {
      return res.status(400).json({
        success: false,
        message: 'برای تغییر شماره موبایل باید از طریق تایید پیامکی اقدام کنید.',
      })
    }

    // ✅ FIX: Update all profile fields
    if (name !== undefined) user.name = name

    let passwordUpdated = false
    if (password && password.trim() !== '') {
      if (user.password) {
        if (!currentPassword || typeof currentPassword !== 'string') {
          return res.status(400).json({
            success: false,
            message: 'برای تغییر رمز عبور، وارد کردن رمز عبور فعلی الزامی است.',
          })
        }
        const isCurrentValid = await user.comparePassword(currentPassword)
        if (!isCurrentValid) {
          return res.status(401).json({
            success: false,
            message: 'رمز عبور فعلی اشتباه است.',
          })
        }
      }
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' })
      }
      user.password = password
      passwordUpdated = true
    }

    // ✅ FIX: Update Personal Info
    if (nationalCode !== undefined) {
      if (nationalCode && !isValidNationalCode(nationalCode)) {
        return res.status(400).json({ success: false, message: 'کد ملی نامعتبر است.' })
      }
      user.nationalCode = nationalCode || undefined
    }
    if (birthDate !== undefined) user.birthDate = birthDate || undefined
    if (gender !== undefined) user.gender = gender || undefined
    if (birthPlace !== undefined) user.birthPlace = birthPlace || undefined
    if (landline !== undefined) user.landline = landline
    if (secondMobile !== undefined) user.secondMobile = secondMobile || undefined
    if (province !== undefined) user.province = province
    if (city !== undefined) user.city = city
    if (shebaNumber !== undefined) {
      if (shebaNumber && !isValidSheba(shebaNumber)) {
        return res.status(400).json({ success: false, message: 'شماره شبا نامعتبر است.' })
      }
      user.shebaNumber = shebaNumber || undefined
    }

    // ✅ FIX: Update Legal Entity Info
    if (isLegal !== undefined) user.isLegal = isLegal
    if (companyName !== undefined) user.companyName = companyName
    if (companyNationalId !== undefined) user.companyNationalId = companyNationalId
    if (companyRegistrationId !== undefined) user.companyRegistrationId = companyRegistrationId
    if (companyLandline !== undefined) user.companyLandline = companyLandline
    if (companyProvince !== undefined) user.companyProvince = companyProvince
    if (companyCity !== undefined) user.companyCity = companyCity

    await user.save()

    console.log(`[AUTH] Profile updated for user: ${user._id}`)

    const freshToken = passwordUpdated ? generateToken(user._id) : undefined
    if (freshToken) {
      setAuthCookie(res, freshToken)
    }

    res.json({
      success: true,
      message: 'پروفایل با موفقیت بروزرسانی شد.',
      ...(freshToken ? { token: freshToken } : {}),
      data: {
        ...(freshToken ? { token: freshToken } : {}),
        user: {
          _id: user._id,
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          wallet: user.wallet,
          role: user.role,
          isActive: user.isActive,
          username: user.username,
          avatar: user.avatar,
          googleId: user.googleId,
          hasPassword: Boolean(user.password),
           // Personal Info
           nationalCode: user.nationalCode,
           birthDate: user.birthDate,
           gender: user.gender,
           birthPlace: user.birthPlace,
           landline: user.landline,
           secondMobile: user.secondMobile,
           province: user.province,
           city: user.city,
           shebaNumber: user.shebaNumber,
          // Legal Info
          isLegal: user.isLegal,
          companyName: user.companyName,
          companyNationalId: user.companyNationalId,
          companyRegistrationId: user.companyRegistrationId,
          companyLandline: user.companyLandline,
          companyProvince: user.companyProvince,
          companyCity: user.companyCity
        }
      }
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    res.status(500).json({ success: false, message: 'خطا در بروزرسانی پروفایل', error: error.message })
  }
}

// ======================
// Update Avatar
// ======================
exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'لطفا یک تصویر انتخاب کنید.' })
    }

    const userId = req.userId || (req.user && req.user._id)
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' })
    }

    // Delete old avatar from ParsPack if it exists
    if (user.avatar && typeof user.avatar === 'object' && user.avatar.public_id) {
      try { await deleteFromParsPack(user.avatar.public_id) } catch (e) {
        console.error('Error deleting old customer avatar from ParsPack:', e.message)
      }
    }

    const parspackResult = await uploadToParsPack(req.file.buffer, req.file.originalname)
    user.avatar = { url: parspackResult.url, public_id: parspackResult.filename }

    await user.save()

    res.json({
      success: true,
      message: 'تصویر پروفایل با موفقیت تغییر کرد.',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          wallet: user.wallet,
          role: user.role,
          isActive: user.isActive,
          username: user.username,
          avatar: user.avatar,
          googleId: user.googleId
        }
      }
    })
  } catch (error) {
    console.error('Error updating avatar:', error)
    res.status(500).json({ success: false, message: 'خطا در آپلود تصویر', error: error.message })
  }
}

// ======================
// Address Management
// ======================

// Add Address
exports.addAddress = async (req, res) => {
  try {
    const {
      title,
      fullName,
      mobile,
      nationalCode,
      province,
      city,
      provinceId,
      cityId,
      address,
      plaque,
      unit,
      postalCode,
      isDefault,
      recipientName,
      recipientPhone,
      recipientMobile,
      recipientNationalCode,
    } = req.body
    const userId = req.userId || (req.user && req.user._id)

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' })
    }
    if (Array.isArray(user.addresses) && user.addresses.length >= 20) {
      return res.status(400).json({ success: false, message: 'حداکثر ۲۰ آدرس می‌توانید ثبت کنید.' })
    }

    const resolvedRecipientPhone = recipientPhone || recipientMobile

    const newAddress = {
      title,
      fullName,
      mobile,
      nationalCode,
      province,
      city,
      provinceId,
      cityId,
      address,
      plaque,
      unit,
      postalCode,
      isDefault: isDefault || false,
      recipientName,
      recipientPhone: resolvedRecipientPhone,
      recipientNationalCode,
    }

    // If set as default, unset other default addresses
    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false)
    } else if (user.addresses.length === 0) {
      // First address is always default
      newAddress.isDefault = true
    }

    user.addresses.push(newAddress)
    await user.save()

    res.json({
      success: true,
      message: 'آدرس با موفقیت ثبت شد.',
      data: user.addresses
    })
  } catch (error) {
    console.error('Error adding address:', error)
    res.status(500).json({ success: false, message: 'خطا در ثبت آدرس', error: error.message })
  }
}

// Update Address
exports.updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params
    const {
      title,
      fullName,
      mobile,
      nationalCode,
      province,
      city,
      provinceId,
      cityId,
      address,
      plaque,
      unit,
      postalCode,
      isDefault,
      recipientName,
      recipientPhone,
      recipientMobile,
      recipientNationalCode,
    } = req.body
    const userId = req.userId || (req.user && req.user._id)

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' })
    }

    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId)
    if (addressIndex === -1) {
      return res.status(404).json({ success: false, message: 'آدرس یافت نشد.' })
    }

    // Update fields
    if (title) user.addresses[addressIndex].title = title
    if (fullName) user.addresses[addressIndex].fullName = fullName
    if (mobile) user.addresses[addressIndex].mobile = mobile
    if (nationalCode) user.addresses[addressIndex].nationalCode = nationalCode
    if (province) user.addresses[addressIndex].province = province
    if (city) user.addresses[addressIndex].city = city
    // Absent IDs intentionally preserve legacy addresses as-is.
    if (provinceId !== undefined) user.addresses[addressIndex].provinceId = provinceId
    if (cityId !== undefined) user.addresses[addressIndex].cityId = cityId
    if (address) user.addresses[addressIndex].address = address
    if (plaque) user.addresses[addressIndex].plaque = plaque
    if (unit) user.addresses[addressIndex].unit = unit
    if (postalCode) user.addresses[addressIndex].postalCode = postalCode
    if (recipientName) user.addresses[addressIndex].recipientName = recipientName

    const resolvedRecipientPhone = recipientPhone || recipientMobile
    if (resolvedRecipientPhone) user.addresses[addressIndex].recipientPhone = resolvedRecipientPhone
    if (recipientNationalCode) user.addresses[addressIndex].recipientNationalCode = recipientNationalCode

    if (isDefault !== undefined) {
      if (isDefault) {
        // Unset other defaults
        user.addresses.forEach(addr => addr.isDefault = false)
      }
      user.addresses[addressIndex].isDefault = isDefault
    }

    await user.save()

    res.json({
      success: true,
      message: 'آدرس با موفقیت ویرایش شد.',
      data: user.addresses
    })
  } catch (error) {
    console.error('Error updating address:', error)
    res.status(500).json({ success: false, message: 'خطا در ویرایش آدرس', error: error.message })
  }
}

// Delete Address
exports.deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params
    const userId = req.userId || (req.user && req.user._id)

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد.' })
    }

    const initialLength = user.addresses.length
    user.addresses = user.addresses.filter(addr => addr._id.toString() !== addressId)

    if (user.addresses.length === initialLength) {
      return res.status(404).json({ success: false, message: 'آدرس یافت نشد.' })
    }

    await user.save()

    res.json({
      success: true,
      message: 'آدرس با موفقیت حذف شد.',
      data: user.addresses
    })
  } catch (error) {
    console.error('Error deleting address:', error)
    res.status(500).json({ success: false, message: 'خطا در حذف آدرس', error: error.message })
  }
}
