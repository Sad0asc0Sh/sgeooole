const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { orderCreateSchema } = require('../validators/joiSchemas/orderSchemas')
const Order = require('../models/Order')

const orderBase = {
  orderItems: [{
    product: '507f1f77bcf86cd799439011',
    name: 'کالای آزمایشی',
    quantity: 1,
    price: 100000,
  }],
  shippingAddress: {
    fullName: 'علی احمدی',
    phone: '09123456789',
    province: 'خراسان رضوی',
    city: 'مشهد',
    address: 'مشهد، بلوار وکیل‌آباد، کوچه نمونه، پلاک ۱۲',
    postalCode: '1234567890',
  },
  itemsPrice: 100000,
  shippingPrice: 0,
  totalPrice: 100000,
}

assert.equal(
  orderCreateSchema.validate({
    ...orderBase,
    paymentMethod: 'online',
    fulfillmentType: 'mashhad_special_pickup',
    shippingMethod: 'تحویل حضوری ویژه مشهد',
  }).error,
  undefined,
  'تحویل ویژه مشهد با پرداخت آنلاین باید معتبر باشد',
)

assert.notEqual(
  orderCreateSchema.validate({
    ...orderBase,
    paymentMethod: 'cod',
    fulfillmentType: 'shipping',
  }).error,
  undefined,
  'پرداخت در محل نباید برای سفارش جدید معتبر باشد',
)

const specialPickupOrder = new Order({
  user: '507f1f77bcf86cd799439012',
  orderItems: orderBase.orderItems,
  shippingAddress: orderBase.shippingAddress,
  paymentMethod: 'online',
  shippingPrice: 0,
  shippingMethod: 'تحویل حضوری ویژه مشهد',
  fulfillmentType: 'mashhad_special_pickup',
  itemsPrice: 100000,
  taxPrice: 0,
  totalPrice: 100000,
})
assert.equal(
  specialPickupOrder.validateSync(),
  undefined,
  'سفارش تحویل ویژه باید با هزینه تحویل صفر در مدل سفارش معتبر باشد',
)

const checkoutSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/app/checkout/page.tsx'),
  'utf8',
)
const orderControllerSource = fs.readFileSync(
  path.resolve(__dirname, '../controllers/orderController.js'),
  'utf8',
)
assert.ok(
  checkoutSource.includes('const canUseMashhadSpecialPickup = isMashhadAddress;'),
  'نمایش کارت تحویل ویژه باید فقط به نشانی انتخابی مشهد وابسته باشد',
)
assert.ok(
  orderControllerSource.includes("if (!isMashhadShippingAddress(shippingAddress))"),
  'سرور باید نشانی مشهد را پیش از اعمال تحویل ویژه کنترل کند',
)
assert.ok(
  !orderControllerSource.includes('isMashhadPickupEligible'),
  'سرور نباید تحویل ویژه را به پرچم پنهانِ پروفایل وابسته کند',
)

console.log('Mashhad special pickup policy tests passed.')
