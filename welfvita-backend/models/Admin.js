const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

// این اسکیمای اصلی کاربر است (هم یوزر، هم ادمین)
// بر اساس مستندات، همه اکانت‌ها در کالکشن `users` ذخیره می‌شوند
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'نام الزامی است'],
      trim: true,
    },

    email: {
      type: String,
      required: [true, 'ایمیل الزامی است'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'ایمیل نامعتبر است'],
    },

    password: {
      type: String,
      required: [true, 'رمز عبور الزامی است'],
      minlength: [6, 'رمز عبور باید حداقل ۶ کاراکتر باشد'],
      select: false, // در کوئری‌ها به‌صورت پیش‌فرض برگردانده نشود
    },

    // Role - RBAC system roles
    role: {
      type: String,
      enum: ['user', 'support', 'editor', 'admin', 'manager', 'superadmin'],
      default: 'user',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    avatar: {
      url: {
        type: String,
        default: null,
      },
      public_id: {
        type: String,
        default: null,
      },
    },

    // فیلدهای بازنشانی رمز عبور
    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpire: {
      type: Date,
      default: null,
    },

    // Personal Info
    nationalCode: {
      type: String,
      trim: true,
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
  },
  {
    timestamps: true,
  },
)

// Hash password قبل از ذخیره
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next()
  }

  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// متد مقایسه رمز عبور
UserSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password)
  } catch (error) {
    throw new Error('خطا در بررسی رمز عبور')
  }
}

// حذف فیلد password در خروجی JSON
UserSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  return obj
}

// متد ایجاد توکن بازنشانی رمز عبور
UserSchema.methods.getResetPasswordToken = function () {
  // 1. ساخت توکن تصادفی
  const resetToken = crypto.randomBytes(20).toString('hex')

  // 2. هش کردن توکن و ذخیره آن در دیتابیس (برای امنیت)
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex')

  // 3. تنظیم زمان انقضا (10 دقیقه)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000

  // 4. برگرداندن توکن اصلی (هش نشده) برای ارسال در ایمیل
  return resetToken
}

// توجه: عمداً نام مدل را User انتخاب می‌کنیم تا از کالکشن `users` استفاده شود.
// فایل هنوز Admin.js است ولی هرجا require('../models/Admin') صدا زده شود،
// در واقع به مدل User (کالکشن users) وصل می‌شود.
// Export Admin model that uses the shared `users` collection.
module.exports =
  mongoose.models.Admin || mongoose.model('Admin', UserSchema, 'users')
