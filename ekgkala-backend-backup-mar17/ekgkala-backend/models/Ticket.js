const mongoose = require('mongoose')

// Schema برای هر پیام در تیکت
const messageSchema = new mongoose.Schema(
  {
    sender: {
      // کاربری که پیام را ارسال کرده
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isAdminReply: {
      // برای تشخیص آسان‌تر پیام‌های ادمین
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
)

const ticketSchema = new mongoose.Schema(
  {
    user: {
      // کاربری که تیکت را باز کرده
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    order: {
      // (اختیاری) سفارش مرتبط با تیکت
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      // وضعیت داخلی: open, pending(پاسخ داده شده / در انتظار کاربر), closed
      type: String,
      enum: ['open', 'pending', 'closed'],
      default: 'open',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    messages: [messageSchema],
  },
  { timestamps: true },
)

// ============================================
// Database Indexes for Performance
// ============================================
// Compound index for common filter combinations
ticketSchema.index({ status: 1, priority: 1, createdAt: -1 })
ticketSchema.index({ user: 1, status: 1 })
// Single field indexes
ticketSchema.index({ user: 1 })
ticketSchema.index({ status: 1 })
ticketSchema.index({ priority: 1 })
ticketSchema.index({ createdAt: -1 })

module.exports = mongoose.model('Ticket', ticketSchema)

