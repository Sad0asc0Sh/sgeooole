const { body, param } = require('express-validator')

const nameRule = body('name')
  .trim()
  .isLength({ min: 2, max: 120 })
  .withMessage('Brand name must be between 2 and 120 characters')

const idParamRule = param('id')
  .isMongoId()
  .withMessage('Invalid brand id')

const brandCreateValidator = [nameRule]
const brandUpdateValidator = [idParamRule, nameRule.optional()]

module.exports = {
  brandCreateValidator,
  brandUpdateValidator,
}
