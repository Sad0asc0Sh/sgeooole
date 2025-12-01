const mongoose = require('mongoose')

const settingsSchema = new mongoose.Schema(
  {
    // Ensure singleton document
    singletonKey: {
      type: String,
      default: 'main_settings',
      unique: true,
    },

    // General settings
    storeName: {
      type: String,
      default: 'فروشگاه من',
    },
    storeEmail: {
      type: String,
      default: 'info@example.com',
    },
    storePhone: {
      type: String,
      default: '',
    },
    storeAddress: {
      type: String,
      default: '',
    },

    // Payment settings (sensitive)
    paymentGatewayKeys: {
      apiKey: { type: String, select: false },
      apiSecret: { type: String, select: false },
    },

    // Multi-Gateway Payment Configuration
    paymentConfig: {
      // Active gateway selector
      activeGateway: {
        type: String,
        enum: ['zarinpal', 'sadad'],
        default: 'zarinpal',
      },

      // ZarinPal Configuration
      zarinpal: {
        merchantId: {
          type: String,
          default: '',
          select: false, // Hidden by default for security
        },
        isSandbox: {
          type: Boolean,
          default: true,
        },
        isActive: {
          type: Boolean,
          default: false,
        },
      },

      // Sadad (Melli) Configuration
      sadad: {
        merchantId: {
          type: String,
          default: '',
          select: false,
        },
        terminalId: {
          type: String,
          default: '',
          select: false,
        },
        terminalKey: {
          type: String,
          default: '',
          select: false,
        },
        isSandbox: {
          type: Boolean,
          default: true,
        },
        isActive: {
          type: Boolean,
          default: false,
        },
      },
    },

    // Notification settings
    notificationSettings: {
      // SMS Settings (Melipayamak)
      smsUsername: { type: String, select: false }, // نام کاربری پنل ملی‌پیامک
      smsPassword: { type: String, select: false }, // رمز عبور پنل ملی‌پیامک
      smsApiKey: { type: String, select: false }, // توکن کنسول (اختیاری - برای API های جدیدتر)
      smsSenderNumber: { type: String, default: '' }, // شماره فرستنده
      emailFrom: { type: String, default: 'noreply@example.com' },
    },

    // Cart settings
    cartSettings: {
      // مدت زمان نگهداری سبد خرید (به ساعت)
      cartTTLHours: {
        type: Number,
        default: 1, // پیش‌فرض: 1 ساعت
        min: 0.5, // حداقل: 30 دقیقه
        max: 168, // حداکثر: 7 روز (168 ساعت)
      },
      // فعال/غیرفعال کردن انقضای خودکار
      autoExpireEnabled: {
        type: Boolean,
        default: true,
      },
      // حذف خودکار سبدهای منقضی شده
      autoDeleteExpired: {
        type: Boolean,
        default: false, // پیش‌فرض: فقط علامت‌گذاری می‌شود، حذف نمی‌شود
      },
      // سبدهای خرید ماندگار (بدون انقضا)
      permanentCart: {
        type: Boolean,
        default: false, // پیش‌فرض: سبدها دارای مهلت زمانی هستند
      },
      // فعال‌سازی هشدار قبل از انقضا
      expiryWarningEnabled: {
        type: Boolean,
        default: false, // پیش‌فرض: غیرفعال
      },
      // چند دقیقه قبل از انقضا هشدار داده شود
      expiryWarningMinutes: {
        type: Number,
        default: 30, // پیش‌فرض: 30 دقیقه
        min: 5, // حداقل: 5 دقیقه
        max: 120, // حداکثر: 2 ساعت
      },
    },

    // KYC / Identity Verification Settings
    kycSettings: {
      provider: {
        type: String,
        enum: ['mock', 'finnotech', 'jibit'],
        default: 'mock',
      },
      apiKey: { type: String, select: false }, // کلید دسترسی سرویس
      clientId: { type: String, select: false }, // شناسه کلاینت (مخصوص فینوتک)
      isActive: { type: Boolean, default: true },
    },

    // AI Chat Assistant Settings
    aiConfig: {
      // فعال/غیرفعال کردن دستیار هوشمند
      enabled: {
        type: Boolean,
        default: false, // پیش‌فرض: غیرفعال (نیاز به تنظیم API Key)
      },
      // API Key (رمزنگاری شده در دیتابیس)
      apiKey: {
        type: String,
        select: false, // برای امنیت، در query های عادی برگردانده نمی‌شود
        default: '',
      },
      // Base URL سرویس AI
      baseUrl: {
        type: String,
        default: 'https://openrouter.ai/api/v1',
      },
      // مدل زبانی مورد استفاده
      model: {
        type: String,
        default: 'meta-llama/llama-3.3-70b-instruct',
        enum: [
          'meta-llama/llama-3.3-70b-instruct',
          'openai/gpt-4o-mini',
          'openai/gpt-4o',
          'anthropic/claude-3.5-sonnet',
          'google/gemini-2.0-flash-exp',
          'google/gemini-pro',
        ],
      },
      // حداکثر تعداد پیام روزانه (محدودیت هزینه)
      maxDailyMessages: {
        type: Number,
        default: 1000,
        min: 10,
        max: 100000,
      },
      // محدودیت پیام روزانه برای هر کاربر
      userDailyLimit: {
        type: Number,
        default: 20,
        min: 1,
        max: 1000,
      },
      // حداکثر تعداد توکن در هر پاسخ
      maxTokens: {
        type: Number,
        default: 500,
        min: 100,
        max: 4000,
      },
      // Temperature (0 = دقیق، 1 = خلاق)
      temperature: {
        type: Number,
        default: 0.7,
        min: 0,
        max: 1,
      },
      // System Prompt سفارشی (اختیاری)
      customSystemPrompt: {
        type: String,
        default: '',
      },
      // آمار استفاده
      usage: {
        dailyMessageCount: { type: Number, default: 0 },
        lastResetDate: { type: Date, default: Date.now },
        totalMessages: { type: Number, default: 0 },
      },
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Settings', settingsSchema)

