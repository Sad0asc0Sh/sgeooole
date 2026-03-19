/**
 * Central export for all Joi validation schemas
 * 
 * Import schemas like:
 * const { authSchemas, productSchemas } = require('../validators/joiSchemas');
 * 
 * Or import specific schemas:
 * const { loginSchema, registerSchema } = require('../validators/joiSchemas/authSchemas');
 */

const authSchemas = require('./authSchemas');
const productSchemas = require('./productSchemas');
const userSchemas = require('./userSchemas');
const orderSchemas = require('./orderSchemas');

module.exports = {
    // Auth schemas
    ...authSchemas,
    authSchemas,

    // Product schemas
    ...productSchemas,
    productSchemas,

    // User schemas
    ...userSchemas,
    userSchemas,

    // Order schemas
    ...orderSchemas,
    orderSchemas,
};
