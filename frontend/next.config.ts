import type { NextConfig } from "next";
const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? require("@next/bundle-analyzer")({ enabled: true })
    : (config: NextConfig) => config;

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

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
    ? product.categoryPath
        .map((c: any) => c.slug)
        .filter(Boolean)
        .join("/")
    : "product";
  return `/${path}/${product.slug || product._id || product.id}`;
};

// Parspack Cloud Storage configuration
const PARSPACK_ENDPOINT_HOST =
  (process.env.NEXT_PUBLIC_PARSPACK_ENDPOINT || "https://c258565.parspack.net")
    .replace(/^https?:\/\//, "");
const PARSPACK_BUCKET_NAME =
  process.env.PARSPACK_BUCKET_NAME || "ekgkala-uploads";

// Legacy ArvanCloud (kept for migration period)
const ARVAN_BUCKET_NAME =
  process.env.NEXT_PUBLIC_ARVAN_BUCKET_NAME || "";

const baseConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  reactCompiler: true,
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
    contentSecurityPolicy:
      "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      // Parspack Cloud Storage (PRIMARY)
      {
        protocol: "https",
        hostname: PARSPACK_ENDPOINT_HOST,
        pathname: `/${PARSPACK_BUCKET_NAME}/**`,
      },
      // ArvanCloud Object Storage (legacy)
      {
        protocol: "https",
        hostname: "s3.ir-thr-at1.arvanstorage.ir",
        pathname: `/${ARVAN_BUCKET_NAME || "ekgkala-media"}/**`,
      },
      // Keep Cloudinary for legacy data during migration
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      // Local dev
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
  // SECURITY: Add security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
  async redirects() {
    try {
      const json = await fetchJsonWithTimeout(
        `${API_BASE}/products?limit=100`,
        8000
      );
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
