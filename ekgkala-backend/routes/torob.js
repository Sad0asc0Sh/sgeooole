const express = require('express')
const { getProducts, torobRequestLogger } = require('../controllers/torobController')

const router = express.Router()
router.post('/products', torobRequestLogger, getProducts)

module.exports = router
