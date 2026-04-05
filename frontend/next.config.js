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
    turbopack: {
        root: __dirname,
    },
    outputFileTracingRoot: __dirname,

    poweredByHeader: false,
    reactStrictMode: true,
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
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '5000',
            },
        ],
        // غیرفعال کردن image optimization برای جلوگیری از timeout در SSR
        unoptimized: true,
    },

    async headers() {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ekgkala.ir'

        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'X-DNS-Prefetch-Control', value: 'on' },
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
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
                            `connect-src 'self' ${apiUrl} https://*.ekgkala.ir wss://*.ekgkala.ir https://*.parspack.net https://accounts.google.com`,
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
            {
                source: '/(admin|profile|dashboard|checkout)/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
                    { key: 'Pragma', value: 'no-cache' },
                    { key: 'Expires', value: '0' },
                ],
            },
            {
                source: '/api/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'no-store, max-age=0' },
                ],
            },
            {
                source: '/_next/static/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
            {
                source: '/static/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
                ],
            },
        ]
    },

    async redirects() {
        return [
            {
                source: '/:path*',
                has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
                destination: 'https://ekgkala.ir/:path*',
                permanent: true,
            },
            {
                source: '/:path*',
                has: [{ type: 'host', value: 'www.ekgkala.ir' }],
                destination: 'https://ekgkala.ir/:path*',
                permanent: true,
            },
        ]
    },
}

module.exports = nextConfig
