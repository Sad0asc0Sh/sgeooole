/**
 * Authentication Joi Schemas
 * 
 * Secure validation rules for all authentication-related endpoints.
 * Follows security best practices with strict input validation.
 */

const Joi = require('joi');
const { normalizeIranMobile, toEnglishDigits } = require('../../utils/phone');

// ============================================
// Common Validation Patterns
// ============================================

// MongoDB ObjectId pattern
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

// Iranian mobile number pattern (09xxxxxxxxx)
const iranMobilePattern = /^09\d{9}$/;

// Strong password pattern (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// ============================================
// Authentication Schemas
// ============================================

const normalizeIranMobileForJoi = (value, helpers) => {
    const normalized = normalizeIranMobile(value);
    if (!normalized) {
        return helpers.message('شماره موبایل معتبر نیست (فرمت درست: 09xxxxxxxxx)');
    }
    return normalized;
};

const normalizeIranMobileOptionalForJoi = (value, helpers) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return normalizeIranMobileForJoi(value, helpers);
};

const normalizeIranMobileClearableForJoi = (value, helpers) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string' && value.trim() === '') return '';
    return normalizeIranMobileForJoi(value, helpers);
};

const normalizeNationalCodeForJoi = (value, helpers) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string' && value.trim() === '') return '';

    const normalized = toEnglishDigits(value).replace(/\D/g, '');
    if (!/^\d{10}$/.test(normalized)) {
        return helpers.message('کد ملی باید ۱۰ رقم باشد');
    }
    return normalized;
};

const normalizeShebaForJoi = (value, helpers) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string' && value.trim() === '') return '';

    // Normalize: remove spaces, convert Persian digits, uppercase
    let normalized = toEnglishDigits(String(value)).replace(/\s+/g, '').toUpperCase();

    // Allow entering just 24 digits (without "IR")
    if (/^\d{24}$/.test(normalized)) {
        normalized = `IR${normalized}`;
    }

    if (!/^IR\d{24}$/.test(normalized)) {
        return helpers.message('شماره شبا نامعتبر است (باید با IR شروع شود و ۲۶ کاراکتر باشد)');
    }

    return normalized;
};

/**
 * Register new user/admin schema
 */
const registerSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.min': 'نام باید حداقل ۲ کاراکتر باشد',
            'string.max': 'نام نباید بیشتر از ۱۰۰ کاراکتر باشد',
            'any.required': 'نام الزامی است',
        }),

    email: Joi.string()
        .trim()
        .lowercase()
        .email({ tlds: { allow: false } })
        .max(254)
        .required()
        .messages({
            'string.email': 'فرمت ایمیل نامعتبر است',
            'any.required': 'ایمیل الزامی است',
        }),

    password: Joi.string()
        .min(6)
        .max(128)
        .required()
        .messages({
            'string.min': 'رمز عبور باید حداقل ۶ کاراکتر باشد',
            'string.max': 'رمز عبور نباید بیشتر از ۱۲۸ کاراکتر باشد',
            'any.required': 'رمز عبور الزامی است',
        }),

    mobile: Joi.string()
        .pattern(iranMobilePattern)
        .optional()
        .messages({
            'string.pattern.base': 'شماره موبایل باید در فرمت 09xxxxxxxxx باشد',
        }),

    role: Joi.string()
        .valid('user', 'admin', 'manager', 'superadmin')
        .optional()
        .messages({
            'any.only': 'نقش کاربر نامعتبر است',
        }),
});

/**
 * Login schema
 */
const loginSchema = Joi.object({
    identifier: Joi.string()
        .trim()
        .required()
        .messages({
            'any.required': 'نام کاربری، ایمیل یا شماره موبایل الزامی است',
            'string.empty': 'نام کاربری، ایمیل یا شماره موبایل نمی‌تواند خالی باشد',
        }),

    password: Joi.string()
        .max(128)
        .required()
        .messages({
            'any.required': 'رمز عبور الزامی است',
            'string.empty': 'رمز عبور نمی‌تواند خالی باشد',
        }),
});

/**
 * Forgot password schema
 */
const forgotPasswordSchema = Joi.object({
    email: Joi.string()
        .trim()
        .lowercase()
        .email({ tlds: { allow: false } })
        .max(254)
        .required()
        .messages({
            'string.email': 'فرمت ایمیل نامعتبر است',
            'any.required': 'ایمیل الزامی است',
        }),
});

/**
 * Reset password schema
 */
const resetPasswordSchema = Joi.object({
    password: Joi.string()
        .min(6)
        .max(128)
        .required()
        .messages({
            'string.min': 'رمز عبور باید حداقل ۶ کاراکتر باشد',
            'string.max': 'رمز عبور نباید بیشتر از ۱۲۸ کاراکتر باشد',
            'any.required': 'رمز عبور الزامی است',
        }),

    confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .optional()
        .messages({
            'any.only': 'تکرار رمز عبور مطابقت ندارد',
        }),
});

/**
 * Change password schema (for logged-in users)
 */
const changePasswordSchema = Joi.object({
    currentPassword: Joi.string()
        .max(128)
        .required()
        .messages({
            'any.required': 'رمز عبور فعلی الزامی است',
        }),

    newPassword: Joi.string()
        .min(6)
        .max(128)
        .required()
        .messages({
            'string.min': 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد',
            'string.max': 'رمز عبور جدید نباید بیشتر از ۱۲۸ کاراکتر باشد',
            'any.required': 'رمز عبور جدید الزامی است',
        }),
});

 /**
  * Update profile schema
  */
 const updateProfileSchema = Joi.object({
     name: Joi.string()
         .trim()
         .min(2)
         .max(100)
         .optional()
         .messages({
             'string.min': 'نام باید حداقل ۲ کاراکتر باشد',
             'string.max': 'نام نباید بیشتر از ۱۰۰ کاراکتر باشد',
         }),

     password: Joi.string()
         .min(6)
         .max(128)
         .optional()
         .allow('')
         .messages({
             'string.min': 'رمز عبور باید حداقل ۶ کاراکتر باشد',
             'string.max': 'رمز عبور نباید بیشتر از ۱۲۸ کاراکتر باشد',
         }),

     email: Joi.string()
         .trim()
         .lowercase()
         .empty('')
         .email({ tlds: { allow: false } })
         .max(254)
         .optional()
         .messages({
             'string.email': 'فرمت ایمیل نامعتبر است',
         }),

     mobile: Joi.any()
         .custom(normalizeIranMobileOptionalForJoi, 'iran mobile normalizer')
         .optional(),

     // Personal Info
     nationalCode: Joi.any()
         .custom(normalizeNationalCodeForJoi, 'national code normalizer')
         .optional(),

     birthDate: Joi.date()
         .iso()
         .empty('')
         .optional()
         .allow(null)
         .messages({
             'date.format': 'فرمت تاریخ تولد نامعتبر است',
             'date.base': 'تاریخ تولد نامعتبر است',
         }),

     gender: Joi.string()
         .valid('male', 'female')
         .optional()
         .allow('')
         .messages({
             'any.only': 'جنسیت نامعتبر است',
         }),

     birthPlace: Joi.string()
         .trim()
         .max(100)
         .optional()
         .allow('')
         .messages({
             'string.max': 'محل تولد نباید بیشتر از ۱۰۰ کاراکتر باشد',
         }),

     secondMobile: Joi.any()
         .custom(normalizeIranMobileClearableForJoi, 'iran mobile normalizer')
         .optional(),

     landline: Joi.string()
         .trim()
         .max(30)
         .optional()
         .allow('')
         .messages({
             'string.max': 'تلفن ثابت نباید بیشتر از ۳۰ کاراکتر باشد',
         }),

     province: Joi.string()
         .trim()
         .max(100)
         .optional()
         .allow(''),

     city: Joi.string()
         .trim()
         .max(100)
         .optional()
         .allow(''),

     shebaNumber: Joi.any()
         .custom(normalizeShebaForJoi, 'sheba normalizer')
         .optional(),

     // Legal Info
     isLegal: Joi.boolean()
         .optional(),

     companyName: Joi.string()
         .trim()
         .max(150)
         .optional()
         .allow(''),

     companyNationalId: Joi.string()
         .trim()
         .max(50)
         .optional()
         .allow(''),

     companyRegistrationId: Joi.string()
         .trim()
         .max(50)
         .optional()
         .allow(''),

     companyLandline: Joi.string()
         .trim()
         .max(30)
         .optional()
         .allow(''),

     companyProvince: Joi.string()
         .trim()
         .max(100)
         .optional()
         .allow(''),

     companyCity: Joi.string()
         .trim()
         .max(100)
         .optional()
         .allow(''),

     avatar: Joi.string()
         .uri()
         .optional()
         .allow(''),
 });

/**
 * OTP request schema
 */
const sendOtpSchema = Joi.object({
    mobile: Joi.string()
        .required()
        .custom(normalizeIranMobileForJoi, 'iran mobile normalizer')
        .messages({
            'any.required': 'شماره موبایل الزامی است',
            'string.empty': 'شماره موبایل الزامی است',
        }),
});

/**
 * OTP verification schema
 */
const verifyOtpSchema = Joi.object({
    mobile: Joi.string()
        .required()
        .custom(normalizeIranMobileForJoi, 'iran mobile normalizer')
        .messages({
            'any.required': 'شماره موبایل الزامی است',
            'string.empty': 'شماره موبایل الزامی است',
        }),

    code: Joi.string()
        .length(4)
        .pattern(/^\d{4}$/)
        .required()
        .messages({
            'string.length': 'کد تأیید باید ۴ رقم باشد',
            'string.pattern.base': 'کد تأیید باید فقط شامل اعداد باشد',
            'any.required': 'کد تأیید الزامی است',
        }),
});

module.exports = {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
    updateProfileSchema,
    sendOtpSchema,
    verifyOtpSchema,
    // Export patterns for reuse
    patterns: {
        objectIdPattern,
        iranMobilePattern,
        strongPasswordPattern,
    },
};
