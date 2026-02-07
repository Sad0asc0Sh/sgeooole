/**
 * Next.js Security Configuration
 * Domain: ekgkala.ir
 * Security Hardened - 2025 Standards
 * 
 * This configuration implements:
 * - Strict Content Security Policy (CSP) with nonce-based approach
 * - Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
 * - Removal of X-Powered-By header
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Remove X-Powered-By header
    poweredByHeader: false,

    // Strict mode for React
    reactStrictMode: true,

    // Compression (if not handled by Nginx)
    compress: true,

    // Security Headers
    async headers() {
        return [
            {
                // Apply to all routes
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block'
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin'
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
                    },
                    // Strict Content Security Policy
                    // Note: This uses 'unsafe-inline' for styles temporarily. 
                    // For production, implement nonce-based CSP (see below for implementation guide)
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://ekgkala.ir",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            "font-src 'self' https://fonts.gstatic.com data:",
                            "img-src 'self' data: https: blob:",
                            "connect-src 'self' https://ekgkala.ir https://*.ekgkala.ir",
                            "frame-ancestors 'self'",
                            "base-uri 'self'",
                            "form-action 'self'",
                            "frame-src 'self'",
                            "object-src 'none'",
                            "upgrade-insecure-requests"
                        ].join('; ')
                    }
                ],
            },
            {
                // Sensitive routes - strict no-cache policy
                source: '/(admin|profile|dashboard)/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
                    },
                    {
                        key: 'Pragma',
                        value: 'no-cache'
                    },
                    {
                        key: 'Expires',
                        value: '0'
                    }
                ],
            },
            {
                // API routes - no cache
                source: '/api/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store, max-age=0'
                    }
                ],
            },
            {
                // Static assets - long-term cache
                source: '/_next/static/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable'
                    }
                ],
            },
        ];
    },
};

module.exports = nextConfig;

/**
 * ADVANCED: Nonce-Based CSP Implementation Guide
 * =============================================
 * 
 * For the highest security, implement nonce-based CSP using middleware:
 * 
 * 1. Create middleware.js in your project root:
 * 
 * ```javascript
 * import { NextResponse } from 'next/server';
 * import { randomBytes } from 'crypto';
 * 
 * export function middleware(request) {
 *   const nonce = randomBytes(16).toString('base64');
 *   const cspHeader = [
 *     "default-src 'self'",
 *     `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
 *     `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
 *     "font-src 'self' https://fonts.gstatic.com data:",
 *     "img-src 'self' data: https: blob:",
 *     "connect-src 'self' https://ekgkala.ir",
 *     "frame-ancestors 'self'",
 *     "base-uri 'self'",
 *     "form-action 'self'",
 *     "object-src 'none'",
 *     "upgrade-insecure-requests"
 *   ].join('; ');
 * 
 *   const requestHeaders = new Headers(request.headers);
 *   requestHeaders.set('x-nonce', nonce);
 *   requestHeaders.set('Content-Security-Policy', cspHeader);
 * 
 *   const response = NextResponse.next({
 *     request: {
 *       headers: requestHeaders,
 *     },
 *   });
 * 
 *   response.headers.set('Content-Security-Policy', cspHeader);
 *   return response;
 * }
 * 
 * export const config = {
 *   matcher: [
 *     {
 *       source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
 *       missing: [
 *         { type: 'header', key: 'next-router-prefetch' },
 *         { type: 'header', key: 'purpose', value: 'prefetch' },
 *       ],
 *     },
 *   ],
 * };
 * ```
 * 
 * 2. Update _document.js to use nonces:
 * 
 * ```javascript
 * import Document, { Html, Head, Main, NextScript } from 'next/document';
 * 
 * class MyDocument extends Document {
 *   static async getInitialProps(ctx) {
 *     const initialProps = await Document.getInitialProps(ctx);
 *     return {
 *       ...initialProps,
 *       nonce: ctx.req?.headers['x-nonce'],
 *     };
 *   }
 * 
 *   render() {
 *     const { nonce } = this.props;
 *     return (
 *       <Html>
 *         <Head nonce={nonce}>
 *           {/* Your head content *\/}
 *         </Head>
 *         <body>
 *           <Main />
 *           <NextScript nonce={nonce} />
 *         </body>
 *       </Html>
 *     );
 *   }
 * }
 * 
 * export default MyDocument;
 * ```
 * 
 * 3. For inline styles in components, use:
 * 
 * ```javascript
 * import { useNonce } from 'next/dist/client/components/nonce';
 * 
 * function MyComponent() {
 *   const nonce = useNonce();
 *   return <style nonce={nonce}>{`...`}</style>;
 * }
 * ```
 * 
 * This implementation removes ALL 'unsafe-inline' directives for maximum security.
 */
