import type { MetadataRoute } from "next";

type ProductItem = {
  _id: string;
  slug?: string;
  updatedAt?: string;
};

type CategoryItem = {
  _id: string;
  slug?: string;
  updatedAt?: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://example.com").replace(/\/$/, "");

async function fetchProducts(): Promise<ProductItem[]> {
  try {
    const res = await fetch(`${API_BASE}/products?limit=1000&isActive=true`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch (error) {
    console.error("[sitemap] Failed to fetch products", error);
    return [];
  }
}

async function fetchCategories(): Promise<CategoryItem[]> {
  try {
    const res = await fetch(`${API_BASE}/categories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch (error) {
    console.error("[sitemap] Failed to fetch categories", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/categories`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => {
    const slug = category.slug || category._id;
    return {
      url: `${SITE_URL}/products?category=${slug}`,
      lastModified: category.updatedAt ? new Date(category.updatedAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    };
  });

  const productPages: MetadataRoute.Sitemap = products.map((product: any) => {
    // Build product URL with categoryPath if available
    const buildProductUrl = (p: any): string => {
      const path = Array.isArray(p?.categoryPath)
        ? p.categoryPath.map((c: any) => c.slug).filter(Boolean).join("/")
        : "product";
      return `${SITE_URL}/${path}/${p.slug || p._id || p.id}`;
    };

    return {
      url: buildProductUrl(product),
      lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    };
  });

  return [...staticPages, ...categoryPages, ...productPages];
}
