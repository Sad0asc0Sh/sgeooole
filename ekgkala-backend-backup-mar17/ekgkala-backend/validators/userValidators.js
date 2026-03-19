const { body, param } = require('express-validator')

const emailRule = body('email')
  .optional()
  .trim()
  .isEmail()
  .withMessage('Email is invalid')

const nameRule = body('name')
  .optional()
  .trim()
  .isLength({ min: 2, max: 120 })
  .withMessage('Name must be between 2 and 120 characters')

const roleRule = body('role')
  .optional()
  .isIn(['user', 'admin', 'manager', 'superadmin'])
  .withMessage('Role is invalid')

const isActiveRule = body('isActive')
  .optional()
  .isBoolean()
  .withMessage('isActive must be boolean')

const idParamRule = param('id')
  .isMongoId()
  .withMessage('Invalid user id')

const userUpdateValidator = [idParamRule, emailRule, nameRule, roleRule, isActiveRule]

module.exports = { userUpdateValidator }
