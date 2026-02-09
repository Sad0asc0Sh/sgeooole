/**
 * اسکریپت برای ایجاد داده نمونه سبد رها شده
 * برای تست سیستم ارسال ایمیل یادآوری
 *
 * نحوه اجرا: node seedAbandonedCart.js
 */

require('dotenv').config()
const mongoose = require('mongoose')
const User = require('./models/Admin') // Admin.js exports the User model
const Product = require('./models/Product')
const Cart = require('./models/Cart')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'

async function seedAbandonedCart() {
  try {
    // اتصال به دیتابیس
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB')

    // ===================================
    // 1. ایجاد یا پیدا کردن کاربر
    // ===================================
    let user = await User.findOne({ email: 'sadra.shahri@gmail.com' })

    if (!user) {
      console.log('📝 Creating test user...')
      user = await User.create({
        name: 'صدرا شهری',
        email: 'sadra.shahri@gmail.com',
        password: 'Test123456', // رمز عبور نمونه
        role: 'user', // role: 'user' for regular customers
        isActive: true,
      })
      console.log('✅ Test user created:', user.email)
    } else {
      console.log('✅ Test user already exists:', user.email)
    }

    // ===================================
    // 2. پیدا کردن یا ایجاد محصولات نمونه
    // ===================================
    let products = await Product.find({ isActive: true }).limit(3).lean()

    if (products.length === 0) {
      console.log('📝 No products found, creating sample products...')

      const sampleProducts = [
        {
          name: 'ویتامین D3 1000 واحد',
          slug: 'vitamin-d3-1000',
          sku: 'VIT-D3-1000',
          productType: 'simple',
          price: 250000,
          compareAtPrice: 300000,
          stock: 100,
          isActive: true,
          isFeatured: true,
          description: 'ویتامین D3 با دوز 1000 واحد بین‌المللی برای تقویت سیستم ایمنی',
          images: ['https://via.placeholder.com/300x300?text=Vitamin+D3'],
        },
        {
          name: 'مولتی ویتامین کامل',
          slug: 'multi-vitamin-complete',
          sku: 'MULTI-VIT-001',
          productType: 'simple',
          price: 450000,
          compareAtPrice: 500000,
          stock: 50,
          isActive: true,
          isFeatured: true,
          description: 'مولتی ویتامین کامل با 25 ویتامین و مواد معدنی',
          images: ['https://via.placeholder.com/300x300?text=Multi+Vitamin'],
        },
        {
          name: 'امگا 3 فیش اویل',
          slug: 'omega-3-fish-oil',
          sku: 'OMEGA-3-1000',
          productType: 'simple',
          price: 350000,
          compareAtPrice: 400000,
          stock: 75,
          isActive: true,
          isFeatured: true,
          description: 'امگا 3 با 1000 میلی‌گرم روغن ماهی برای سلامت قلب و مغز',
          images: ['https://via.placeholder.com/300x300?text=Omega+3'],
        },
      ]

      products = await Product.insertMany(sampleProducts)
      console.log(`✅ Created ${products.length} sample products`)
    } else {
      console.log(`✅ Found ${products.length} existing products`)
    }

    // ===================================
    // 3. حذف سبد قبلی کاربر (اگر وجود دارد)
    // ===================================
    await Cart.deleteMany({ user: user._id })
    console.log('🗑️  Removed any existing carts for this user')

    // ===================================
    // 4. ایجاد سبد رها شده
    // ===================================
    console.log('📝 Creating abandoned cart...')

    // زمان 2 ساعت پیش (برای تست)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

    const cartItems = products.map((product, index) => {
      // Extract image URL (handle both string and object formats)
      let imageUrl = 'https://via.placeholder.com/300x300?text=Product'
      if (product.images && product.images.length > 0) {
        const firstImage = product.images[0]
        imageUrl = typeof firstImage === 'string' ? firstImage : firstImage.url
      }

      return {
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: index + 1, // 1, 2, 3
        image: imageUrl,
        variantOptions: [],
      }
    })

    const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

    const cart = await Cart.create({
      user: user._id,
      items: cartItems,
      status: 'active',
      totalPrice: totalPrice,
      createdAt: twoHoursAgo,
      updatedAt: twoHoursAgo, // مهم: زمان به‌روزرسانی را 2 ساعت پیش قرار می‌دهیم
    })

    console.log('✅ Abandoned cart created successfully!')
    console.log('\n📊 Cart Details:')
    console.log('   User:', user.email)
    console.log('   Items:', cart.items.length)
    console.log('   Total Price:', cart.totalPrice.toLocaleString('fa-IR'), 'تومان')
    console.log('   Status:', cart.status)
    console.log('   Updated At:', cart.updatedAt)
    console.log('   Cart ID:', cart._id)

    console.log('\n🎯 Next Steps:')
    console.log('1. به صفحه "سبدهای رها شده" در پنل ادمین بروید')
    console.log('2. سبد خرید کاربر "صدرا شهری" را پیدا کنید')
    console.log('3. روی دکمه "ایمیل" کلیک کنید')
    console.log('4. ایمیل به آدرس sadra.shahri@gmail.com ارسال می‌شود')
    console.log('\n⚠️  تنظیمات SMTP را در فایل .env بررسی کنید!')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding data:', error)
    process.exit(1)
  }
}

// اجرای اسکریپت
seedAbandonedCart()
