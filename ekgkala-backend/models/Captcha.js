const mongoose = require('mongoose')
const crypto = require('crypto')

/**
 * Captcha Schema for Native Self-Hosted Captcha
 * 2-minute TTL, max 3 attempts per challenge
 */
const captchaSchema = new mongoose.Schema(
  {
    captchaId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    solved: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
)

/**
 * Helper to hash captcha answer consistently (case-insensitive, trimmed)
 */
captchaSchema.statics.hashAnswer = function (text) {
  const normalized = String(text || '').trim().toLowerCase()
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

module.exports = mongoose.model('Captcha', captchaSchema)
