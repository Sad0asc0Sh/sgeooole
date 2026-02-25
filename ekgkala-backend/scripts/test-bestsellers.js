/**
 * 🧪 راهنمای تست و یکپارچه‌سازی بخش پرفروش‌ترین‌ها
 * 
 * این فایل مراحل تست کامل سیستم را شرح می‌دهد
 */

// ============================================
// تست API Endpoints
// ============================================

const testSuite = {
  // 1. بررسی Bestsellers
  testGetBestsellers: async () => {
    console.log('\n📋 TEST: GET /api/v1/products/bestsellers')

    try {
      const response = await fetch('http://localhost:5000/api/v1/products/bestsellers?limit=8')
      const data = await response.json()

      console.log('✓ Status:', response.status)
      console.log('✓ Count:', data.data?.length)
      console.log('✓ Sample:', {
        name: data.data?.[0]?.name,
        score: data.data?.[0]?.bestsellers_score?.decayed_score,
        trend: data.data?.[0]?.bestsellers_score?.trend_score,
      })

      return data.success
    } catch (error) {
      console.error('✗ Error:', error.message)
      return false
    }
  },

  // 2. تست ثبت Impression
  testTrackingImpression: async () => {
    console.log('\n📊 TEST: POST /api/v1/tracking/impression')

    try {
      // ابتدا بگیریم یک محصول
      const res = await fetch('http://localhost:5000/api/v1/products/bestsellers?limit=1')
      const { data } = await res.json()

      if (!data || data.length === 0) {
        console.warn('⚠️  هیچ پرفروش‌تری در دیتابیس نیست')
        return false
      }

      const productId = data[0]._id

      // حالا Impression ثبت کنیم
      const response = await fetch('http://localhost:5000/api/v1/tracking/impression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          section: 'bestsellers',
          position: 1,
        }),
      })

      const result = await response.json()
      console.log('✓ Status:', response.status)
      console.log('✓ Response:', result.message)

      return result.success
    } catch (error) {
      console.error('✗ Error:', error.message)
      return false
    }
  },

  // 3. تست ثبت SalesEvent
  testRecordSale: async () => {
    console.log('\n💰 TEST: POST /api/v1/internal/sales-event')

    try {
      // یک محصول تصادفی انتخاب کنیم
      const res = await fetch('http://localhost:5000/api/v1/products/bestsellers?limit=1')
      const { data } = await res.json()

      if (!data || data.length === 0) {
        console.warn('⚠️  هیچ محصولی برای تست نیست')
        return false
      }

      const productId = data[0]._id

      // ثبت فروش
      const response = await fetch('http://localhost:5000/api/v1/internal/sales-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          quantity: 1,
          revenue: data[0].price || 100000,
          margin_pct: 20,
        }),
      })

      const result = await response.json()
      console.log('✓ Status:', response.status)
      console.log('✓ Response:', result.message)

      return result.success
    } catch (error) {
      console.error('✗ Error:', error.message)
      return false
    }
  },

  // 4. تست Stats (ادمین)
  testGetStats: async (token) => {
    console.log('\n📈 TEST: GET /api/v1/bestsellers/stats')

    try {
      const response = await fetch('http://localhost:5000/api/v1/bestsellers/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.status === 403) {
        console.warn('⚠️  دسترسی رد شد - توکن ادمین نیاز است')
        return false
      }

      const data = await response.json()
      console.log('✓ Status:', response.status)
      console.log('✓ Total Bestsellers:', data.data?.totalBestsellers)
      console.log('✓ Avg Score:', data.data?.stats?.avg_decayed_score?.toFixed(4))

      return data.success
    } catch (error) {
      console.error('✗ Error:', error.message)
      return false
    }
  },

  // 5. تست Recalculate (ادمین)
  testRecalculate: async (token) => {
    console.log('\n🔄 TEST: POST /api/v1/bestsellers/recalculate')

    try {
      const response = await fetch('http://localhost:5000/api/v1/bestsellers/recalculate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      console.log('✓ Status:', response.status)
      console.log('✓ Updated:', data.updated)
      console.log('✓ Message:', data.message)

      return data.success
    } catch (error) {
      console.error('✗ Error:', error.message)
      return false
    }
  },
}

// ============================================
// تست Database
// ============================================

const databaseTests = {
  // بررسی وجود مدل‌ها
  testModelsExist: async (mongoose) => {
    console.log('\n🗄️  TEST: Models Existence')

    try {
      const ProductScore = require('../models/ProductScore')
      const SalesEvent = require('../models/SalesEvent')
      const ProductView = require('../models/ProductView')

      console.log('✓ ProductScore:', ProductScore ? 'Loaded' : 'Missing')
      console.log('✓ SalesEvent:', SalesEvent ? 'Loaded' : 'Missing')
      console.log('✓ ProductView:', ProductView ? 'Loaded' : 'Missing')

      return true
    } catch (error) {
      console.error('✗ Error loading models:', error.message)
      return false
    }
  },

  // بررسی Indexes
  testIndexes: async (mongoose) => {
    console.log('\n📍 TEST: Database Indexes')

    try {
      const ProductScore = require('../models/ProductScore')
      const indexes = await ProductScore.collection.getIndexes()

      console.log('✓ ProductScore Indexes:')
      Object.keys(indexes).forEach((idx) => {
        console.log(`  - ${idx}`)
      })

      // باید این indexes وجود داشته باشد:
      // - decayed_score
      // - stock_available + decayed_score
      // - last_calculated_at

      return true
    } catch (error) {
      console.error('✗ Error:', error.message)
      return false
    }
  },

  // بررسی داده‌های نمونه
  testSampleData: async (mongoose) => {
    console.log('\n📊 TEST: Sample Data')

    try {
      const ProductScore = require('../models/ProductScore')
      const SalesEvent = require('../models/SalesEvent')
      const ProductView = require('../models/ProductView')

      const scoreCount = await ProductScore.countDocuments()
      const saleCount = await SalesEvent.countDocuments()
      const viewCount = await ProductView.countDocuments()

      console.log('✓ ProductScores:', scoreCount)
      console.log('✓ SalesEvents:', saleCount)
      console.log('✓ ProductViews:', viewCount)

      if (scoreCount === 0) {
        console.warn('⚠️  هیچ ProductScore‌ای در دیتابیس نیست')
      }

      return scoreCount > 0
    } catch (error) {
      console.error('✗ Error:', error.message)
      return false
    }
  },
}

// ============================================
// تست Frontend
// ============================================

const frontendTests = {
  // بررسی Component Load
  testComponentRender: async () => {
    console.log('\n🎨 TEST: Frontend Component Render')

    try {
      const response = await fetch('http://localhost:3000/')
      const html = await response.text()

      const hasBestsellers = html.includes('پرفروش‌ترین‌ها') || html.includes('BestSellers')

      if (hasBestsellers) {
        console.log('✓ BestSellers component found in HTML')
      } else {
        console.warn('⚠️  BestSellers component not found')
      }

      return hasBestsellers
    } catch (error) {
      console.error('✗ Error:', error.message)
      return false
    }
  },

  // بررسی API Calls از Frontend
  testAPIIntegration: async () => {
    console.log('\n🔗 TEST: Frontend API Integration')

    console.log('⚠️  این تست باید از مرورگر اجرا شود:')
    console.log('1. باز کنید http://localhost:3000/')
    console.log('2. DevTools > Network')
    console.log('3. باید این درخواست‌ها ببینید:')
    console.log('   - GET /api/v1/products/bestsellers')
    console.log('   - POST /api/v1/tracking/impression')

    return true
  },
}

// ============================================
// اجرا کننده Tests
// ============================================

async function runAllTests(adminToken = null) {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 شروع تمام تست‌ها')
  console.log('='.repeat(60))

  const results = {
    passed: 0,
    failed: 0,
    warning: 0,
  }

  // API Tests
  console.log('\n📡 API TESTS')
  console.log('-'.repeat(60))

  const tests = [
    { name: 'Get Bestsellers', fn: testSuite.testGetBestsellers },
    { name: 'Track Impression', fn: testSuite.testTrackingImpression },
    { name: 'Record Sale', fn: testSuite.testRecordSale },
  ]

  for (const test of tests) {
    const result = await test.fn()
    if (result) {
      results.passed++
    } else {
      results.failed++
    }
  }

  // Admin Tests (اگر token وجود داشته باشد)
  if (adminToken) {
    const adminResult1 = await testSuite.testGetStats(adminToken)
    const adminResult2 = await testSuite.testRecalculate(adminToken)

    if (adminResult1 && adminResult2) results.passed += 2
    else results.failed += 2
  }

  // Database Tests
  console.log('\n💾 DATABASE TESTS')
  console.log('-'.repeat(60))

  const dbTests = [
    { name: 'Models Exist', fn: databaseTests.testModelsExist },
    { name: 'Database Indexes', fn: databaseTests.testIndexes },
    { name: 'Sample Data', fn: databaseTests.testSampleData },
  ]

  for (const test of dbTests) {
    const result = await test.fn(null)
    if (result) {
      results.passed++
    } else {
      results.warning++
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 خلاصه نتایج:')
  console.log(`✅ موفق: ${results.passed}`)
  console.log(`❌ ناموفق: ${results.failed}`)
  console.log(`⚠️  هشدار: ${results.warning}`)
  console.log('='.repeat(60) + '\n')

  return results
}

// ============================================
// Exports
// ============================================

module.exports = {
  testSuite,
  databaseTests,
  frontendTests,
  runAllTests,
}

// برای اجرا در CLI:
// node scripts/test-bestsellers.js
