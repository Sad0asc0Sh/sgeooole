const mongoose = require('mongoose')

const newsletterSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'ایمیل الزامی است'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'فرمت ایمیل نامعتبر است'],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        subscribedAt: {
            type: Date,
            default: Date.now,
        },
        unsubscribedAt: {
            type: Date,
            default: null,
        },
        // Token for unsubscribe link
        unsubscribeToken: {
            type: String,
            default: null,
        },
        // Source of subscription
        source: {
            type: String,
            enum: ['footer', 'popup', 'checkout', 'admin'],
            default: 'footer',
        },
        // IP address for spam prevention
        ipAddress: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
)

// Index for faster queries
newsletterSchema.index({ email: 1 })
newsletterSchema.index({ isActive: 1 })

module.exports = mongoose.model('Newsletter', newsletterSchema)
