const assert = require('node:assert/strict')

const {
  addressSchema,
  addressUpdateSchema,
} = require('../validators/joiSchemas/userSchemas')
const { orderCreateSchema } = require('../validators/joiSchemas/orderSchemas')
const User = require('../models/User')

const legacyAddress = {
  recipientName: 'علی احمدی',
  recipientPhone: '09123456789',
  province: 'تهرون',
  city: 'تهرون',
  address: 'تهران، خیابان آزادی، کوچه نمونه، پلاک ۱۲',
  plaque: '۱۲',
  postalCode: '1234567890',
}

assert.equal(
  addressSchema.validate(legacyAddress).error,
  undefined,
  'آدرس قدیمی با نام‌های غیر استاندارد باید همچنان پذیرفته شود',
)

assert.equal(
  addressSchema.validate({
    ...legacyAddress,
    province: 'تهران',
    city: 'تهران',
    provinceId: 8,
    cityId: 1,
  }).error,
  undefined,
  'آدرس استاندارد با شناسه‌های اختیاری باید پذیرفته شود',
)

assert.equal(
  addressUpdateSchema.validate({ address: 'تهران، خیابان انقلاب، پلاک ۲' }).error,
  undefined,
  'ویرایش فیلدهای غیرمکان نباید کاربران قدیمی را به تغییر استان یا شهر مجبور کند',
)

const orderBase = {
  orderItems: [{
    product: '507f1f77bcf86cd799439011',
    name: 'کالای آزمایشی',
    quantity: 1,
    price: 100000,
  }],
  paymentMethod: 'online',
  itemsPrice: 100000,
  shippingPrice: 0,
  totalPrice: 100000,
}

assert.equal(
  orderCreateSchema.validate({
    ...orderBase,
    shippingAddress: {
      fullName: 'علی احمدی',
      phone: '09123456789',
      province: 'تهرون',
      city: 'تهرون',
      address: 'تهران، خیابان آزادی، کوچه نمونه، پلاک ۱۲',
      postalCode: '1234567890',
    },
  }).error,
  undefined,
  'ثبت سفارش با آدرس قدیمی نباید متوقف شود',
)

assert.equal(
  orderCreateSchema.validate({
    ...orderBase,
    shippingAddress: {
      fullName: 'علی احمدی',
      phone: '09123456789',
      province: 'تهران',
      city: 'تهران',
      provinceId: 8,
      cityId: 1,
      address: 'تهران، خیابان آزادی، کوچه نمونه، پلاک ۱۲',
      postalCode: '1234567890',
    },
  }).error,
  undefined,
  'ثبت سفارش با آدرس استاندارد و شناسه‌های جدید باید پذیرفته شود',
)

const legacyUser = new User({
  mobile: '09123456789',
  addresses: [legacyAddress],
})
assert.equal(
  legacyUser.validateSync(),
  undefined,
  'مدل کاربر باید آدرس قدیمی بدون شناسه‌های مکان را نگه دارد',
)

const canonicalUser = new User({
  mobile: '09123456780',
  addresses: [{
    ...legacyAddress,
    province: 'تهران',
    city: 'تهران',
    provinceId: 8,
    cityId: 1,
  }],
})
assert.equal(
  canonicalUser.validateSync(),
  undefined,
  'مدل کاربر باید شناسه‌های اختیاری مکان را نگه دارد',
)
assert.equal(canonicalUser.addresses[0].provinceId, 8)
assert.equal(canonicalUser.addresses[0].cityId, 1)

console.log('Location schema compatibility tests passed.')
