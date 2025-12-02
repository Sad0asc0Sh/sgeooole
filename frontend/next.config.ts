import type { NextConfig } from "next";
const withBundleAnalyzer =
  process.env.ANALYZE === "true" ? require("@next/bundle-analyzer")({ enabled: true }) : (config: NextConfig) => config;

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

const buildProductUrl = (product: any) => {
  const path = Array.isArray(product?.categoryPath)
    ? product.categoryPath.map((c: any) => c.slug).filter(Boolean).join("/")
    : "product";
  return `/${path}/${product.slug || product._id || product.id}`;
};

const baseConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 640, 768, 1024, 1280, 1536],
    imageSizes: [64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
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
  async redirects() {
    try {
      const res = await fetch(`${API_BASE}/products?limit=100`);
      const json = await res.json();
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
      console.warn("Failed to build product redirects", error);
      return [];
    }
  },
};

export default withBundleAnalyzer(baseConfig);
