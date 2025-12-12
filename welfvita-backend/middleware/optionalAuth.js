const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { getClient } = require('../utils/redis')

const JWT_SECRET = process.env.JWT_SECRET
const JWT_ISSUER = process.env.JWT_ISSUER || 'welfvita-api'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'welfvita-clients'

/**
 * Optional Authentication Middleware
 * اگر توکن موجود باشد، کاربر را شناسایی می‌کند
 * اما اگر توکن نباشد یا نامعتبر باشد، درخواست را مسدود نمی‌کند
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token

        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ) {
            token = req.headers.authorization.split(' ')[1]
        }

        // اگر توکنی نبود، ادامه بده بدون user
        if (!token) {
            return next()
        }

        // Check Redis blacklist
        const redisClient = getClient()
        const isBlacklisted = await redisClient.get(`blacklist:${token}`)
        if (isBlacklisted) {
            return next() // توکن نامعتبر است اما درخواست را رد نمی‌کنیم
        }

        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
        })

        // فقط کاربران Customer را شناسایی می‌کنیم
        if (decoded.type === 'customer') {
            const user = await User.findById(decoded.id)
            if (user && user.isActive) {
                req.user = user
                req.userId = user._id
                req.userType = 'customer'
            }
        }

        next()
    } catch (error) {
        // در صورت هر خطایی، فقط ادامه می‌دهیم بدون user
        next()
    }
}

module.exports = { optionalAuth }
