const { validationResult } = require('express-validator')

const handleValidation = (req, res, next) => {
  const errors = validationResult(req)
  if (errors.isEmpty()) return next()

  const formatted = errors.array().map(err => ({
    field: err.path,
    message: err.msg,
  }))

  return res.status(400).json({
    success: false,
    message: 'Invalid input',
    errors: formatted,
  })
}

module.exports = { handleValidation }
