const mongoose = require('mongoose')

const announcementSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: [true, 'متن اعلان الزامی است'],
      trim: true,
    },

    link: {
      type: String,
      default: null,
      trim: true,
    },

    type: {
      type: String,
      enum: ['info', 'warning', 'promo'],
      default: 'info',
    },

    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
)

// --- منطق حیاتی: اطمینان از اینکه فقط یک اعلان فعال است ---
// قبل از فعال کردن یک اعلان جدید، بقیه را غیرفعال کن
announcementSchema.pre('save', async function (next) {
  try {
    // اگر isActive تغییر کرده و true است
    if (this.isModified('isActive') && this.isActive) {
      // تمام اعلانات دیگر را غیرفعال کن (به جز این یکی)
      await this.constructor.updateMany(
        { _id: { $ne: this._id } },
        { isActive: false },
      )
      console.log('Other announcements deactivated, activating:', this._id)
    }
    next()
  } catch (error) {
    next(error)
  }
})

module.exports = mongoose.model('Announcement', announcementSchema)
