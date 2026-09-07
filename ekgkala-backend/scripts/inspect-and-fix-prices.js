const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const mongoose = require('mongoose')
const Product = require('../models/Product')

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala'

async function run() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(uri)
  console.log('Connected to DB:', mongoose.connection.name)

  // 1. Check product with SKU '2738' or name matching "مدار جک برقی 220 ولتی سوزوکی مدل رز"
  const targetProducts = await Product.find({
    $or: [
      { sku: '2738' },
      { name: /مدار جک برقی 220 ولتی سوزوکی/i }
    ]
  }).lean()

  console.log(`\nFound ${targetProducts.length} product(s) matching SKU 2738 / "مدار جک برقی 220 ولتی سوزوکی":`)
  targetProducts.forEach((p, idx) => {
    console.log(`--- Product ${idx + 1} ---`)
    console.log(`ID: ${p._id}`)
    console.log(`Name: ${p.name}`)
    console.log(`SKU: ${p.sku}`)
    console.log(`ProductCode: ${p.productCode}`)
    console.log(`Price: ${p.price}`)
    console.log(`CompareAtPrice: ${p.compareAtPrice}`)
    console.log(`Discount: ${p.discount}`)
    console.log(`ProductType: ${p.productType}`)
    console.log(`Variants count: ${p.variants?.length || 0}`)
    if (p.variants?.length > 0) {
      console.log('Variants prices:', p.variants.map(v => ({ id: v._id, sku: v.sku, price: v.price })))
    }
  })

  // 2. Clean up stale/inflated compareAtPrice on products with discount === 0
  const inflatedProducts = await Product.find({
    compareAtPrice: { $exists: true, $ne: null },
    $or: [{ discount: { $exists: false } }, { discount: 0 }, { discount: null }],
    isSpecialOffer: { $ne: true },
    isFlashDeal: { $ne: true },
  })

  console.log(`\nFound ${inflatedProducts.length} product(s) with compareAtPrice but no active discount/promotion.`)

  let fixedCount = 0
  for (const p of inflatedProducts) {
    console.log(`Cleaning compareAtPrice on product: "${p.name}" (Price: ${p.price}, CompareAtPrice: ${p.compareAtPrice})`)
    await Product.updateOne({ _id: p._id }, { $unset: { compareAtPrice: "" } })
    fixedCount++
  }

  console.log(`\n✅ Successfully cleaned compareAtPrice on ${fixedCount} product(s).`)

  await mongoose.disconnect()
  console.log('Disconnected from DB.')
}

run().catch(console.error)
