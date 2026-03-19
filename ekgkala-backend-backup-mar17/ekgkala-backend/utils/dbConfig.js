const parseIntEnv = (key, defaultValue) => {
  const parsed = parseInt(process.env[key], 10)
  return Number.isFinite(parsed) ? parsed : defaultValue
}

const getMongoUri = () => {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI must be set for database connection')
  }

  if (!uri.includes('@')) {
    throw new Error('MONGODB_URI must include credentials (username:password@host)')
  }

  return uri
}

const buildMongoOptions = () => {
  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    minPoolSize: parseIntEnv('MIN_POOL_SIZE', 2),
    maxPoolSize: parseIntEnv('MAX_POOL_SIZE', 10),
    serverSelectionTimeoutMS: parseIntEnv('MONGODB_SERVER_SELECTION_TIMEOUT_MS', 5000),
    socketTimeoutMS: parseIntEnv('MONGODB_SOCKET_TIMEOUT_MS', 45000),
    connectTimeoutMS: parseIntEnv('MONGODB_CONNECT_TIMEOUT_MS', 10000),
  }

  if (process.env.MONGODB_AUTH_SOURCE) {
    options.authSource = process.env.MONGODB_AUTH_SOURCE
  }

  return options
}

module.exports = { getMongoUri, buildMongoOptions, parseIntEnv }
