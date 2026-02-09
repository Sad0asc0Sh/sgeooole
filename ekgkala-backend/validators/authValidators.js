const { body } = require('express-validator')

const emailValidation = body('email')
  .trim()
  .isEmail()
  .withMessage('Email is invalid')

// SECURITY: Minimum 8 characters per NIST/OWASP guidelines
const passwordValidation = body('password')
  .isLength({ min: 8, max: 128 })
  .withMessage('رمز عبور باید حداقل ۸ کاراکتر باشد')
  .matches(/^(?=.*[a-zA-Z])(?=.*[0-9])/)
  .withMessage('رمز عبور باید شامل حروف و اعداد باشد')

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
