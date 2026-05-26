/**
 * Order Joi Schemas
 * 
 * Secure validation rules for order-related endpoints.
 */

const Joi = require('joi');

// MongoDB ObjectId pattern
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

// Iranian mobile number pattern
const iranMobilePattern = /^09\d{9}$/;

// Order status values
const ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'];

// Payment methods
const PAYMENT_METHODS = ['online', 'cod', 'wallet', 'credit'];

// ============================================
// Order Schemas
// ============================================

/**
 * Create order schema
 */
const orderCreateSchema = Joi.object({
    orderItems: Joi.array()
        .items(Joi.object({
            product: Joi.string()
                .pattern(objectIdPattern)
                .required()
                .messages({
                    'string.pattern.base': 'شناسه محصول نامعتبر است',
                    'any.required': 'شناسه محصول الزامی است',
                }),
            name: Joi.string().required(),
            quantity: Joi.number()
                .integer()
                .min(1)
                .max(999)
                .required()
                .messages({
                    'number.min': 'تعداد باید حداقل ۱ باشد',
                    'number.max': 'تعداد نمی‌تواند بیشتر از ۹۹۹ باشد',
                    'any.required': 'تعداد الزامی است',
                }),
            price: Joi.number()
                .min(0)
                .required(),
            image: Joi.string().allow('', null).optional(),
            variantOptions: Joi.array().items(Joi.object({
                name: Joi.string().trim().optional(),
                value: Joi.string().trim().optional(),
            })).optional(),
        }))
        .min(1)
        .max(100)
        .required()
        .messages({
            'array.min': 'سبد خرید نمی‌تواند خالی باشد',
            'array.max': 'حداکثر ۱۰۰ محصول در هر سفارش مجاز است',
            'any.required': 'محصولات الزامی هستند',
        }),

    shippingAddress: Joi.object({
        fullName: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .required(),
        phone: Joi.string()
            .required(),
        province: Joi.string()
            .trim()
            .min(2)
            .max(50)
            .required(),
        city: Joi.string()
            .trim()
            .min(2)
            .max(50)
            .required(),
        address: Joi.string()
            .trim()
            .min(5)
            .max(1000)
            .required(),
        postalCode: Joi.string()
            .required(),
        mobile: Joi.string().optional().allow('', null),
        nationalCode: Joi.string().optional().allow('', null),
        recipientName: Joi.string().optional().allow('', null),
        recipientPhone: Joi.string().optional().allow('', null),
        recipientNationalCode: Joi.string().optional().allow('', null),
        isDefault: Joi.boolean().optional(),
    }).required().messages({
        'any.required': 'آدرس ارسال الزامی است',
    }),

    paymentMethod: Joi.string()
        .valid(...PAYMENT_METHODS)
        .required()
        .messages({
            'any.only': 'روش پرداخت نامعتبر است',
            'any.required': 'روش پرداخت الزامی است',
        }),

    itemsPrice: Joi.number().min(0).required(),
    shippingPrice: Joi.number().min(0).required(),
    shippingMethod: Joi.string().optional().allow('', null),
    taxPrice: Joi.number().min(0).optional(),
    totalPrice: Joi.number().min(0).required(),
    totalDiscount: Joi.number().min(0).optional(),

    couponCode: Joi.string()
        .trim()
        .max(50)
        .optional()
        .allow(''),

    note: Joi.string()
        .trim()
        .max(1000)
        .optional()
        .allow('')
        .messages({
            'string.max': 'یادداشت نباید بیشتر از ۱۰۰۰ کاراکتر باشد',
        }),

    addressId: Joi.string()
        .pattern(objectIdPattern)
        .optional(),
});

/**
 * Update order status schema (admin)
 */
const orderStatusUpdateSchema = Joi.object({
    status: Joi.string()
        .valid(...ORDER_STATUSES)
        .required()
        .messages({
            'any.only': 'وضعیت سفارش نامعتبر است',
            'any.required': 'وضعیت سفارش الزامی است',
        }),

    trackingCode: Joi.string()
        .trim()
        .max(100)
        .optional()
        .allow(''),

    note: Joi.string()
        .trim()
        .max(500)
        .optional()
        .allow(''),
});

/**
 * Order ID param schema
 */
const orderIdSchema = Joi.object({
    id: Joi.string()
        .pattern(objectIdPattern)
        .required()
        .messages({
            'string.pattern.base': 'شناسه سفارش نامعتبر است',
            'any.required': 'شناسه سفارش الزامی است',
        }),
});

/**
 * Order list query schema
 */
const orderListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('createdAt', '-createdAt', 'totalPrice', '-totalPrice').optional(),
    status: Joi.string().valid(...ORDER_STATUSES).optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().min(Joi.ref('startDate')).optional(),
    search: Joi.string().trim().max(200).optional(),
    user: Joi.string().pattern(objectIdPattern).optional(),
});

/**
 * Cancel order schema
 */
const orderCancelSchema = Joi.object({
    reason: Joi.string()
        .trim()
        .min(10)
        .max(500)
        .optional()
        .messages({
            'string.min': 'دلیل لغو باید حداقل ۱۰ کاراکتر باشد',
            'string.max': 'دلیل لغو نباید بیشتر از ۵۰۰ کاراکتر باشد',
        }),
});

module.exports = {
    orderCreateSchema,
    orderStatusUpdateSchema,
    orderIdSchema,
    orderListQuerySchema,
    orderCancelSchema,
    // Export constants for reuse
    ORDER_STATUSES,
    PAYMENT_METHODS,
};
