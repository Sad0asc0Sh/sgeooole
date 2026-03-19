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

// Public routes
router.post('/subscribe', subscribe)
router.get('/unsubscribe/:token', unsubscribe)

// Admin routes (requires authentication + admin role)
router.get('/subscribers', protect, admin, getSubscribers)
router.delete('/subscribers/:id', protect, admin, deleteSubscriber)
router.get('/export', protect, admin, exportSubscribers)

module.exports = router
