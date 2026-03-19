const { body } = require('express-validator')

const nameRule = body('name')
  .trim()
  .isLength({ min: 2, max: 200 })
  .withMessage('Product name must be between 2 and 200 characters')

const priceRule = body('price')
  .isFloat({ gt: 0 })
  .withMessage('Price must be greater than 0')

const stockRule = body('countInStock')
  .optional()
  .isInt({ min: 0 })
  .withMessage('Stock must be a non-negative integer')

const categoryRule = body('category')
  .notEmpty()
  .withMessage('Category is required')
  .bail()
  .isMongoId()
  .withMessage('Category must be a valid ID')

const descriptionRule = body('description')
  .optional()
  .isLength({ max: 5000 })
  .withMessage('Description is too long')

const productCreateValidator = [
  nameRule,
  priceRule,
  stockRule,
  categoryRule,
  descriptionRule,
]

const productUpdateValidator = [
  nameRule.optional(),
  priceRule.optional(),
  stockRule,
  categoryRule.optional(),
  descriptionRule,
  // ✅ FIX: Allow image management fields
  body('removeAllImages').optional().isBoolean().withMessage('removeAllImages must be boolean'),
  body('imagesToRemove').optional().isArray().withMessage('imagesToRemove must be an array'),
  body('images').optional().isArray().withMessage('images must be an array'),
]

module.exports = {
  productCreateValidator,
  productUpdateValidator,
}
