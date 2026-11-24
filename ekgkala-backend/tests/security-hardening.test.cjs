const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
  isPrivateOrReservedIp,
  validateOutboundHttpsUrl,
  assertSafeOutboundUrl,
} = require('../utils/urlSafety')
const {
  escapeHtml,
  sanitizeHtmlContent,
  sanitizeCsvCell,
} = require('../utils/htmlSanitizer')
const { noSqlInjectionPrevention } = require('../middleware/noSqlInjection')
const {
  detectImageSignature,
  isWebpBuffer,
  deleteFromParsPack,
} = require('../lib/parspackS3')
const { findMatchingVariant } = require('../services/pricingService')

const readBackendFile = (relPath) =>
  fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8')

test('SSRF URL safety blocks loopback, RFC1918, link-local, metadata and non-HTTPS hosts', async () => {
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true)
  assert.equal(isPrivateOrReservedIp('10.20.30.40'), true)
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true)
  assert.equal(isPrivateOrReservedIp('172.16.5.4'), true)
  assert.equal(isPrivateOrReservedIp('192.168.1.10'), true)
  assert.equal(isPrivateOrReservedIp('::1'), true)
  assert.equal(isPrivateOrReservedIp('fc00::1'), true)
  assert.equal(isPrivateOrReservedIp('8.8.8.8'), false)

  assert.equal(validateOutboundHttpsUrl('http://127.0.0.1:8080/test').valid, false)
  assert.equal(validateOutboundHttpsUrl('https://169.254.169.254/latest/meta-data').valid, false)
  assert.equal(validateOutboundHttpsUrl('https://user:pass@api.example.com').valid, false)
  assert.equal(validateOutboundHttpsUrl('https://service.internal/v1').valid, false)
  assert.equal(validateOutboundHttpsUrl('https://api.openai.com/v1/chat/completions').valid, true)

  await assert.rejects(() => assertSafeOutboundUrl('http://127.0.0.1/admin'))
})

test('htmlSanitizer neutralizes XSS & CSV injection while keeping structured product styles', () => {
  assert.equal(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;')

  const dirty =
    '<div style="background: #f9fafb; border-radius: 12px; direction: rtl; margin: 10px auto; width: 100%; max-width: 900px; box-sizing: border-box; display: block;">' +
    '<p onclick="alert(1)">توضیح امن</p>' +
    '<a href="&#x6a;avascript:alert(1)">کلیک</a>' +
    '<script>fetch("https://evil.example")</script>' +
    '<iframe src="https://evil.example"></iframe>' +
    '<svg onload="alert(1)"><circle/></svg>' +
    '<div style="width:expression(alert(1))">badstyle</div>' +
    '</div>'

  const cleaned = sanitizeHtmlContent(dirty)
  assert.equal(cleaned.includes('<script'), false)
  assert.equal(cleaned.includes('<iframe'), false)
  assert.equal(cleaned.includes('<svg'), false)
  assert.equal(cleaned.includes('onclick'), false)
  assert.equal(cleaned.toLowerCase().includes('javascript:'), false)
  assert.equal(cleaned.toLowerCase().includes('expression('), false)
  assert.equal(
    cleaned.includes(
      'style="background: #f9fafb; border-radius: 12px; direction: rtl; margin: 10px auto; width: 100%; max-width: 900px; box-sizing: border-box; display: block;"',
    ),
    true,
  )

  assert.equal(sanitizeCsvCell('=CMD|"/C calc"!A0'), '"\'=CMD|""/C calc""!A0"')
  assert.equal(sanitizeCsvCell('+1+1'), "'+1+1")
  assert.equal(sanitizeCsvCell('@SUM(A1:A2)'), "'@SUM(A1:A2)")
  assert.equal(sanitizeCsvCell('\t=2+2'), "'\t=2+2")
  assert.equal(sanitizeCsvCell(125000), '125000')
})

test('NoSQL injection middleware blocks operator & prototype pollution keys while allowing literal $ in text', () => {
  const mw = noSqlInjectionPrevention({ logAttempts: false })
  const invoke = (body) =>
    new Promise((resolve) => {
      let nextCalled = false
      const req = { body, query: {}, params: {}, ip: '127.0.0.1', method: 'POST', originalUrl: '/test', get: () => '' }
      const res = {
        statusCode: 200,
        status(code) {
          this.statusCode = code
          return this
        },
        json(payload) {
          resolve({ blocked: true, status: this.statusCode, payload })
        },
      }
      mw(req, res, () => {
        nextCalled = true
        resolve({ blocked: false, nextCalled })
      })
    })

  return (async () => {
    const operatorHit = await invoke({ email: { $ne: null } })
    assert.equal(operatorHit.blocked, true)
    assert.equal(operatorHit.status, 400)

    const protoObj = JSON.parse('{"__proto__":{"polluted":true}}')
    const protoHit = await invoke(protoObj)
    assert.equal(protoHit.blocked, true)
    assert.equal(protoHit.status, 400)

    const cleanDollarText = await invoke({ message: 'قیمت محصول $100 یا 50% تخفیف است' })
    assert.equal(cleanDollarText.blocked, false)
    assert.equal(cleanDollarText.nextCalled, true)
  })()
})

test('Upload magic-byte detection and ParsPack S3 key path-traversal checks fail closed', async () => {
  const jpegBuf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)])
  const pngBuf = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(16),
  ])
  const webpBuf = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.alloc(4),
    Buffer.from('WEBP'),
    Buffer.alloc(16),
  ])
  const gifBuf = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(16)])
  const phpFakeBuf = Buffer.from('<?php system($_GET["c"]); ?>')

  assert.equal(detectImageSignature(jpegBuf), 'jpeg')
  assert.equal(detectImageSignature(pngBuf), 'png')
  assert.equal(detectImageSignature(webpBuf), 'webp')
  assert.equal(isWebpBuffer(webpBuf), true)
  assert.equal(detectImageSignature(gifBuf), 'gif')
  assert.equal(detectImageSignature(phpFakeBuf), null)

  // Key validation check (deleteFromParsPack only skips when isValidConfig is false if key not forced; check guard if configured)
  const parspackSrc = readBackendFile('lib/parspackS3.js')
  assert.equal(parspackSrc.includes('NODE_ENV === "production"'), true)
  assert.equal(parspackSrc.includes('detectImageSignature(buffer)'), true)
  assert.equal(parspackSrc.includes('rawKey.includes("..")'), true)
  assert.equal(typeof deleteFromParsPack, 'function')
})

test('findMatchingVariant enforces exact option length and handles single-variant fallback', () => {
  const multiVariantProduct = {
    productType: 'variable',
    variants: [
      { _id: 'v1', price: 1000, stock: 5, options: [{ name: 'رنگ', value: 'سفید' }, { name: 'لنز', value: '3.6' }] },
      { _id: 'v2', price: 1200, stock: 2, options: [{ name: 'رنگ', value: 'مشکی' }] },
    ],
  }
  assert.equal(findMatchingVariant(multiVariantProduct, []), null)
  const exact = findMatchingVariant(multiVariantProduct, [{ name: 'رنگ', value: 'مشکی' }])
  assert.equal(exact._id, 'v2')

  const singleVariantProduct = {
    productType: 'variable',
    variants: [{ _id: 'only', price: 500, stock: 3, options: [{ name: 'مدل', value: 'استاندارد' }] }],
  }
  assert.equal(findMatchingVariant(singleVariantProduct, [])._id, 'only')
})

test('Critical backend security invariants remain enforced in source', () => {
  const notificationSrc = readBackendFile('utils/notificationService.js')
  assert.equal(notificationSrc.includes('f95527'), false, 'Live SMS API key must never be hardcoded')

  const setupSrc = readBackendFile('controllers/adminSetupController.js')
  assert.equal(setupSrc.includes('timingSafeEqual'), true)

  const authMwSrc = readBackendFile('middleware/auth.js')
  assert.equal(authMwSrc.includes("algorithms: ['HS256']"), true)
  assert.equal(authMwSrc.includes('passwordChangedAt'), true)

  const productsRouteSrc = readBackendFile('routes/products.js')
  assert.equal(productsRouteSrc.includes('PERMISSIONS.PRODUCT_DELETE'), true)
  assert.equal(productsRouteSrc.includes('os.tmpdir()'), true)
  assert.equal(productsRouteSrc.includes('allowedMimeTypes.has(file.mimetype) && allowedExtensions.has(ext)'), true)
  assert.equal(productsRouteSrc.includes('isProductAdmin(req)'), true)

  const orderCtrlSrc = readBackendFile('controllers/orderController.js')
  assert.equal(orderCtrlSrc.includes('if (!isMashhadShippingAddress(shippingAddress))'), true)
  assert.equal(orderCtrlSrc.includes('isMashhadPickupEligible'), false)
  assert.equal(orderCtrlSrc.includes('ShippingMethod'), true)
  assert.equal(orderCtrlSrc.includes('const settledOrder = await Order.findOneAndUpdate'), true)

  const kycSrc = readBackendFile('services/sabtAhvalService.js')
  assert.equal(kycSrc.includes("isProduction"), true)
  assert.equal(kycSrc.includes('fail-closed'), true)
})
