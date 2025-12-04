const { body, param } = require('express-validator')

const nameRule = body('name')
  .trim()
  .isLength({ min: 2, max: 120 })
  .withMessage('Category name must be between 2 and 120 characters')

const parentRule = body('parent')
  .optional({ nullable: true })
  .isMongoId()
  .withMessage('Parent must be a valid ID')

const idParamRule = param('id')
  .isMongoId()
  .withMessage('Invalid category id')

const categoryCreateValidator = [nameRule, parentRule]
const categoryUpdateValidator = [idParamRule, nameRule.optional(), parentRule]

module.exports = {
  categoryCreateValidator,
  categoryUpdateValidator,
}
