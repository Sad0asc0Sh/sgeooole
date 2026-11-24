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
const isProd = process.env.NODE_ENV === 'production';

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
        // Direct ParsPack S3 delivery: no /_next/image proxy, no server disk cache.
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'c258565.parspack.net',
                pathname: '/**', // host-wide: do not bucket-lock (bucket name is env-driven)
            },
            {
                protocol: 'https',
                hostname: 's3.ir-thr-at1.arvanstorage.ir',
            },
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
            },
            {
                protocol: 'https',
                hostname: 'ekgkala.ir',
            },
            {
                protocol: 'https',
                hostname: 'www.ekgkala.ir',
            },
            ...(isProd
                ? []
                : [
                    {
                        protocol: 'http',
                        hostname: 'localhost',
                        port: '5000',
                    },
                    {
                        protocol: 'http',
                        hostname: '127.0.0.1',
                        port: '5000',
                    },
                ]),
        ],
        // Direct S3 delivery (unoptimized) — variants are pre-built on ParsPack
        // (This .js file is the only config Next loads; a .ts sibling is ignored.)
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [360, 640, 768, 1024, 1280, 1536, 1920],
        imageSizes: [64, 96, 128, 256, 384],
        qualities: [60, 75, 80, 90],
        minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
        // SECURITY: SVG disabled to prevent XSS attacks
        dangerouslyAllowSVG: false,
        contentDispositionType: 'inline', // inline (not attachment) so Google Images can index optimized images
        contentSecurityPolicy:
            "default-src 'self'; script-src 'none'; sandbox;",
    },

    async headers() {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ekgkala.ir/api'

        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'X-DNS-Prefetch-Control', value: 'on' },
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    ...(isProd
                        ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
                        : []),
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
                            `script-src 'self' ${isProd ? '' : "'unsafe-eval' "}'unsafe-inline' https://ekgkala.ir https://accounts.google.com https://apis.google.com`.replace(/\s+/g, ' '),
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
                            "font-src 'self' https://fonts.gstatic.com data:",
                            "img-src 'self' data: https: blob:",
                            `connect-src 'self' ${apiUrl} https://*.ekgkala.ir wss://*.ekgkala.ir https://*.parspack.net https://accounts.google.com`,
                            "frame-ancestors 'self'",
                            "base-uri 'self'",
                            "form-action 'self'",
                            "frame-src 'self' https://accounts.google.com",
                            "object-src 'none'",
                            ...(isProd ? ['upgrade-insecure-requests'] : []),
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
                source: '/static/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
                ],
            },
        ]
    },

    async redirects() {
        // Canonical host is the apex (https://ekgkala.ir, no www) — same host
        // nginx 301s to. These are the defense-in-depth layer for traffic that
        // reaches Next.js directly (dev, or a proxy misconfiguration): any
        // http request and any www-host request must land on the apex over
        // https in ONE hop (never http→www→apex, which would chain redirects).
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
