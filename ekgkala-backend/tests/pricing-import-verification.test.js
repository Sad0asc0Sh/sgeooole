const assert = require('assert')

// Replicate functions from routes/products.js to test logic in isolation
const normalizeDigits = (value) => {
  if (value == null) return ''
  return String(value)
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584))
}

const normalizePersianText = (value) => {
  if (value == null) return ''
  return String(value)
    .replace(/[​‌‍﻿]/g, ' ')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ة]/g, 'ه')
    .replace(/[آأإ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const parseCsvNumber = (value, fallback = 0, currency = 'toman') => {
  if (value === undefined || value === null || value === '') return fallback
  let str = normalizeDigits(value).trim()

  str = str.replace(/(تومان|ریال|ت|ر|IRR|TOMAN|IR[RT])/gi, '').trim()
  str = str.replace(/[\s ​‌﻿]/g, '')
  str = str.replace(/٫/g, '.')
  str = str.replace(/٬/g, '')

  const hasComma = str.includes(',')
  const hasDot = str.includes('.')

  if (hasComma && hasDot) {
    const firstComma = str.indexOf(',')
    const firstDot = str.indexOf('.')
    if (firstComma < firstDot) {
      str = str.replace(/,/g, '')
    } else {
      str = str.replace(/\./g, '').replace(/,/g, '.')
    }
  } else if (hasDot) {
    const dotCount = (str.match(/\./g) || []).length
    if (dotCount > 1) {
      str = str.replace(/\./g, '')
    } else {
      const parts = str.split('.')
      if (parts[1] && parts[1].length === 3 && parts[0].length >= 1) {
        str = parts[0] + parts[1]
      }
    }
  } else if (hasComma) {
    const commaCount = (str.match(/,/g) || []).length
    if (commaCount > 1) {
      str = str.replace(/,/g, '')
    } else {
      const parts = str.split(',')
      if (parts[1] && parts[1].length === 3 && parts[0].length >= 1) {
        str = parts[0] + parts[1]
      } else if (parts[1] && parts[1].length <= 2) {
        str = parts[0] + '.' + parts[1]
      } else {
        str = str.replace(/,/g, '')
      }
    }
  }

  const cleaned = str.replace(/[^\d.-]/g, '')
  if (!cleaned) return fallback
  let parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return fallback

  if (currency === 'rial' || currency === 'irr') {
    parsed = Math.round(parsed / 10)
  }

  return parsed
}

const HEADER_ALIASES = {
  name: ['name', 'title', 'نام محصول', 'نام کالا', 'نام', 'عنوان', 'عنوان کالا'],
  sku: ['sku', 'کد کالا', 'کد انبار', 'بارکد', 'شناسه', 'شناسه کالا', 'شناسه انبار'],
  productCode: ['productcode', 'product_code', 'کد محصول', 'شناسه محصول'],
  productType: ['producttype', 'product_type', 'type', 'نوع محصول', 'نوع'],
  price: ['price', 'قیمت', 'قیمت فروش', 'مبلغ', 'مبلغ فروش', 'نرخ', 'نرخ فروش', 'قیمت (تومان)', 'قیمت_تومان', 'قیمت به تومان', 'قیمت تومان'],
  priceRial: ['price_rial', 'price_irr', 'قیمت (ریال)', 'قیمت_ریال', 'قیمت به ریال', 'قیمت ریال', 'مبلغ (ریال)', 'مبلغ_ریال', 'نرخ ریال', 'قیمت ریالی'],
  compareAtPrice: ['compareatprice', 'compare_at_price', 'regular_price', 'oldprice', 'قیمت مقایسه', 'قیمت قبل از تخفیف', 'قیمت خط خورده', 'قیمت اصلی', 'قیمت مصرف کننده', 'قیمت قبل تخفیف'],
  compareAtPriceRial: ['compareatprice_rial', 'compare_at_price_rial', 'قیمت مقایسه (ریال)', 'قیمت قبل از تخفیف (ریال)'],
  stock: ['stock', 'quantity', 'qty', 'count', 'موجودی', 'تعداد', 'موجودی انبار', 'تعداد موجود', 'موجودی کالا'],
  category: ['category', 'دسته‌بندی', 'دسته بندی', 'دسته', 'گروه کالا', 'گروه'],
  brand: ['brand', 'برند', 'سازنده', 'شرکت سازنده', 'مارک'],
  description: ['description', 'desc', 'توضیحات', 'توضیحات محصول', 'شرح', 'شرح کالا', 'توضیح'],
  isActive: ['isactive', 'is_active', 'active', 'status', 'وضعیت', 'فعال', 'وضعیت فعال'],
  isFeatured: ['isfeatured', 'is_featured', 'featured', 'ویژه', 'محصول ویژه', 'پیشنهاد ویژه'],
  imageUrls: ['imageurls', 'image_urls', 'images', 'imageurl', 'image_url', 'تصاویر', 'تصویر', 'عکس', 'لینک تصویر', 'لینک عکس'],
}

const normalizeImportRow = (rawRow = {}, globalCurrency = 'toman') => {
  const normalized = {}
  const rawKeys = Object.keys(rawRow)

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const key of rawKeys) {
      const cleanKey = String(key || '').trim().toLowerCase().replace(/[\s_\-]+/g, '')
      const matched = aliases.some((alias) => {
        const cleanAlias = alias.toLowerCase().replace(/[\s_\-]+/g, '')
        return cleanKey === cleanAlias || key.trim() === alias
      })
      if (matched && rawRow[key] !== undefined && rawRow[key] !== '') {
        normalized[field] = rawRow[key]
        break
      }
    }
  }

  let rawPriceVal = normalized.price
  let rowCurrency = globalCurrency

  if (normalized.priceRial !== undefined && normalized.priceRial !== '') {
    rawPriceVal = normalized.priceRial
    rowCurrency = 'rial'
  }

  let rawCompareVal = normalized.compareAtPrice
  let compareCurrency = globalCurrency
  if (normalized.compareAtPriceRial !== undefined && normalized.compareAtPriceRial !== '') {
    rawCompareVal = normalized.compareAtPriceRial
    compareCurrency = 'rial'
  }

  return {
    rawRow,
    name: normalized.name,
    sku: normalized.sku,
    productCode: normalized.productCode,
    productType: normalized.productType,
    rawPrice: rawPriceVal,
    priceCurrency: rowCurrency,
    rawCompareAtPrice: rawCompareVal,
    compareCurrency: compareCurrency,
    stock: normalized.stock,
    category: normalized.category,
    brand: normalized.brand,
    description: normalized.description,
    isActive: normalized.isActive,
    isFeatured: normalized.isFeatured,
    imageUrls: normalized.imageUrls,
  }
}

console.log('🧪 Starting Verification Tests...')

// Test 1: Number parsing with dots as thousands separator (1.100.000)
assert.strictEqual(parseCsvNumber('1.100.000', 0, 'toman'), 1100000, 'Test 1 failed: 1.100.000 should parse to 1100000')
console.log('✅ Test 1 Passed: 1.100.000 -> 1,100,000')

// Test 2: Rial to Toman conversion (11,000,000 Rial -> 1,100,000 Toman - removes the extra zero!)
assert.strictEqual(parseCsvNumber('11000000', 0, 'rial'), 1100000, 'Test 2 failed: 11000000 Rial should convert to 1100000 Toman')
assert.strictEqual(parseCsvNumber('11.000.000', 0, 'rial'), 1100000, 'Test 2b failed: 11.000.000 Rial should convert to 1100000 Toman')
assert.strictEqual(parseCsvNumber('11,000,000', 0, 'rial'), 1100000, 'Test 2c failed: 11,000,000 Rial should convert to 1100000 Toman')
console.log('✅ Test 2 Passed: 11,000,000 Rials converts to 1,100,000 Tomans (Extra zero eliminated!)')

// Test 3: Persian digits and comma (۱،۱۰۰،۰۰۰)
assert.strictEqual(parseCsvNumber('۱،۱۰۰،۰۰۰', 0, 'toman'), 1100000, 'Test 3 failed: ۱،۱۰۰،۰۰۰ should parse to 1100000')
assert.strictEqual(parseCsvNumber('۱.۱۰۰.۰۰۰', 0, 'toman'), 1100000, 'Test 3b failed: ۱.۱۰۰.۰۰۰ should parse to 1100000')
console.log('✅ Test 3 Passed: Persian digits with commas and dots correctly parsed')

// Test 4: Currency suffix stripping
assert.strictEqual(parseCsvNumber('1,100,000 تومان', 0, 'toman'), 1100000, 'Test 4 failed: تومان suffix')
assert.strictEqual(parseCsvNumber('11,000,000 ریال', 0, 'rial'), 1100000, 'Test 4b failed: ریال suffix with rial conversion')
console.log('✅ Test 4 Passed: Currency text suffixes handled correctly')

// Test 5: Persian Text Normalization for Categories & Brands
const dbCat = normalizePersianText('دوربین مداربسته')
const csvCat1 = normalizePersianText('دوربين مداربسته') // Arabic yeh
const csvCat2 = normalizePersianText('دوربین‌مداربسته') // ZWNJ
assert.strictEqual(csvCat1, dbCat, 'Test 5a failed: Arabic yeh normalization')
assert.strictEqual(csvCat2.replace(/\s+/g, ''), dbCat.replace(/\s+/g, ''), 'Test 5b failed: ZWNJ normalization')
console.log('✅ Test 5 Passed: Persian/Arabic category and brand text normalization')

// Test 6: Persian Header Aliases & Automatic Rial Header Detection
const persianRialRow = {
  'نام محصول': 'دوربین تست',
  'کد کالا': 'SKU-99',
  'قیمت (ریال)': '11000000',
  'موجودی': '15',
}
const normalizedRow = normalizeImportRow(persianRialRow, 'toman')
assert.strictEqual(normalizedRow.name, 'دوربین تست', 'Header name match')
assert.strictEqual(normalizedRow.sku, 'SKU-99', 'Header sku match')
assert.strictEqual(normalizedRow.priceCurrency, 'rial', 'Auto-detected Rial from header')
assert.strictEqual(parseCsvNumber(normalizedRow.rawPrice, 0, normalizedRow.priceCurrency), 1100000, 'Parsed price converted from Rial to Toman')
console.log('✅ Test 6 Passed: Persian headers and header-based Rial auto-detection')

console.log('🎉 ALL 6 VERIFICATION TESTS PASSED SUCCESSFULLY!')
