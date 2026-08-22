const express = require('express')
const router = express.Router()
const { getAll, getById, getRuntimeHealth, create, update, remove, setDefault, testConnection } = require('../controllers/aiProviderController')
const { protect, checkPermission, PERMISSIONS } = require('../middleware/auth')

router.use(protect)
router.use(checkPermission(PERMISSIONS.SETTINGS_UPDATE))

router.get('/', getAll)
router.get('/health/runtime', getRuntimeHealth)
router.get('/:id', getById)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)
router.post('/:id/set-default', setDefault)
router.post('/:id/test', testConnection)
router.post('/test', testConnection)

module.exports = router
