/**
 * User Joi Schemas
 * 
 * Secure validation rules for user management endpoints.
 */

const Joi = require('joi');
const { normalizeIranMobile, toEnglishDigits } = require('../../utils/phone');

// MongoDB ObjectId pattern
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

// Iranian mobile number pattern
const iranMobilePattern = /^09\d{9}$/;

// Iranian national code pattern (10 digits)
const nationalCodePattern = /^\d{10}$/;

// Iranian SHEBA pattern (IR followed by 24 digits)
const shebaPattern = /^IR\d{24}$/;

const normalizeIranMobileOptionalForJoi = (value, helpers) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;

    const normalized = normalizeIranMobile(value);
    if (!normalized) {
        return helpers.message('شماره موبایل معتبر نیست (فرمت درست: 09xxxxxxxxx)');
    }
    return normalized;
};

const normalizeNationalCodeOptionalForJoi = (value, helpers) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string' && value.trim() === '') return '';

    const normalized = toEnglishDigits(value).replace(/\D/g, '');
    if (!/^\d{10}$/.test(normalized)) {
        return helpers.message('کد ملی باید ۱۰ رقم باشد');
    }
    return normalized;
};

const normalizePostalCodeForJoi = (value, helpers) => {
    const normalized = toEnglishDigits(value).replace(/\D/g, '');
    if (!/^\d{10}$/.test(normalized)) {
        return helpers.message('کد پستی باید ۱۰ رقم باشد');
    }
    return normalized;
};

// ============================================
// User Schemas
// ============================================

/**
 * Update user schema (admin updating a user)
 */
const userUpdateSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(120)
        .optional()
        .messages({
            'string.min': 'نام باید حداقل ۲ کاراکتر باشد',
            'string.max': 'نام نباید بیشتر از ۱۲۰ کاراکتر باشد',
        }),

    email: Joi.string()
        .trim()
        .lowercase()
        .email({ tlds: { allow: false } })
        .max(254)
        .optional()
        .messages({
            'string.email': 'فرمت ایمیل نامعتبر است',
        }),

    mobile: Joi.string()
        .pattern(iranMobilePattern)
        .optional()
        .allow('')
        .messages({
            'string.pattern.base': 'شماره موبایل باید در فرمت 09xxxxxxxxx باشد',
        }),

    role: Joi.string()
        .valid('user', 'support', 'editor', 'admin', 'manager', 'superadmin')
        .optional()
        .messages({
            'any.only': 'نقش کاربر نامعتبر است',
        }),

    isActive: Joi.boolean().optional(),

    isVerified: Joi.boolean().optional(),
});

/**
 * User profile update schema (user updating their own profile)
 */
const userProfileUpdateSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(120)
        .optional()
        .messages({
            'string.min': 'نام باید حداقل ۲ کاراکتر باشد',
            'string.max': 'نام نباید بیشتر از ۱۲۰ کاراکتر باشد',
        }),

    email: Joi.string()
        .trim()
        .lowercase()
        .email({ tlds: { allow: false } })
        .max(254)
        .optional()
        .messages({
            'string.email': 'فرمت ایمیل نامعتبر است',
        }),

    mobile: Joi.string()
        .pattern(iranMobilePattern)
        .optional()
        .allow('')
        .messages({
            'string.pattern.base': 'شماره موبایل باید در فرمت 09xxxxxxxxx باشد',
        }),

    nationalCode: Joi.string()
        .pattern(nationalCodePattern)
        .optional()
        .allow('')
        .messages({
            'string.pattern.base': 'کد ملی باید ۱۰ رقم باشد',
        }),

    birthDate: Joi.date()
        .max('now')
        .optional()
        .allow(null)
        .messages({
            'date.max': 'تاریخ تولد نمی‌تواند در آینده باشد',
        }),

    shebaNumber: Joi.string()
        .pattern(shebaPattern)
        .optional()
        .allow('')
        .messages({
            'string.pattern.base': 'شماره شبا باید با IR شروع شده و ۲۴ رقم بعد از آن داشته باشد',
        }),

    avatar: Joi.string()
        .uri()
        .max(500)
        .optional()
        .allow(''),

    // Legal entity info
    isLegalEntity: Joi.boolean().optional(),

    companyName: Joi.string()
        .trim()
        .max(200)
        .optional()
        .allow(''),

    economicCode: Joi.string()
        .trim()
        .max(20)
        .optional()
        .allow(''),

    registrationNumber: Joi.string()
        .trim()
        .max(20)
        .optional()
        .allow(''),
});

/**
 * User ID param schema
 */
const userIdSchema = Joi.object({
    id: Joi.string()
        .pattern(objectIdPattern)
        .required()
        .messages({
            'string.pattern.base': 'شناسه کاربر نامعتبر است',
            'any.required': 'شناسه کاربر الزامی است',
        }),
});

/**
 * User list query schema
 */
const userListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('createdAt', '-createdAt', 'name', '-name', 'email', '-email').optional(),
    search: Joi.string().trim().max(200).optional(),
    role: Joi.string().valid('user', 'support', 'editor', 'admin', 'manager', 'superadmin').optional(),
    isActive: Joi.boolean().optional(),
    isVerified: Joi.boolean().optional(),
});

/**
 * Address schema
 */
const addressSchema = Joi.object({
    title: Joi.string()
        .trim()
        .max(100)
        .optional()
        .messages({
            'string.max': 'عنوان آدرس نباید بیشتر از ۱۰۰ کاراکتر باشد',
        }),

    // Buyer info (optional)
    fullName: Joi.string().trim().min(2).max(100).optional().allow(''),

    mobile: Joi.any().custom(normalizeIranMobileOptionalForJoi, 'iran mobile normalizer').optional(),

    nationalCode: Joi.any().custom(normalizeNationalCodeOptionalForJoi, 'national code normalizer').optional(),

    recipientName: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.min': 'نام گیرنده باید حداقل ۲ کاراکتر باشد',
            'string.max': 'نام گیرنده نباید بیشتر از ۱۰۰ کاراکتر باشد',
            'any.required': 'نام گیرنده الزامی است',
        }),

    // Recipient phone (accept both legacy `recipientMobile` and canonical `recipientPhone`)
    recipientPhone: Joi.any().custom(normalizeIranMobileOptionalForJoi, 'iran mobile normalizer').optional(),

    recipientNationalCode: Joi.any().custom(normalizeNationalCodeOptionalForJoi, 'national code normalizer').optional(),

    recipientMobile: Joi.any()
        .custom(normalizeIranMobileOptionalForJoi, 'iran mobile normalizer')
        .optional(),

    // Extra field sent by some frontend forms
    phone: Joi.any().custom(normalizeIranMobileOptionalForJoi, 'iran mobile normalizer').optional(),

    province: Joi.string()
        .trim()
        .min(2)
        .max(50)
        .required()
        .messages({
            'any.required': 'استان الزامی است',
        }),

    city: Joi.string()
        .trim()
        .min(2)
        .max(50)
        .required()
        .messages({
            'any.required': 'شهر الزامی است',
        }),

    // Optional canonical IDs; text fields remain required for legacy compatibility.
    provinceId: Joi.number().integer().positive().optional(),
    cityId: Joi.number().integer().positive().optional(),

    address: Joi.string()
        .trim()
        .min(10)
        .max(500)
        .required()
        .messages({
            'string.min': 'آدرس باید حداقل ۱۰ کاراکتر باشد',
            'string.max': 'آدرس نباید بیشتر از ۵۰۰ کاراکتر باشد',
            'any.required': 'آدرس الزامی است',
        }),

    plaque: Joi.string()
        .trim()
        .max(20)
        .required()
        .messages({
            'string.max': 'پلاک نباید بیشتر از ۲۰ کاراکتر باشد',
            'any.required': 'پلاک الزامی است',
        }),

    unit: Joi.string()
        .trim()
        .max(20)
        .optional()
        .allow('')
        .messages({
            'string.max': 'واحد نباید بیشتر از ۲۰ کاراکتر باشد',
        }),

    postalCode: Joi.any()
        .custom(normalizePostalCodeForJoi, 'postal code normalizer')
        .required()
        .messages({
            'string.pattern.base': 'کد پستی باید ۱۰ رقم باشد',
            'any.required': 'کد پستی الزامی است',
        }),

    isDefault: Joi.boolean().default(false),

    location: Joi.object({
        lat: Joi.number().min(-90).max(90).optional(),
        lng: Joi.number().min(-180).max(180).optional(),
    }).optional(),
}).or('recipientPhone', 'recipientMobile', 'phone');

/**
 * Address update schema (all fields optional)
 */
const addressUpdateSchema = Joi.object({
    title: Joi.string()
        .trim()
        .max(100)
        .optional(),

    // Buyer info (optional)
    fullName: Joi.string().trim().min(2).max(100).optional(),

    mobile: Joi.any().custom(normalizeIranMobileOptionalForJoi, 'iran mobile normalizer').optional(),

    nationalCode: Joi.any().custom(normalizeNationalCodeOptionalForJoi, 'national code normalizer').optional(),

    recipientName: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .optional(),

    // Recipient phone (accept both legacy `recipientMobile` and canonical `recipientPhone`)
    recipientPhone: Joi.any().custom(normalizeIranMobileOptionalForJoi, 'iran mobile normalizer').optional(),

    recipientMobile: Joi.any().custom(normalizeIranMobileOptionalForJoi, 'iran mobile normalizer').optional(),

    recipientNationalCode: Joi.any().custom(normalizeNationalCodeOptionalForJoi, 'national code normalizer').optional(),

    province: Joi.string()
        .trim()
        .min(2)
        .max(50)
        .optional(),

    city: Joi.string()
        .trim()
        .min(2)
        .max(50)
        .optional(),

    // Optional canonical IDs. Omitting them leaves existing legacy values unchanged.
    provinceId: Joi.number().integer().positive().optional(),
    cityId: Joi.number().integer().positive().optional(),

    address: Joi.string()
        .trim()
        .min(10)
        .max(500)
        .optional(),

    plaque: Joi.string()
        .trim()
        .max(20)
        .optional(),

    unit: Joi.string()
        .trim()
        .max(20)
        .optional()
        .allow(''),

    postalCode: Joi.any().custom(normalizePostalCodeForJoi, 'postal code normalizer').optional(),

    isDefault: Joi.boolean().optional(),

    location: Joi.object({
        lat: Joi.number().min(-90).max(90).optional(),
        lng: Joi.number().min(-180).max(180).optional(),
    }).optional(),
});

module.exports = {
    userUpdateSchema,
    userProfileUpdateSchema,
    userIdSchema,
    userListQuerySchema,
    addressSchema,
    addressUpdateSchema,
};

