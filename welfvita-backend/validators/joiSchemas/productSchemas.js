/**
 * Product Joi Schemas
 * 
 * Secure validation rules for product-related endpoints.
 */

const Joi = require('joi');

// MongoDB ObjectId pattern
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

// ============================================
// Product Schemas
// ============================================

/**
 * Create product schema
 */
const productCreateSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(200)
        .required()
        .messages({
            'string.min': 'نام محصول باید حداقل ۲ کاراکتر باشد',
            'string.max': 'نام محصول نباید بیشتر از ۲۰۰ کاراکتر باشد',
            'any.required': 'نام محصول الزامی است',
        }),

    nameEn: Joi.string()
        .trim()
        .max(200)
        .optional()
        .allow(''),

    description: Joi.string()
        .trim()
        .max(5000)
        .optional()
        .allow('')
        .messages({
            'string.max': 'توضیحات محصول نباید بیشتر از ۵۰۰۰ کاراکتر باشد',
        }),

    shortDescription: Joi.string()
        .trim()
        .max(500)
        .optional()
        .allow(''),

    price: Joi.number()
        .positive()
        .max(999999999999)
        .required()
        .messages({
            'number.positive': 'قیمت باید عددی مثبت باشد',
            'any.required': 'قیمت الزامی است',
        }),

    comparePrice: Joi.number()
        .positive()
        .max(999999999999)
        .optional()
        .allow(null),

    costPrice: Joi.number()
        .positive()
        .max(999999999999)
        .optional()
        .allow(null),

    category: Joi.string()
        .pattern(objectIdPattern)
        .required()
        .messages({
            'string.pattern.base': 'شناسه دسته‌بندی نامعتبر است',
            'any.required': 'دسته‌بندی الزامی است',
        }),

    brand: Joi.string()
        .pattern(objectIdPattern)
        .optional()
        .allow(null, '')
        .messages({
            'string.pattern.base': 'شناسه برند نامعتبر است',
        }),

    sku: Joi.string()
        .trim()
        .max(100)
        .optional()
        .allow(''),

    barcode: Joi.string()
        .trim()
        .max(50)
        .optional()
        .allow(''),

    countInStock: Joi.number()
        .integer()
        .min(0)
        .max(999999)
        .default(0)
        .messages({
            'number.min': 'موجودی نمی‌تواند منفی باشد',
            'number.integer': 'موجودی باید عدد صحیح باشد',
        }),

    weight: Joi.number()
        .positive()
        .max(999999)
        .optional()
        .allow(null),

    dimensions: Joi.object({
        length: Joi.number().positive().optional().allow(null),
        width: Joi.number().positive().optional().allow(null),
        height: Joi.number().positive().optional().allow(null),
    }).optional(),

    images: Joi.array()
        .items(Joi.string().uri().max(500))
        .max(20)
        .optional(),

    thumbnail: Joi.string()
        .uri()
        .max(500)
        .optional()
        .allow(''),

    tags: Joi.array()
        .items(Joi.string().trim().max(50))
        .max(20)
        .optional(),

    specifications: Joi.array()
        .items(Joi.object({
            key: Joi.string().trim().max(100).required(),
            value: Joi.string().trim().max(500).required(),
        }))
        .max(50)
        .optional(),

    isActive: Joi.boolean().default(true),

    isFeatured: Joi.boolean().default(false),

    isDigital: Joi.boolean().default(false),

    metaTitle: Joi.string()
        .trim()
        .max(70)
        .optional()
        .allow(''),

    metaDescription: Joi.string()
        .trim()
        .max(160)
        .optional()
        .allow(''),

    slug: Joi.string()
        .trim()
        .max(200)
        .optional()
        .allow(''),
});

/**
 * Update product schema (all fields optional)
 */
const productUpdateSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(200)
        .optional()
        .messages({
            'string.min': 'نام محصول باید حداقل ۲ کاراکتر باشد',
            'string.max': 'نام محصول نباید بیشتر از ۲۰۰ کاراکتر باشد',
        }),

    nameEn: Joi.string()
        .trim()
        .max(200)
        .optional()
        .allow(''),

    description: Joi.string()
        .trim()
        .max(5000)
        .optional()
        .allow(''),

    shortDescription: Joi.string()
        .trim()
        .max(500)
        .optional()
        .allow(''),

    price: Joi.number()
        .positive()
        .max(999999999999)
        .optional(),

    comparePrice: Joi.number()
        .positive()
        .max(999999999999)
        .optional()
        .allow(null),

    costPrice: Joi.number()
        .positive()
        .max(999999999999)
        .optional()
        .allow(null),

    category: Joi.string()
        .pattern(objectIdPattern)
        .optional()
        .messages({
            'string.pattern.base': 'شناسه دسته‌بندی نامعتبر است',
        }),

    brand: Joi.string()
        .pattern(objectIdPattern)
        .optional()
        .allow(null, ''),

    sku: Joi.string()
        .trim()
        .max(100)
        .optional()
        .allow(''),

    barcode: Joi.string()
        .trim()
        .max(50)
        .optional()
        .allow(''),

    countInStock: Joi.number()
        .integer()
        .min(0)
        .max(999999)
        .optional(),

    weight: Joi.number()
        .positive()
        .max(999999)
        .optional()
        .allow(null),

    dimensions: Joi.object({
        length: Joi.number().positive().optional().allow(null),
        width: Joi.number().positive().optional().allow(null),
        height: Joi.number().positive().optional().allow(null),
    }).optional(),

    images: Joi.array()
        .items(Joi.string().uri().max(500))
        .max(20)
        .optional(),

    imagesToRemove: Joi.array()
        .items(Joi.string().uri().max(500))
        .max(20)
        .optional(),

    removeAllImages: Joi.boolean().optional(),

    thumbnail: Joi.string()
        .uri()
        .max(500)
        .optional()
        .allow(''),

    tags: Joi.array()
        .items(Joi.string().trim().max(50))
        .max(20)
        .optional(),

    specifications: Joi.array()
        .items(Joi.object({
            key: Joi.string().trim().max(100).required(),
            value: Joi.string().trim().max(500).required(),
        }))
        .max(50)
        .optional(),

    isActive: Joi.boolean().optional(),

    isFeatured: Joi.boolean().optional(),

    isDigital: Joi.boolean().optional(),

    metaTitle: Joi.string()
        .trim()
        .max(70)
        .optional()
        .allow(''),

    metaDescription: Joi.string()
        .trim()
        .max(160)
        .optional()
        .allow(''),

    slug: Joi.string()
        .trim()
        .max(200)
        .optional()
        .allow(''),
});

/**
 * Product ID param schema
 */
const productIdSchema = Joi.object({
    id: Joi.string()
        .pattern(objectIdPattern)
        .required()
        .messages({
            'string.pattern.base': 'شناسه محصول نامعتبر است',
            'any.required': 'شناسه محصول الزامی است',
        }),
});

/**
 * Product list query schema
 */
const productListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('createdAt', '-createdAt', 'price', '-price', 'name', '-name').optional(),
    category: Joi.string().pattern(objectIdPattern).optional(),
    brand: Joi.string().pattern(objectIdPattern).optional(),
    minPrice: Joi.number().min(0).optional(),
    maxPrice: Joi.number().min(0).optional(),
    search: Joi.string().trim().max(200).optional(),
    isActive: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
});

module.exports = {
    productCreateSchema,
    productUpdateSchema,
    productIdSchema,
    productListQuerySchema,
};
