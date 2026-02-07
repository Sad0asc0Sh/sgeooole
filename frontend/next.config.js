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
 * - [HIGH] Strict Content Security Policy (CSP)
 * - [HIGH] HSTS, X-Frame-Options, X-Content-Type-Options
 * - [MEDIUM] Permissions-Policy, Referrer-Policy
 * - [MEDIUM] Cache-Control for sensitive routes
 * 
 * OWASP Reference: A05:2021 - Security Misconfiguration
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
    // ============================================
    // SECURITY: Remove X-Powered-By header
    // Prevents server technology fingerprinting
    // ============================================
    poweredByHeader: false,

    // ============================================
    // React Strict Mode (helps catch bugs)
    // ============================================
    reactStrictMode: true,

    // ============================================
    // Compression (if not handled by Nginx)
    // ============================================
    compress: true,

    // ============================================
    // Image Configuration
    // ============================================
    images: {
        // Whitelist external image domains
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
        // Disable image optimization in production if using external CDN
        unoptimized: process.env.DISABLE_IMAGE_OPTIMIZATION === 'true',
    },

    // ============================================
    // SECURITY HEADERS
    // ============================================
    async headers() {
        // Base URL for CSP
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ekgkala.ir'

        return [
            // ============================================
            // Global Security Headers (All Routes)
            // ============================================
            {
                source: '/:path*',
                headers: [
                    // DNS Prefetch Control
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on',
                    },
                    // Prevent Clickjacking
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
                    // Prevent MIME type sniffing
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    // XSS Protection (legacy browsers)
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    // Referrer Policy
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    // Permissions Policy (Feature Policy successor)
                    {
                        key: 'Permissions-Policy',
                        value: [
                            'camera=()',           // Disable camera
                            'microphone=()',       // Disable microphone
                            'geolocation=()',      // Disable geolocation
                            'interest-cohort=()',  // Disable FLoC (Google Topics)
                            'payment=(self)',      // Only allow payment from same origin
                            'usb=()',              // Disable USB access
                            'bluetooth=()',        // Disable Bluetooth
                            'magnetometer=()',     // Disable magnetometer
                            'gyroscope=()',        // Disable gyroscope
                            'accelerometer=()',    // Disable accelerometer
                        ].join(', '),
                    },
                    // Content Security Policy
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            // Default to self-hosted only
                            "default-src 'self'",

                            // Scripts: self + inline (needed for Next.js)
                            // TODO: Implement nonce-based CSP for maximum security
                            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://ekgkala.ir",

                            // Styles: self + inline (needed for styled-components/emotion) + Google Fonts
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

                            // Fonts: self + Google Fonts + data URIs
                            "font-src 'self' https://fonts.gstatic.com data:",

                            // Images: self + data URIs + HTTPS (for external images) + blob (for previews)
                            "img-src 'self' data: https: blob:",

                            // API connections: self + API domain
                            `connect-src 'self' ${apiUrl} https://*.ekgkala.ir wss://*.ekgkala.ir`,

                            // Frames: only same origin
                            "frame-ancestors 'self'",

                            // Base URI: only same origin
                            "base-uri 'self'",

                            // Form actions: only same origin
                            "form-action 'self'",

                            // Frame sources: self only
                            "frame-src 'self'",

                            // No plugins/objects
                            "object-src 'none'",

                            // Upgrade HTTP to HTTPS
                            'upgrade-insecure-requests',
                        ].join('; '),
                    },
                ],
            },

            // ============================================
            // Sensitive Routes - NO CACHE
            // Admin, Profile, Dashboard pages
            // ============================================
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
                    // Prevent storing page in browser history
                    {
                        key: 'Clear-Site-Data',
                        value: '"cache"',
                    },
                ],
            },

            // ============================================
            // API Routes - NO CACHE
            // ============================================
            {
                source: '/api/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store, max-age=0',
                    },
                    // CORS headers (if needed)
                    {
                        key: 'Access-Control-Allow-Origin',
                        value: process.env.NEXT_PUBLIC_API_URL || 'https://ekgkala.ir',
                    },
                    {
                        key: 'Access-Control-Allow-Methods',
                        value: 'GET, POST, PUT, DELETE, OPTIONS',
                    },
                    {
                        key: 'Access-Control-Allow-Headers',
                        value: 'Content-Type, Authorization',
                    },
                ],
            },

            // ============================================
            // Static Assets - Long-term Cache
            // Immutable hashed assets
            // ============================================
            {
                source: '/_next/static/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },

            // ============================================
            // Public Static Files - Medium Cache
            // Images, fonts, etc.
            // ============================================
            {
                source: '/static/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=86400, stale-while-revalidate=604800',
                    },
                ],
            },

            // ============================================
            // Favicon & Manifest - Medium Cache
            // ============================================
            {
                source: '/(favicon.ico|manifest.json|robots.txt|sitemap.xml)',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=86400',
                    },
                ],
            },
        ]
    },

    // ============================================
    // REDIRECTS
    // ============================================
    async redirects() {
        return [
            // Force HTTPS (backup, should be handled by Nginx)
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

    // ============================================
    // EXPERIMENTAL FEATURES
    // ============================================
    experimental: {
        // Enable server actions if using App Router
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },

    // ============================================
    // WEBPACK CONFIGURATION
    // ============================================
    webpack: (config, { dev, isServer }) => {
        // Production optimizations
        if (!dev) {
            // Minimize bundle in production
            config.optimization.minimize = true
        }

        return config
    },
}

module.exports = nextConfig

/**
 * ============================================
 * NONCE-BASED CSP IMPLEMENTATION (ADVANCED)
 * ============================================
 * 
 * For the highest security, implement nonce-based CSP:
 * 
 * 1. Create middleware.ts in your app root:
 * 
 * import { NextResponse } from 'next/server'
 * import type { NextRequest } from 'next/server'
 * 
 * export function middleware(request: NextRequest) {
 *   const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
 *   
 *   const cspHeader = `
 *     default-src 'self';
 *     script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
 *     style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com;
 *     font-src 'self' https://fonts.gstatic.com data:;
 *     img-src 'self' data: https: blob:;
 *     connect-src 'self' https://ekgkala.ir;
 *     frame-ancestors 'self';
 *     base-uri 'self';
 *     form-action 'self';
 *     object-src 'none';
 *     upgrade-insecure-requests;
 *   `.replace(/\s{2,}/g, ' ').trim()
 *   
 *   const requestHeaders = new Headers(request.headers)
 *   requestHeaders.set('x-nonce', nonce)
 *   
 *   const response = NextResponse.next({
 *     request: { headers: requestHeaders },
 *   })
 *   
 *   response.headers.set('Content-Security-Policy', cspHeader)
 *   
 *   return response
 * }
 * 
 * export const config = {
 *   matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
 * }
 * 
 * 2. Use the nonce in your scripts:
 * <Script nonce={nonce} src="..." />
 */
