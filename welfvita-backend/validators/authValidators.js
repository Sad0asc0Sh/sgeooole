const { body } = require('express-validator')

const emailValidation = body('email')
  .trim()
  .isEmail()
  .withMessage('Email is invalid')

const passwordValidation = body('password')
  .isLength({ min: 6, max: 128 })
  .withMessage('Password must be between 6 and 128 characters')

const mobileValidation = body('mobile')
  .optional()
  .matches(/^09\d{9}$/)
  .withMessage('Mobile must be in the format 09xxxxxxxxx')

const registerValidator = [
  emailValidation,
  passwordValidation,
  mobileValidation,
]

const loginValidator = [
  emailValidation,
  body('password').notEmpty().withMessage('Password is required'),
]

const forgotPasswordValidator = [
  emailValidation,
]

module.exports = {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
}
