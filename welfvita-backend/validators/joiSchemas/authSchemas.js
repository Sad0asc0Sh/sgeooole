/**
 * Authentication Joi Schemas
 * 
 * Secure validation rules for all authentication-related endpoints.
 * Follows security best practices with strict input validation.
 */

const Joi = require('joi');

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
        .max(128)
        .required()
        .messages({
            'any.required': 'رمز عبور الزامی است',
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
        .pattern(iranMobilePattern)
        .required()
        .messages({
            'string.pattern.base': 'شماره موبایل باید در فرمت 09xxxxxxxxx باشد',
            'any.required': 'شماره موبایل الزامی است',
        }),
});

/**
 * OTP verification schema
 */
const verifyOtpSchema = Joi.object({
    mobile: Joi.string()
        .pattern(iranMobilePattern)
        .required()
        .messages({
            'string.pattern.base': 'شماره موبایل باید در فرمت 09xxxxxxxxx باشد',
            'any.required': 'شماره موبایل الزامی است',
        }),

    otp: Joi.string()
        .length(6)
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.length': 'کد تأیید باید ۶ رقم باشد',
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
