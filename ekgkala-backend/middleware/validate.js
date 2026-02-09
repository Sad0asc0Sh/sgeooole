/**
 * Centralized Validation Middleware using Joi
 * 
 * This middleware provides a unified validation layer for all API endpoints.
 * It follows the "Trust Nothing, Validate Everything" security principle.
 * 
 * Features:
 * - Validates request body (POST/PUT/PATCH) or query params (GET)
 * - Strips unknown fields to prevent Mass Assignment attacks
 * - Reports all validation errors (not just the first one)
 * - Standardized error response format
 * 
 * Usage:
 * const validate = require('../middleware/validate');
 * const { registerSchema } = require('../validators/joiSchemas/authSchemas');
 * router.post('/register', validate(registerSchema), authController.register);
 */

const Joi = require('joi');

/**
 * Creates a validation middleware for the given Joi schema
 * @param {Joi.ObjectSchema} schema - Joi validation schema
 * @param {Object} options - Additional options
 * @param {string} options.source - Where to validate from: 'body', 'query', 'params', or 'auto' (default)
 * @returns {Function} Express middleware function
 */
const validate = (schema, options = {}) => {
    return (req, res, next) => {
        // Determine the source of data to validate
        let source = options.source || 'auto';
        let data;

        if (source === 'auto') {
            // Auto-detect: Use query for GET, body for others
            if (req.method === 'GET') {
                data = req.query;
                source = 'query';
            } else {
                data = req.body;
                source = 'body';
            }
        } else if (source === 'body') {
            data = req.body;
        } else if (source === 'query') {
            data = req.query;
        } else if (source === 'params') {
            data = req.params;
        } else {
            data = req.body;
            source = 'body';
        }

        // Validate with Joi
        const { error, value } = schema.validate(data, {
            abortEarly: false,       // Report ALL errors, not just the first
            stripUnknown: true,      // Remove fields not in schema (prevents Mass Assignment)
            allowUnknown: false,     // Reject unknown fields
            convert: true,           // Auto-convert types (e.g., string "123" to number 123)
        });

        if (error) {
            // Format validation errors for client
            const errors = error.details.map((detail) => ({
                field: detail.path.join('.'),
                message: detail.message.replace(/"/g, ''), // Remove quotes from field names
                type: detail.type,
            }));

            const errorMessage = errors.map(e => e.message).join(', ');

            return res.status(400).json({
                success: false,
                message: 'خطای اعتبارسنجی ورودی',
                error: errorMessage,
                errors: errors,
            });
        }

        // Replace raw data with sanitized/validated data
        if (source === 'query') {
            req.query = value;
        } else if (source === 'params') {
            req.params = value;
        } else {
            req.body = value;
        }

        next();
    };
};

/**
 * Validate multiple sources at once (body + params, query + params, etc.)
 * @param {Object} schemas - Object with keys 'body', 'query', 'params' containing Joi schemas
 * @returns {Function} Express middleware function
 */
const validateMultiple = (schemas) => {
    return (req, res, next) => {
        const allErrors = [];
        const joiOptions = {
            abortEarly: false,
            stripUnknown: true,
            allowUnknown: false,
            convert: true,
        };

        // Validate each source if schema is provided
        if (schemas.body) {
            const { error, value } = schemas.body.validate(req.body, joiOptions);
            if (error) {
                allErrors.push(...error.details.map(d => ({
                    field: `body.${d.path.join('.')}`,
                    message: d.message.replace(/"/g, ''),
                    type: d.type,
                })));
            } else {
                req.body = value;
            }
        }

        if (schemas.query) {
            const { error, value } = schemas.query.validate(req.query, joiOptions);
            if (error) {
                allErrors.push(...error.details.map(d => ({
                    field: `query.${d.path.join('.')}`,
                    message: d.message.replace(/"/g, ''),
                    type: d.type,
                })));
            } else {
                req.query = value;
            }
        }

        if (schemas.params) {
            const { error, value } = schemas.params.validate(req.params, joiOptions);
            if (error) {
                allErrors.push(...error.details.map(d => ({
                    field: `params.${d.path.join('.')}`,
                    message: d.message.replace(/"/g, ''),
                    type: d.type,
                })));
            } else {
                req.params = value;
            }
        }

        if (allErrors.length > 0) {
            const errorMessage = allErrors.map(e => e.message).join(', ');
            return res.status(400).json({
                success: false,
                message: 'خطای اعتبارسنجی ورودی',
                error: errorMessage,
                errors: allErrors,
            });
        }

        next();
    };
};

module.exports = validate;
module.exports.validate = validate;
module.exports.validateMultiple = validateMultiple;
