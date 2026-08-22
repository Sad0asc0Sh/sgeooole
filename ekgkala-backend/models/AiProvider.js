const mongoose = require('mongoose')

const aiProviderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'نام ارائه‌دهنده الزامی است'],
      trim: true,
    },
    baseUrl: {
      type: String,
      required: [true, 'آدرس پایه API الزامی است'],
      trim: true,
    },
    apiKey: {
      type: String,
      required: [true, 'کلید API الزامی است'],
      select: false,
    },
    model: {
      type: String,
      required: [true, 'شناسه مدل الزامی است'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: Number,
      default: 100,
      min: 1,
      max: 10000,
    },
    maxTokens: {
      type: Number,
      default: 2048,
      min: 100,
      max: 32000,
    },
    temperature: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 2,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    headers: {
      type: Map,
      of: String,
      default: {},
    },
    lastTestedAt: {
      type: Date,
      default: null,
    },
    lastTestResult: {
      type: String,
      enum: ['success', 'failure', null],
      default: null,
    },
  },
  { timestamps: true }
)

aiProviderSchema.pre('save', async function (next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isDefault: true },
      { isDefault: false }
    )
  }
  next()
})

aiProviderSchema.index({ isDefault: 1, priority: 1 })
aiProviderSchema.index({ isActive: 1, priority: 1 })

module.exports = mongoose.model('AiProvider', aiProviderSchema)
