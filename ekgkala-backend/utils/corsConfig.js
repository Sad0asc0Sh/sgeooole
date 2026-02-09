const parseOrigins = (raw) =>
  raw
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

const getAllowedOrigins = () => {
  const rawOrigins =
    process.env.CORS_ALLOWED_ORIGINS ||
    process.env.CLIENT_URL ||
    process.env.FRONTEND_URL ||
    ''

  const origins = parseOrigins(rawOrigins)

  if (origins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must be set to a comma-separated list of allowed origins')
  }

  return origins
}

const buildCorsOptions = (allowedOrigins) => ({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true) // Allow non-browser requests (no Origin header)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('CORS_ORIGIN_DENIED'))
  },
  credentials: true,
})

module.exports = { getAllowedOrigins, buildCorsOptions }
