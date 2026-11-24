const dotenv = require('dotenv')
const path = require('path')

// Load .env file (secrets stay in .env and are loaded directly by server.js rather than persisted in PM2 dump)
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
      CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
    },
    watch: false,
    max_memory_restart: '500M',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
