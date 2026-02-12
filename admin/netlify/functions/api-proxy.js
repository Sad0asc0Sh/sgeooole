const axios = require('axios')

const buildQueryString = (query) => {
  if (!query || typeof query !== 'object') return ''

  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    params.append(key, String(value))
  })

  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

const buildCorsHeaders = (requestOrigin) => {
  const hasOrigin = typeof requestOrigin === 'string' && requestOrigin.trim().length > 0
  const allowOrigin = hasOrigin ? requestOrigin : '*'

  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, Pragma, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }

  if (hasOrigin) {
    headers['Access-Control-Allow-Credentials'] = 'true'
    headers.Vary = 'Origin'
  }

  return headers
}

exports.handler = async (event) => {
  const incomingHeaders = event.headers || {}
  const requestOrigin = incomingHeaders.origin || incomingHeaders.Origin || ''
  const corsHeaders = buildCorsHeaders(requestOrigin)

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    }
  }

  const apiBaseUrl = process.env.VITE_API_BASE_URL
  if (!apiBaseUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'VITE_API_BASE_URL is not configured',
      }),
    }
  }

  const proxyPath = (event.path || '')
    .replace(/^\/\.netlify\/functions\/api-proxy/, '')
    .replace(/^\/api-proxy/, '') || '/'
  const query = event.rawQuery
    ? `?${event.rawQuery}`
    : buildQueryString(event.queryStringParameters)
  const targetUrl = `${apiBaseUrl}${proxyPath}${query}`

  const contentType = incomingHeaders['content-type'] || incomingHeaders['Content-Type'] || 'application/json'

  const forwardedHeaders = {
    'content-type': contentType,
  }

  if (incomingHeaders.authorization || incomingHeaders.Authorization) {
    forwardedHeaders.authorization = incomingHeaders.authorization || incomingHeaders.Authorization
  }

  if (incomingHeaders.cookie) {
    forwardedHeaders.cookie = incomingHeaders.cookie
  }

  let requestData
  if (event.body != null) {
    const isBase64 = Boolean(event.isBase64Encoded)
    if (isBase64) {
      requestData = Buffer.from(event.body, 'base64')
    } else if (contentType.toLowerCase().includes('application/json')) {
      try {
        requestData = JSON.parse(event.body)
      } catch (_) {
        requestData = event.body
      }
    } else {
      requestData = event.body
    }
  }

  const timeout = Number(process.env.API_PROXY_TIMEOUT_MS || 600000)

  try {
    const response = await axios({
      method: event.httpMethod,
      url: targetUrl,
      data: requestData,
      headers: forwardedHeaders,
      timeout,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    })

    const responseBody = typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data)

    return {
      statusCode: response.status,
      body: responseBody,
      headers: {
        ...corsHeaders,
        'content-type': response.headers?.['content-type'] || 'application/json',
      },
    }
  } catch (error) {
    return {
      statusCode: error.response?.status || 504,
      body: JSON.stringify({
        message: 'Error proxying request to API server',
        details: error.message,
      }),
      headers: corsHeaders,
    }
  }
}
