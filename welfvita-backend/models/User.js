const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

/**
 * Customer User Model
 * For frontend customers (not admin users)
 */
const userSchema = new mongoose.Schema(
  {
    // Mobile number (primary identifier for OTP login, but optional for Google users)
    mobile: {
      type: String,
      unique: true,
      sparse: true, // Allows null but must be unique if provided
      trim: true,
      match: [/^09\d{9}$/, 'شماره موبایل باید با 09 شروع شود و 11 رقم باشد'],
    },

    // User info
    name: {
      type: String,
      default: 'کاربر ویلف‌ویتا',
      trim: true,
    },

    // Username (for password-based login)
    username: {
      type: String,
      unique: true,
      sparse: true, // Allows null but must be unique if provided
      trim: true,
      lowercase: true,
      minlength: [3, 'نام کاربری باید حداقل 3 کاراکتر باشد'],
      match: [/^[a-z0-9_]+$/, 'نام کاربری فقط می‌تواند شامل حروف انگلیسی، اعداد و _ باشد'],
    },

    // Password (for hybrid authentication)
    password: {
      type: String,
      select: false, // Don't include in queries by default
      minlength: [6, 'رمز عبور باید حداقل 6 کاراکتر باشد'],
    },

    // Email (for Google login)
    email: {
      type: String,
      unique: true,
      sparse: true, // Allows null but must be unique if provided
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'فرمت ایمیل نامعتبر است'],
    },

    // Google authentication fields
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows null but must be unique if provided
    },

    avatar: {
      type: String, // URL to user profile picture (from Google or uploaded)
    },

    // Wallet balance
    wallet: {
      type: Number,
      default: 0,
      min: [0, 'موجودی کیف پول نمی‌تواند منفی باشد'],
    },

    // Role - RBAC system roles
    role: {
      type: String,
      enum: ['user', 'support', 'editor', 'admin', 'manager', 'superadmin'],
      default: 'user',
    },

    // Account status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Personal Info
    nationalCode: {
      type: String,
      trim: true,
      match: [/^\d{10}$/, 'کد ملی باید ۱۰ رقم باشد'],
    },
    birthDate: {
      type: Date,
    },
    landline: {
      type: String,
      trim: true,
    },
    shebaNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^IR\d{24}$/, 'شماره شبا نامعتبر است (باید با IR شروع شود و ۲۶ کاراکتر باشد)'],
    },

    // Location (Default/Main)
    province: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },

    // Legal Entity Info
    isLegal: {
      type: Boolean,
      default: false,
    },
    companyName: {
      type: String,
      trim: true,
    },
    companyNationalId: {
      type: String, // شناسه ملی
      trim: true,
    },
    companyRegistrationId: {
      type: String, // شماره ثبت
      trim: true,
    },
    companyLandline: {
      type: String,
      trim: true,
    },
    companyProvince: {
      type: String,
      trim: true,
    },
    companyCity: {
      type: String,
      trim: true,
    },

    // Addresses
    addresses: [
      {
        title: String,
        fullName: String,
        mobile: String,
        nationalCode: String,
        province: String,
        city: String,
        address: String,
        plaque: String,
        unit: String,
        postalCode: String,
        isDefault: {
          type: Boolean,
          default: false,
        },
        recipientName: String,
        recipientPhone: String,
        recipientNationalCode: String,
      },
    ],

    // Wishlist (array of product IDs)
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],

    // Password Reset Token (for forgot password feature)
    resetPasswordToken: {
      type: String,
    },

    resetPasswordExpire: {
      type: Date,
    },

    // Metadata
    lastLogin: {
      type: Date,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
)

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next()
  }

  // Don't hash if password is empty/null
  if (!this.password) {
    return next()
  }

  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false
  }
  return await bcrypt.compare(candidatePassword, this.password)
}

// Update lastLogin on login
userSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date()
  return this.save()
}

// Generate and hash password reset token
userSchema.methods.getResetPasswordToken = function () {
  const crypto = require('crypto')

  // Generate token
  const resetToken = crypto.randomBytes(32).toString('hex')

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex')

  // Set expire time (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000

  return resetToken
}

// Convert to JSON (hide sensitive fields if needed)
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    // Remove password from JSON output
    delete ret.password
    return ret
  },
})

module.exports =
  mongoose.models.User || mongoose.model('User', userSchema)
