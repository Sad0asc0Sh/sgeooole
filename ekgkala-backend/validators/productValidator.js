/**
 * ============================================
 * PRODUCT VALIDATOR - ENHANCED INPUT VALIDATION
 * ============================================
 * 
 * SECURITY FIXES:
 * - [MEDIUM] Strict type-checking for all inputs
 * - [MEDIUM] Whitelist validation for sort/filter fields
 * - [LOW] Length limits to prevent DoS
 * 
 * OWASP Reference: A03:2021 - Injection, A04:2021 - Insecure Design
 */

const { body, query, param, validationResult } = require('express-validator')

/**
 * Allowed sort fields for product queries
 */
const ALLOWED_SORT_FIELDS = [
    'name', '-name',
    'price', '-price',
    'createdAt', '-createdAt',
    'updatedAt', '-updatedAt',
    'rating', '-rating',
    'reviewCount', '-reviewCount',
    'salesCount', '-salesCount',
]

/**
 * Handle validation result
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
    .escape()

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

// برند اختیاری است: محصول می‌تواند بدون برند ثبت شود و در ویرایش هم برندش
// پاک شود؛ پس نبودن مقدار، null و رشته‌ی خالی همگی معتبرند و فقط یک مقدار
// غیرخالی باید شناسه‌ی معتبر باشد.
const brandRule = body('brand')
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('شناسه برند نامعتبر است')

const descriptionRule = body('description')
    .optional()
    .isLength({ max: 10000 })
    .withMessage('توضیحات بیش از حد طولانی است')

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
// QUERY VALIDATORS
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

const productUpdateValidator = [
    body('name').optional().trim().isLength({ min: 2, max: 200 }).withMessage('نام محصول باید بین ۲ تا ۲۰۰ کاراکتر باشد').escape(),
    body('price').optional().isFloat({ gt: 0, lt: 999999999 }).withMessage('قیمت باید عددی مثبت و معقول باشد').toFloat(),
    discountPriceRule,
    stockRule,
    body('category').optional().isMongoId().withMessage('شناسه دسته‌بندی نامعتبر است'),
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

const productIdValidator = [
    productIdRule,
    handleValidation,
]

const productSlugValidator = [
    slugRule,
    handleValidation,
]

module.exports = {
    productCreateValidator,
    productUpdateValidator,
    productQueryValidator,
    productIdValidator,
    productSlugValidator,
    handleValidation,
    pageRule,
    limitRule,
    sortRule,
    searchRule,
    ALLOWED_SORT_FIELDS,
}
