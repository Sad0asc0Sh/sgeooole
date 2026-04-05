/**
 * Next.js Security Enhanced Configuration
 * Domain: ekgkala.ir
 * Security Hardened - 2025 Standards
 * 
 * USAGE: Replace the contents of next.config.ts with this file
 * or merge the security headers into your existing configuration.
 */

import type { NextConfig } from "next";
const withBundleAnalyzer =
    process.env.ANALYZE === "true" ? require("@next/bundle-analyzer")({ enabled: true }) : (config: NextConfig) => config;

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

const fetchJsonWithTimeout = async (url: string, timeoutMs: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        return await res.json().catch(() => null);
    } finally {
        clearTimeout(timeoutId);
    }
};

const buildProductUrl = (product: any) => {
    const path = Array.isArray(product?.categoryPath)
        ? product.categoryPath.map((c: any) => c.slug).filter(Boolean).join("/")
        : "product";
    return `/${path}/${product.slug || product._id || product.id}`;
};

// =============================================
// SECURITY HEADERS CONFIGURATION
// =============================================
const securityHeaders = [
    {
        key: 'X-DNS-Prefetch-Control',
        value: 'on'
    },
    {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
    },
    {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN' // Changed from DENY to SAMEORIGIN for admin embeds
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
];

// Production-only headers
const productionHeaders = [
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload'
    },
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://ekgkala.ir https://accounts.google.com https://apis.google.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: https: blob: https://res.cloudinary.com",
            "connect-src 'self' https://ekgkala.ir https://*.ekgkala.ir https://*.parspack.net https://accounts.google.com",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-src 'self' https://accounts.google.com",
            "object-src 'none'",
            "upgrade-insecure-requests"
        ].join('; ')
    }
];

// No-cache headers for sensitive routes
const noCacheHeaders = [
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
];

// Long-term cache for static assets
const staticCacheHeaders = [
    {
        key: 'Cache-Control',
        value: 'public, max-age=31536000, immutable'
    }
];

const baseConfig: NextConfig = {
    // SECURITY: Remove X-Powered-By header
    poweredByHeader: false,

    reactCompiler: true,
    reactStrictMode: true,
    compress: true,

    experimental: {
        optimizePackageImports: ["lucide-react", "framer-motion"],
    },

    images: {
        formats: ["image/avif", "image/webp"],
        deviceSizes: [360, 640, 768, 1024, 1280, 1536],
        imageSizes: [64, 96, 128, 256, 384],
        minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
        // SECURITY: SVG disabled to prevent XSS attacks
        dangerouslyAllowSVG: false,
        contentDispositionType: "attachment",
        contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
        remotePatterns: [
            {
                protocol: "https",
                hostname: "res.cloudinary.com",
            },
            {
                protocol: "http",
                hostname: "localhost",
                port: "5000",
            },
            {
                protocol: "http",
                hostname: "127.0.0.1",
                port: "5000",
            },
        ],
    },

    // SECURITY: Enhanced security headers
    async headers() {
        const isProduction = process.env.NODE_ENV === "production";

        return [
            // Apply to all routes
            {
                source: "/:path*",
                headers: [
                    ...securityHeaders,
                    ...(isProduction ? productionHeaders : []),
                ],
            },
            // Sensitive routes - NO CACHE
            {
                source: "/(admin|profile|dashboard|account)/:path*",
                headers: noCacheHeaders,
            },
            // API routes - NO CACHE
            {
                source: "/api/:path*",
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store, max-age=0'
                    }
                ],
            },
            // Static assets - long-term cache
            {
                source: "/_next/static/:path*",
                headers: staticCacheHeaders,
            },
            // Public static files
            {
                source: "/static/:path*",
                headers: staticCacheHeaders,
            },
        ];
    },

    async redirects() {
        try {
            const json = await fetchJsonWithTimeout(`${API_BASE}/products?limit=100`, 8000);
            const items: any[] = Array.isArray(json?.data) ? json.data : [];

            const mapped = items
                .map((p) => {
                    const from = `/product/${p._id || p.id || p.slug}`;
                    const to = buildProductUrl(p);
                    if (!from || !to) return null;
                    return {
                        source: from,
                        destination: to,
                        permanent: true,
                    };
                })
                .filter(Boolean) as any[];

            return mapped;
        } catch (error) {
            if (process.env.NODE_ENV !== "production") {
                console.warn("Failed to build product redirects", error);
            } else {
                console.warn("Failed to build product redirects");
            }
            return [];
        }
    },
};

export default withBundleAnalyzer(baseConfig);
