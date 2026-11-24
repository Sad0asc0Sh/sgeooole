const dns = require('dns').promises
const net = require('net')

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'instance-data',
])

const isPrivateOrReservedIpv4 = (ip) => {
  const parts = ip.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true
  }
  const [a, b] = parts
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10.0.0.0/8
  if (a === 127) return true // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0 && parts[2] === 0) return true // 192.0.0.0/24
  if (a === 192 && b === 0 && parts[2] === 2) return true // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking 198.18.0.0/15
  if (a >= 224) return true // multicast / reserved
  return false
}

const isPrivateOrReservedIp = (rawIp) => {
  const ip = String(rawIp || '').trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0]
  const family = net.isIP(ip)
  if (family === 4) {
    return isPrivateOrReservedIpv4(ip)
  }
  if (family === 6) {
    if (ip === '::' || ip === '::1') return true
    if (ip.startsWith('::ffff:')) {
      return isPrivateOrReservedIpv4(ip.slice('::ffff:'.length))
    }
    if (/^f[cd][0-9a-f]{2}:/i.test(ip) || /^f[cd][0-9a-f]{2}$/i.test(ip)) return true // fc00::/7 ULA
    if (/^fe[89ab][0-9a-f]:/i.test(ip)) return true // fe80::/10 link-local
    if (ip.startsWith('ff')) return true // multicast
    return false
  }
  return true
}

const validateOutboundHttpsUrl = (rawUrl, { allowHttpInDev = false } = {}) => {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { valid: false, reason: 'آدرس URL الزامی است' }
  }

  let parsed
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    return { valid: false, reason: 'فرمت آدرس URL نامعتبر است' }
  }

  const allowedProtocols =
    allowHttpInDev && process.env.NODE_ENV !== 'production'
      ? ['https:', 'http:']
      : ['https:']

  if (!allowedProtocols.includes(parsed.protocol)) {
    return { valid: false, reason: 'آدرس سرویس باید با https:// شروع شود' }
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'استفاده از اطلاعات احراز هویت در URL مجاز نیست' }
  }

  const hostname = parsed.hostname.toLowerCase()
  if (!hostname) {
    return { valid: false, reason: 'نام میزبان در URL نامعتبر است' }
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    return { valid: false, reason: 'دسترسی به آدرس‌های داخلی یا محلی مجاز نیست' }
  }

  const bareHost = hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(bareHost) && isPrivateOrReservedIp(bareHost)) {
    return { valid: false, reason: 'دسترسی به آدرس‌های IP خصوصی یا رزروشده مجاز نیست' }
  }

  return { valid: true, url: parsed }
}

const assertSafeOutboundUrl = async (rawUrl, options = {}) => {
  const check = validateOutboundHttpsUrl(rawUrl, options)
  if (!check.valid) {
    const err = new Error(check.reason)
    err.statusCode = 400
    throw err
  }

  const bareHost = check.url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!net.isIP(bareHost)) {
    let records
    try {
      records = await dns.lookup(bareHost, { all: true })
    } catch {
      const err = new Error('امکان رزولوشن دامنه سرویس وجود ندارد')
      err.statusCode = 400
      throw err
    }

    if (!Array.isArray(records) || records.length === 0) {
      const err = new Error('رکورد DNS معتبری برای دامنه یافت نشد')
      err.statusCode = 400
      throw err
    }

    for (const record of records) {
      if (isPrivateOrReservedIp(record.address)) {
        const err = new Error('دامنه به یک آدرس IP داخلی یا غیرمجاز اشاره می‌کند')
        err.statusCode = 400
        throw err
      }
    }
  }

  return check.url.toString().replace(/\/$/, '')
}

module.exports = {
  isPrivateOrReservedIp,
  validateOutboundHttpsUrl,
  assertSafeOutboundUrl,
}
