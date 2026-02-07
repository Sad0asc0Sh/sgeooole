/**
 * ============================================
 * PRODUCT VALIDATOR - ENHANCED INPUT VALIDATION
 * ============================================
 * 
 * SECURITY FIXES:
 * - [MEDIUM] Strict type-checking for all inputs
 * - [MEDIUM] Whitelist validation for sort/filter fields
 * - [LOW] Length limits to prevent DoS
 * - [LOW] Sanitization of string inputs
 * 
 * OWASP Reference: A03:2021 - Injection, A04:2021 - Insecure Design
 */

const { body, query, param, validationResult } = require('express-validator')

/**
 * Allowed sort fields for product queries
 * Only these fields can be used for sorting
 */
const ALLOWED_SORT_FIELDS = [
    'name', '-name',
    'price', '-price',
    'createdAt', '-createdAt',
    'updatedAt', '-updatedAt',
    'rating', '-rating',
    'reviewCount', '-reviewCount',
    'salesCount', '-salesCount',  // Admin only (enforced by accessControl middleware)
]

/**
 * Allowed filter fields for product queries
 */
const ALLOWED_FILTER_FIELDS = [
    'category',
    'brand',
    'minPrice',
    'maxPrice',
    'inStock',
    'isFeatured',
    'tags',
]

/**
 * Handle validation result
 * Returns 400 with errors if validation fails
 */
const handleValidation = (req, res, next) => {
    const errors = validationResult(req)

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'ورودی نامعتبر است',
            errors: errors.array().map(err => ({
                field: err.path || err.param,
                message: err.msg,
                value: err.value,
            })),
        })
    }

    next()
}

// ============================================
// PRODUCT CREATE/UPDATE VALIDATORS
// ============================================

const nameRule = body('name')
    .trim()
    .notEmpty()
    .withMessage('نام محصول الزامی است')
    .isLength({ min: 2, max: 200 })
    .withMessage('نام محصول باید بین ۲ تا ۲۰۰ کاراکتر باشد')
    .escape() // Escape HTML entities
    .customSanitizer(value => {
        // Remove any potential XSS payloads
        return value.replace(/<[^>]*>/g, '')
    })

const priceRule = body('price')
    .notEmpty()
    .withMessage('قیمت الزامی است')
    .isFloat({ gt: 0, lt: 999999999 })
    .withMessage('قیمت باید عددی مثبت و معقول باشد')
    .toFloat()

const discountPriceRule = body('discountPrice')
    .optional()
    .isFloat({ gte: 0, lt: 999999999 })
    .withMessage('قیمت تخفیف باید عددی غیرمنفی باشد')
    .toFloat()
    .custom((value, { req }) => {
        if (value && value >= req.body.price) {
            throw new Error('قیمت تخفیف باید کمتر از قیمت اصلی باشد')
        }
        return true
    })

const stockRule = body('countInStock')
    .optional()
    .isInt({ min: 0, max: 999999 })
    .withMessage('موجودی باید عددی صحیح و غیرمنفی باشد')
    .toInt()

const categoryRule = body('category')
    .notEmpty()
    .withMessage('دسته‌بندی الزامی است')
    .bail()
    .isMongoId()
    .withMessage('شناسه دسته‌بندی نامعتبر است')

const brandRule = body('brand')
    .optional()
    .isMongoId()
    .withMessage('شناسه برند نامعتبر است')

const descriptionRule = body('description')
    .optional()
    .isLength({ max: 10000 })
    .withMessage('توضیحات بیش از حد طولانی است')
    .customSanitizer(value => {
        if (!value) return value
        // Allow basic HTML but remove script tags
        return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    })

const shortDescriptionRule = body('shortDescription')
    .optional()
    .isLength({ max: 500 })
    .withMessage('توضیحات کوتاه بیش از حد طولانی است')
    .escape()

const tagsRule = body('tags')
    .optional()
    .isArray({ max: 20 })
    .withMessage('حداکثر ۲۰ تگ مجاز است')

const tagsItemsRule = body('tags.*')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('هر تگ باید حداکثر ۵۰ کاراکتر باشد')
    .trim()
    .escape()

const skuRule = body('sku')
    .optional()
    .isLength({ max: 100 })
    .withMessage('SKU بیش از حد طولانی است')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('SKU فقط می‌تواند شامل حروف، اعداد، خط تیره و زیرخط باشد')

const isActiveRule = body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive باید boolean باشد')
    .toBoolean()

const isFeaturedRule = body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('isFeatured باید boolean باشد')
    .toBoolean()

// Image management rules
const removeAllImagesRule = body('removeAllImages')
    .optional()
    .isBoolean()
    .withMessage('removeAllImages باید boolean باشد')
    .toBoolean()

const imagesToRemoveRule = body('imagesToRemove')
    .optional()
    .isArray()
    .withMessage('imagesToRemove باید آرایه باشد')

const imagesRule = body('images')
    .optional()
    .isArray({ max: 20 })
    .withMessage('حداکثر ۲۰ تصویر مجاز است')

// ============================================
// QUERY VALIDATORS (for GET requests)
// ============================================

const pageRule = query('page')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('شماره صفحه باید عددی مثبت باشد')
    .toInt()

const limitRule = query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('تعداد آیتم‌ها باید بین ۱ تا ۱۰۰ باشد')
    .toInt()

const sortRule = query('sort')
    .optional()
    .isString()
    .isIn(ALLOWED_SORT_FIELDS)
    .withMessage(`فیلد مرتب‌سازی باید یکی از این موارد باشد: ${ALLOWED_SORT_FIELDS.join(', ')}`)

const searchRule = query('search')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('متن جستجو بیش از حد طولانی است')
    .trim()
    .escape()

const categoryQueryRule = query('category')
    .optional()
    .isMongoId()
    .withMessage('شناسه دسته‌بندی نامعتبر است')

const brandQueryRule = query('brand')
    .optional()
    .isMongoId()
    .withMessage('شناسه برند نامعتبر است')

const minPriceRule = query('minPrice')
    .optional()
    .isFloat({ gte: 0 })
    .withMessage('حداقل قیمت باید غیرمنفی باشد')
    .toFloat()

const maxPriceRule = query('maxPrice')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('حداکثر قیمت باید مثبت باشد')
    .toFloat()

const inStockRule = query('inStock')
    .optional()
    .isBoolean()
    .withMessage('inStock باید boolean باشد')
    .toBoolean()

// ============================================
// PARAM VALIDATORS
// ============================================

const productIdRule = param('id')
    .isMongoId()
    .withMessage('شناسه محصول نامعتبر است')

const slugRule = param('slug')
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('slug نامعتبر است')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('slug فقط می‌تواند شامل حروف کوچک، اعداد و خط تیره باشد')

// ============================================
// COMBINED VALIDATORS
// ============================================

/**
 * Validator for creating a new product
 * All required fields are validated
 */
const productCreateValidator = [
    nameRule,
    priceRule,
    discountPriceRule,
    stockRule,
    categoryRule,
    brandRule,
    descriptionRule,
    shortDescriptionRule,
    tagsRule,
    tagsItemsRule,
    skuRule,
    isActiveRule,
    isFeaturedRule,
    imagesRule,
    handleValidation,
]

/**
 * Validator for updating a product
 * All fields are optional, but if provided must be valid
 */
const productUpdateValidator = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage('نام محصول باید بین ۲ تا ۲۰۰ کاراکتر باشد')
        .escape(),
    body('price')
        .optional()
        .isFloat({ gt: 0, lt: 999999999 })
        .withMessage('قیمت باید عددی مثبت و معقول باشد')
        .toFloat(),
    discountPriceRule,
    stockRule,
    body('category')
        .optional()
        .isMongoId()
        .withMessage('شناسه دسته‌بندی نامعتبر است'),
    brandRule,
    descriptionRule,
    shortDescriptionRule,
    tagsRule,
    tagsItemsRule,
    skuRule,
    isActiveRule,
    isFeaturedRule,
    removeAllImagesRule,
    imagesToRemoveRule,
    imagesRule,
    handleValidation,
]

/**
 * Validator for product listing/search queries
 */
const productQueryValidator = [
    pageRule,
    limitRule,
    sortRule,
    searchRule,
    categoryQueryRule,
    brandQueryRule,
    minPriceRule,
    maxPriceRule,
    inStockRule,
    handleValidation,
]

/**
 * Validator for product ID parameter
 */
const productIdValidator = [
    productIdRule,
    handleValidation,
]

/**
 * Validator for product slug parameter
 */
const productSlugValidator = [
    slugRule,
    handleValidation,
]

/**
 * Custom validator factory for MongoID arrays
 */
const mongoIdArrayValidator = (field) => body(field)
    .optional()
    .isArray()
    .withMessage(`${field} باید آرایه باشد`)
    .custom((value) => {
        if (!value) return true
        const mongoIdRegex = /^[a-fA-F0-9]{24}$/
        for (const id of value) {
            if (!mongoIdRegex.test(id)) {
                throw new Error(`شناسه نامعتبر در ${field}`)
            }
        }
        return true
    })

module.exports = {
    // Combined validators
    productCreateValidator,
    productUpdateValidator,
    productQueryValidator,
    productIdValidator,
    productSlugValidator,

    // Individual rules for reuse
    handleValidation,
    pageRule,
    limitRule,
    sortRule,
    searchRule,
    mongoIdArrayValidator,

    // Constants
    ALLOWED_SORT_FIELDS,
    ALLOWED_FILTER_FIELDS,
}
