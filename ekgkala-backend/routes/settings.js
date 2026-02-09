const express = require('express')
const router = express.Router()
const { getSettings, updateSettings, getPublicSettings } = require('../controllers/settingsController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

// Get public settings (no auth required)
router.get('/public', getPublicSettings)

// Get current settings
// مجوز مورد نیاز: SETTINGS_READ
router.get('/', protect, checkPermission(PERMISSIONS.SETTINGS_READ), getSettings)

// Update settings
// مجوز مورد نیاز: SETTINGS_UPDATE
router.put('/', protect, checkPermission(PERMISSIONS.SETTINGS_UPDATE), updateSettings)

module.exports = router

