const mongoose = require('mongoose')

// ============================================
// Schema برای آیتم‌های خریداری شده (Order Items)
// ============================================
const orderItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  // اختیاری: برای محصولات متغیر - گزینه‌های انتخاب‌شده
  variantOptions: [
    {
      name: {
        type: String,
        trim: true,
      },
      value: {
        type: String,
        trim: true,
      },
    },
  ],
})

// ============================================
// Schema برای آدرس ارسال (Shipping Address)
// ============================================
const shippingAddressSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
    trim: true,
  },
  postalCode: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  mobile: String, // Buyer Mobile
  nationalCode: String, // Buyer National Code
  recipientName: String,
  recipientPhone: String,
  recipientNationalCode: String,
})

// ============================================
// Schema اصلی سفارش (Order)
// ============================================
const orderSchema = new mongoose.Schema(
  {
    // کاربر سفارش‌دهنده
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // آیتم‌های سفارش
    orderItems: [orderItemSchema],

    // آدرس ارسال
    shippingAddress: shippingAddressSchema,

    // روش پرداخت
    paymentMethod: {
      type: String,
      required: true,
      default: 'online',
    },

    // نتیجه پرداخت (از درگاه)
    paymentResult: {
      id: String,
      status: String,
      update_time: String,
      email_address: String,
    },

    // Payment Gateway Fields
    paymentGateway: {
      type: String,
      enum: ['zarinpal', 'sadad', 'none'],
      default: 'none',
    },

    // ZarinPal Payment Fields
    zarinpalAuthority: {
      type: String,
      trim: true,
    },
    zarinpalRefId: {
      type: String,
      trim: true,
    },

    // Sadad Payment Fields
    sadadToken: {
      type: String,
      trim: true,
    },
    sadadOrderId: {
      type: String,
      trim: true,
    },
    sadadTraceNumber: {
      type: String,
      trim: true,
    },

    // قیمت‌ها
    itemsPrice: {
      type: Number,
      required: true,
      default: 0.0,
      min: 0,
    },
    shippingPrice: {
      type: Number,
      required: true,
      default: 0.0,
      min: 0,
    },
    shippingMethod: {
      type: String,
      required: false, // Optional for backward compatibility
    },
    taxPrice: {
      type: Number,
      required: true,
      default: 0.0,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0.0,
      min: 0,
    },
    totalDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // وضعیت پرداخت
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
    },

    // وضعیت سفارش (مدیریت توسط ادمین)
    orderStatus: {
      type: String,
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      // پیش‌فرض: سفارش بعد از ثبت، در وضعیت «در دست بررسی» (Processing) قرار می‌گیرد
      default: 'Processing',
      required: true,
    },

    // تاریخ‌های مهم
    shippedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    trackingCode: {
      type: String,
      trim: true,
    },
    // زمان تقریبی برای تکمیل خودکار سفارش (تبدیل به تحویل شده)
    autoCompleteAt: {
      type: Date,
    },

    // کد سفارش (خوانا برای کاربر و ادمین)
    orderCode: {
      type: String,
      unique: true,
      required: true,
      default: function () {
        // تولید کد تصادفی: WV- به علاوه ۶ رقم تصادفی
        return 'WV-' + Math.floor(100000 + Math.random() * 900000).toString()
      },
    },

    // یادداشت ادمین (اختیاری)
    adminNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
)

// ============================================
// Database Indexes for Performance
// ============================================
// Compound indexes for common filter combinations
orderSchema.index({ user: 1, orderStatus: 1, isPaid: 1 })
orderSchema.index({ orderStatus: 1, isPaid: 1, createdAt: -1 })
// Single field indexes
orderSchema.index({ user: 1 })
orderSchema.index({ orderStatus: 1 })
orderSchema.index({ isPaid: 1 })
orderSchema.index({ createdAt: -1 })
orderSchema.index({ orderCode: 1 }) // Index for fast lookup by orderCode

module.exports = mongoose.model('Order', orderSchema)
