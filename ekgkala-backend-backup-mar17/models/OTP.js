const mongoose = require('mongoose')

/**
 * OTP Model
 * For storing and verifying OTP codes sent to customers
 */
const otpSchema = new mongoose.Schema(
  {
    // Mobile number (Optional if email is provided)
    mobile: {
      type: String,
      trim: true,
      // match: /^09\d{9}$/, // Validation moved to controller or conditional
    },

    // Email address (Optional if mobile is provided)
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // 4-digit OTP code
    code: {
      type: String,
      required: true,
      length: 4,
    },

    // Expiration time (2 minutes from creation)
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index to auto-delete expired documents
    },

    // Verification status
    verified: {
      type: Boolean,
      default: false,
    },

    // Number of verification attempts
    attempts: {
      type: Number,
      default: 0,
      max: 3,
    },

    // Creation timestamp
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Compound index for efficient queries
otpSchema.index({ mobile: 1, createdAt: -1 })
otpSchema.index({ email: 1, createdAt: -1 })
otpSchema.index({ mobile: 1, code: 1, verified: 1 })
otpSchema.index({ email: 1, code: 1, verified: 1 })

// Static method to clean up old OTPs for a mobile number or email
otpSchema.statics.cleanupOld = async function (identifier) {
  const query = identifier.includes('@') ? { email: identifier } : { mobile: identifier }
  return this.deleteMany({
    ...query,
    $or: [{ verified: true }, { expiresAt: { $lt: new Date() } }],
  })
}

// Check if OTP is still valid
otpSchema.methods.isValid = function () {
  return !this.verified && this.expiresAt > new Date() && this.attempts < 3
}

module.exports = mongoose.model('OTP', otpSchema)
