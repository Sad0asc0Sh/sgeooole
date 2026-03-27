const dotenv = require('dotenv')
const path = require('path')

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '.env') })

module.exports = {
  apps: [{
    name: 'ekgkala-backend',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: process.env.NODE_ENV || 'production',
      PORT: process.env.PORT || 5000,
      JWT_SECRET: process.env.JWT_SECRET,
      MONGODB_URI: process.env.MONGODB_URI,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      PARSPACK_ENDPOINT: process.env.PARSPACK_ENDPOINT,
      PARSPACK_ACCESS_KEY: process.env.PARSPACK_ACCESS_KEY,
      PARSPACK_SECRET_KEY: process.env.PARSPACK_SECRET_KEY,
    },
    watch: false,
    max_memory_restart: '500M',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
