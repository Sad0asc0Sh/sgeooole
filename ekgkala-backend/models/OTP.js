const mongoose = require('mongoose')

/**
 * OTP Model
 * For storing and verifying OTP codes sent to customers
 */
const otpSchema = new mongoose.Schema(
  {
    // Mobile number (Optional if email is provided)
    mobile: {
      type: String,
      trim: true,
      // match: /^09\d{9}$/, // Validation moved to controller or conditional
    },

    // Email address (Optional if mobile is provided)
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // 4-digit OTP code
    code: {
      type: String,
      required: true,
      length: 4,
    },

    // Expiration time (2 minutes from creation)
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // Verification status
    verified: {
      type: Boolean,
      default: false,
    },

    // Number of verification attempts
    attempts: {
      type: Number,
      default: 0,
      max: 3,
    },

    // Creation timestamp
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Compound index for efficient queries
otpSchema.index({ mobile: 1, createdAt: -1 })
otpSchema.index({ email: 1, createdAt: -1 })
otpSchema.index({ mobile: 1, code: 1, verified: 1 })
otpSchema.index({ email: 1, code: 1, verified: 1 })

// Static method to enforce per-identifier OTP send limits independent of client IP
otpSchema.statics.checkRateLimit = async function (identifier) {
  const query = identifier.includes('@') ? { email: identifier.toLowerCase() } : { mobile: identifier }
  const now = new Date()
  const cooldownStartedAt = new Date(now.getTime() - 90 * 1000)
  const hourStartedAt = new Date(now.getTime() - 60 * 60 * 1000)
  const dayStartedAt = new Date(now)
  dayStartedAt.setHours(0, 0, 0, 0)

  const [lastOtp, hourlyCount, dailyCount] = await Promise.all([
    this.findOne(query).sort({ createdAt: -1 }).select('createdAt').lean(),
    this.countDocuments({ ...query, createdAt: { $gte: hourStartedAt } }),
    this.countDocuments({ ...query, createdAt: { $gte: dayStartedAt } }),
  ])

  if (lastOtp && lastOtp.createdAt > cooldownStartedAt) {
    return {
      allowed: false,
      reason: 'cooldown',
      retryAfter: Math.ceil((lastOtp.createdAt.getTime() + 90 * 1000 - now.getTime()) / 1000),
      message: 'لطفاً ۹۰ ثانیه بعد دوباره درخواست کد دهید.',
    }
  }

  if (hourlyCount >= 4) {
    return {
      allowed: false,
      reason: 'hourly_limit',
      retryAfter: 60 * 60,
      message: 'تعداد درخواست کد برای این شماره/ایمیل در یک ساعت اخیر بیش از حد مجاز است.',
    }
  }

  if (dailyCount >= 6) {
    const tomorrow = new Date(dayStartedAt)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return {
      allowed: false,
      reason: 'daily_limit',
      retryAfter: Math.ceil((tomorrow.getTime() - now.getTime()) / 1000),
      message: 'تعداد درخواست کد برای این شماره/ایمیل در امروز بیش از حد مجاز است.',
    }
  }

  return { allowed: true }
}

// Static method to clean up OTP history that is no longer needed for rate limiting
otpSchema.statics.cleanupOld = async function (identifier) {
  const query = identifier.includes('@') ? { email: identifier.toLowerCase() } : { mobile: identifier }
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  return this.deleteMany({
    ...query,
    createdAt: { $lt: oneDayAgo },
  })
}

// Check if OTP is still valid
otpSchema.methods.isValid = function () {
  return !this.verified && this.expiresAt > new Date() && this.attempts < 3
}

module.exports = mongoose.model('OTP', otpSchema)
