/**
 * ============================================
 * PM2 Ecosystem Configuration
 * Production Process Manager for EkgKala
 * ============================================
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js
 *   pm2 stop all
 *   pm2 delete all
 *   
 * Monitoring:
 *   pm2 status
 *   pm2 logs
 *   pm2 monit
 * 
 * Auto-start on boot:
 *   pm2 startup
 *   pm2 save
 */

module.exports = {
    apps: [
        // ============================================
        // Backend API (Node.js/Express)
        // ============================================
        {
            name: 'ekgkala-backend',
            script: './ekgkala-backend/server.js',
            cwd: __dirname,

            // Cluster mode for better performance
            instances: 'max', // Use all CPU cores, or set to specific number like 2
            exec_mode: 'cluster',

            // Memory management
            max_memory_restart: '500M', // Restart if memory exceeds 500MB (memory leak protection)

            // Auto-restart on crash
            autorestart: true,
            watch: false, // Disable in production
            max_restarts: 10,
            restart_delay: 4000, // Wait 4 seconds before restart

            // Environment variables
            env: {
                NODE_ENV: 'development',
                PORT: 5000,
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 5000,
                LOG_LEVEL: 'warn', // Only log warnings and errors in production
            },

            // Logging
            error_file: './logs/backend-error.log',
            out_file: './logs/backend-out.log',
            log_file: './logs/backend-combined.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,

            // Graceful shutdown
            kill_timeout: 5000, // 5 seconds to gracefully shutdown
            wait_ready: true,
            listen_timeout: 10000,

            // Health check
            min_uptime: '10s', // Consider app started after 10s uptime

            // Source map support for better error traces
            source_map_support: true,
        },

        // ============================================
        // Frontend (Next.js)
        // ============================================
        {
            name: 'ekgkala-frontend',
            script: 'npm',
            args: 'start',
            cwd: './frontend',

            // Single instance for Next.js (it handles its own clustering)
            instances: 1,
            exec_mode: 'fork',

            // Memory management
            max_memory_restart: '500M',

            // Auto-restart
            autorestart: true,
            watch: false,
            max_restarts: 10,
            restart_delay: 4000,

            // Environment variables
            env: {
                NODE_ENV: 'development',
                PORT: 3000,
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000,
            },

            // Logging
            error_file: './logs/frontend-error.log',
            out_file: './logs/frontend-out.log',
            log_file: './logs/frontend-combined.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,

            // Graceful shutdown
            kill_timeout: 5000,
        },

        // ============================================
        // Admin Panel (Optional - if separate build)
        // ============================================
        // Uncomment if you have a separate admin panel server
        /*
        {
          name: 'ekgkala-admin',
          script: 'npm',
          args: 'start',
          cwd: './admin',
          
          instances: 1,
          exec_mode: 'fork',
          
          max_memory_restart: '300M',
          autorestart: true,
          watch: false,
          
          env_production: {
            NODE_ENV: 'production',
            PORT: 3001,
          },
          
          error_file: './logs/admin-error.log',
          out_file: './logs/admin-out.log',
          log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        },
        */
    ],

    // ============================================
    // Deploy Configuration (Optional)
    // For automated deployments with `pm2 deploy`
    // ============================================
    deploy: {
        production: {
            user: 'deploy',
            host: 'your-server-ip',
            ref: 'origin/main',
            repo: 'git@github.com:your-username/ekgkala.git',
            path: '/var/www/ekgkala',
            'pre-deploy-local': '',
            'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
            'pre-setup': '',
            env: {
                NODE_ENV: 'production',
            },
        },
    },
}
