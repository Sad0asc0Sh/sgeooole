const mongoose = require('mongoose')

// ============================================
// Schema برای آیتم‌های مرجوعی
// ============================================
const rmaItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  // قیمتی که در آن زمان پرداخت شده
  price: {
    type: Number,
    min: 0,
  },
})

// ============================================
// Schema اصلی RMA (Return Merchandise Authorization)
// ============================================
const rmaSchema = new mongoose.Schema(
  {
    // کاربر درخواست‌کننده
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // سفارش مرتبط
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },

    // دلیل مرجوعی
    reason: {
      type: String,
      required: [true, 'دلیل مرجوعی الزامی است'],
      trim: true,
    },

    // آیتم‌های مرجوعی
    items: [rmaItemSchema],

    // وضعیت RMA
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Processing', 'Completed'],
      default: 'Pending',
      required: true,
      index: true,
    },

    // یادداشت ادمین
    adminNotes: {
      type: String,
      trim: true,
      default: '',
    },

    // تاریخ‌های مهم
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },

    // مبلغ بازپرداختی (اختیاری)
    refundAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

// Index های ترکیبی برای جستجوی سریع‌تر
rmaSchema.index({ user: 1, createdAt: -1 })
rmaSchema.index({ order: 1, status: 1 })

module.exports = mongoose.model('RMA', rmaSchema)
