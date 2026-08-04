const mongoose = require('mongoose')

/**
 * Dynamic IP Blocklist Model
 * Self-hosted IP blocking without external dependencies
 */
const blockedIpSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reason: {
      type: String,
      default: 'Automated abuse / rate limit violation',
    },
    failedCount: {
      type: Number,
      default: 1,
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

module.exports = mongoose.model('BlockedIP', blockedIpSchema)
