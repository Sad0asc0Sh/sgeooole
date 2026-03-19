const { body, param } = require('express-validator')

const statusRule = body('status')
  .notEmpty().withMessage('Status is required')
  .bail()
  .isIn(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'])
  .withMessage('Status is invalid')

const idParamRule = param('id')
  .isMongoId()
  .withMessage('Invalid order id')

const orderStatusValidator = [idParamRule, statusRule]

module.exports = { orderStatusValidator }
