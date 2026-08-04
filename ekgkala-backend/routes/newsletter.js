const express = require('express')
const router = express.Router()
const {
    subscribe,
    unsubscribe,
    getSubscribers,
    deleteSubscriber,
    exportSubscribers,
} = require('../controllers/newsletterController')
const { protect, admin } = require('../middleware/auth')
const { createCustomLimiter } = require('../middleware/rateLimiter')
const { requireCaptcha } = require('../middleware/requireCaptcha')

const subscribeLimiter = createCustomLimiter({
    name: 'newsletter-subscribe',
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyType: 'ip+email',
})

// Public routes
router.post('/subscribe', subscribeLimiter, requireCaptcha, subscribe)
router.get('/unsubscribe/:token', unsubscribe)

// Admin routes (requires authentication + admin role)
router.get('/subscribers', protect, admin, getSubscribers)
router.delete('/subscribers/:id', protect, admin, deleteSubscriber)
router.get('/export', protect, admin, exportSubscribers)

module.exports = router
