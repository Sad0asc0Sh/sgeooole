const mongoose = require('mongoose')

const settingsSchema = new mongoose.Schema(
  {
    // Ensure singleton document
    singletonKey: {
      type: String,
      default: 'main_settings',
      unique: true,
    },

    // System Setup Status (برای کنترل endpoint /admin/setup)
    systemSetup: {
      // آیا Setup اولیه انجام شده؟
      isCompleted: {
        type: Boolean,
        default: false,
      },
      // تاریخ انجام Setup
      completedAt: {
        type: Date,
        default: null,
      },
      // IP که Setup را انجام داده
      completedByIP: {
        type: String,
        default: null,
      },
      // شناسه ادمین ایجاد شده
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null,
      },
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

    // Social Media Links
    socialLinks: {
      telegram: {
        type: String,
        default: '',
      },
      instagram: {
        type: String,
        default: '',
      },
      aparat: {
        type: String,
        default: '',
      },
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
      smsUsername: { type: String, select: false },
      smsPassword: { type: String, select: false },
      smsApiKey: { type: String, select: false },
      smsSenderNumber: { type: String, default: '' },
      smsBodyId: { type: String, default: '' }, // شناسه الگوی ملی پیامک برای OTP
      emailFrom: { type: String, default: 'noreply@example.com' },
    },

    // Cart settings
    cartSettings: {
      cartTTLHours: {
        type: Number,
        default: 1,
        min: 0.5,
        max: 168,
      },
      autoExpireEnabled: {
        type: Boolean,
        default: true,
      },
      autoDeleteExpired: {
        type: Boolean,
        default: false,
      },
      permanentCart: {
        type: Boolean,
        default: false,
      },
      expiryWarningEnabled: {
        type: Boolean,
        default: false,
      },
      expiryWarningMinutes: {
        type: Number,
        default: 30,
        min: 5,
        max: 120,
      },
      notificationType: {
        type: String,
        enum: ['email', 'sms', 'both'],
        default: 'both',
      },
    },

    // KYC / Identity Verification Settings
    kycSettings: {
      provider: {
        type: String,
        enum: ['mock', 'finnotech', 'jibit'],
        default: 'mock',
      },
      apiKey: { type: String, select: false },
      clientId: { type: String, select: false },
      isActive: { type: Boolean, default: true },
    },

    // AI Chat Assistant Settings
    aiConfig: {
      enabled: {
        type: Boolean,
        default: false,
      },
      apiKey: {
        type: String,
        select: false,
        default: '',
      },
      baseUrl: {
        type: String,
        default: 'https://openrouter.ai/api/v1',
      },
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
      groqModel: {
        type: String,
        default: 'llama-3.3-70b-versatile',
        enum: [
          'llama-3.3-70b-versatile',
          'llama-3.1-8b-instant',
          'openai/gpt-oss-120b',
        ],
      },
      maxDailyMessages: {
        type: Number,
        default: 1000,
        min: 10,
        max: 100000,
      },
      userDailyLimit: {
        type: Number,
        default: 20,
        min: 1,
        max: 1000,
      },
      maxTokens: {
        type: Number,
        default: 500,
        min: 100,
        max: 4000,
      },
      temperature: {
        type: Number,
        default: 0.7,
        min: 0,
        max: 1,
      },
      customSystemPrompt: {
        type: String,
        default: '',
      },
      usage: {
        dailyMessageCount: { type: Number, default: 0 },
        lastResetDate: { type: Date, default: Date.now },
        totalMessages: { type: Number, default: 0 },
      },
    },

    // Search & Trending Settings
    searchSettings: {
      trackingEnabled: {
        type: Boolean,
        default: true,
      },
      trendingEnabled: {
        type: Boolean,
        default: false,
      },
      trendingLimit: {
        type: Number,
        default: 8,
        min: 3,
        max: 20,
      },
      trendingPeriodDays: {
        type: Number,
        default: 30,
        min: 1,
        max: 90,
      },
    },

    // Popular Categories Settings
    popularCategoriesSettings: {
      trackingEnabled: {
        type: Boolean,
        default: true,
      },
      displayEnabled: {
        type: Boolean,
        default: false,
      },
      displayLimit: {
        type: Number,
        default: 8,
        min: 3,
        max: 20,
      },
      periodDays: {
        type: Number,
        default: 30,
        min: 1,
        max: 90,
      },
      minViews: {
        type: Number,
        default: 5,
        min: 1,
        max: 100,
      },
      minTotalViewsForActivation: {
        type: Number,
        default: 100,
        min: 10,
        max: 10000,
      },
      useFallback: {
        type: Boolean,
        default: true,
      },
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Settings', settingsSchema)
