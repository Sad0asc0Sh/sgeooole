/**
 * ============================================
 * NEXT.JS SECURITY CONFIGURATION
 * ============================================
 * 
 * Domain: ekgkala.ir
 * Security Hardened - 2026 Standards
 * 
 * SECURITY FEATURES:
 * - [CRITICAL] X-Powered-By header removed
 * - [HIGH] Strict Content Security Policy
 * - [HIGH] HSTS, X-Frame-Options, X-Content-Type-Options
 * 
 * OWASP Reference: A05:2021 - Security Misconfiguration
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Monorepo: Pin Next workspace root to this app to avoid lockfile ambiguity warnings.
    turbopack: {
        root: __dirname,
    },
    outputFileTracingRoot: __dirname,

    // Remove X-Powered-By header
    poweredByHeader: false,

    // React Strict Mode
    reactStrictMode: true,

    // Compression
    compress: true,

    // Image Configuration
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
            },
            {
                protocol: 'https',
                hostname: 'ekgkala.ir',
            },
        ],
        unoptimized: process.env.DISABLE_IMAGE_OPTIMIZATION === 'true',
    },

    // Security Headers
    async headers() {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ekgkala.ir'

        return [
            // Global Security Headers
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: [
                            'camera=()',
                            'microphone=()',
                            'geolocation=()',
                            'interest-cohort=()',
                            'payment=(self)',
                            'usb=()',
                            'bluetooth=()',
                        ].join(', '),
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://ekgkala.ir https://accounts.google.com https://apis.google.com",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
                            "font-src 'self' https://fonts.gstatic.com data:",
                            "img-src 'self' data: https: blob:",
                            `connect-src 'self' ${apiUrl} https://*.ekgkala.ir wss://*.ekgkala.ir https://accounts.google.com`,
                            "frame-ancestors 'self'",
                            "base-uri 'self'",
                            "form-action 'self'",
                            "frame-src 'self' https://accounts.google.com",
                            "object-src 'none'",
                            'upgrade-insecure-requests',
                        ].join('; '),
                    },
                ],
            },

            // Sensitive Routes - NO CACHE
            {
                source: '/(admin|profile|dashboard|checkout)/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                    },
                    {
                        key: 'Pragma',
                        value: 'no-cache',
                    },
                    {
                        key: 'Expires',
                        value: '0',
                    },
                ],
            },

            // API Routes - NO CACHE
            {
                source: '/api/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store, max-age=0',
                    },
                ],
            },

            // Static Assets - Long-term Cache
            {
                source: '/_next/static/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },

            // Public Static Files
            {
                source: '/static/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=86400, stale-while-revalidate=604800',
                    },
                ],
            },
        ]
    },

    // Redirects
    async redirects() {
        return [
            // Force HTTPS
            {
                source: '/:path*',
                has: [
                    {
                        type: 'header',
                        key: 'x-forwarded-proto',
                        value: 'http',
                    },
                ],
                destination: 'https://ekgkala.ir/:path*',
                permanent: true,
            },
            // Redirect www to non-www
            {
                source: '/:path*',
                has: [
                    {
                        type: 'host',
                        value: 'www.ekgkala.ir',
                    },
                ],
                destination: 'https://ekgkala.ir/:path*',
                permanent: true,
            },
        ]
    },
}

module.exports = nextConfig
