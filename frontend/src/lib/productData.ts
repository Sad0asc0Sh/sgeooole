import { cache } from "react";
import type { Product, ProductColor } from "@/services/productService";
import { buildProductUrl } from "./paths";
import { resolvePricing } from "@/lib/pricing";

// Reduced from 3600 (1 hour) to 30 seconds for real-time discount updates from admin panel
export const PRODUCT_REVALIDATE = 30;

type BackendImage = string | { url?: string };

type BackendCategory = {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
  parent?: BackendCategory;
};

type BackendBrand = { name?: string; slug?: string } | string | null;

type BackendProduct = {
  _id?: string;
  id?: string;
  name: string;
  title?: string;
  slug?: string;
  sku?: string;
  enTitle?: string;
  price: number;
  image?: BackendImage;
  images?: BackendImage[];
  category?: BackendCategory | string;
  brand?: BackendBrand;
  description?: string;
  rating?: number;
  numReviews?: number;
  reviewCount?: number;
  stock?: number;
  countInStock?: number;
  discount?: number;
  colors?: ProductColor[];
  specs?: Product["specs"];
  campaignLabel?: string;
  campaignTheme?: string;
  compareAtPrice?: number;
  isFlashDeal?: boolean;
  flashDealEndTime?: string;
  isSpecialOffer?: boolean;
  specialOfferEndTime?: string;
  isActive?: boolean;
  categoryPath?: { _id?: string; id?: string; slug?: string; name?: string }[];
};

const getAssetBase = (apiUrl: string) => apiUrl.replace(/\/api\/?$/, "");

const normalizeImage = (img: BackendImage, assetBase: string): string | null => {
  if (!img) return null;
  if (typeof img === "string") {
    const url = img.trim();
    if (!url) return null;
    return url.startsWith("/") ? `${assetBase}${url}` : url;
  }

  if (typeof img === "object" && typeof img.url === "string") {
    const url = img.url.trim();
    if (!url) return null;
    return url.startsWith("/") ? `${assetBase}${url}` : url;
  }

  return null;
};

export const mapBackendProduct = (backend: BackendProduct, apiUrl: string): Product & { isActive?: boolean } => {
  const assetBase = getAssetBase(apiUrl);

  const pricing = resolvePricing({
    price: backend.price ?? 0,
    discount: backend.discount,
    compareAtPrice: backend.compareAtPrice,
    isFlashDeal: backend.isFlashDeal,
    flashDealEndTime: backend.flashDealEndTime,
    isSpecialOffer: backend.isSpecialOffer,
    specialOfferEndTime: backend.specialOfferEndTime,
    campaignLabel: backend.campaignLabel,
  });

  let images: string[] = [];
  if (backend.images && backend.images.length > 0) {
    images = backend.images
      .map((img) => normalizeImage(img, assetBase))
      .filter((value): value is string => Boolean(value));
  }

  if (images.length === 0 && backend.image) {
    const normalized = normalizeImage(backend.image, assetBase);
    if (normalized) {
      images = [normalized];
    }
  }

  if (images.length === 0) {
    images = ["/placeholder.svg"];
  }

  const countInStock = backend.stock ?? backend.countInStock ?? 0;

  const category =
    typeof backend.category === "object" && backend.category !== null
      ? (() => {
        const cat: BackendCategory = backend.category as BackendCategory;
        if (cat.parent?.name) {
          return `${cat.parent.name} > ${cat.name}`;
        }
        return cat.name || "نامشخص";
      })()
      : backend.category || "نامشخص";

  const categoryPath: Product["categoryPath"] = (() => {
    if (Array.isArray(backend.categoryPath) && backend.categoryPath.length > 0) {
      return backend.categoryPath
        .map((c) => ({
          id: c._id || c.id || "",
          name: c.name || "",
          slug: c.slug || c._id || c.id || "",
        }))
        .filter((c) => c.id);
    }

    const path: NonNullable<Product["categoryPath"]> = [];
    if (typeof backend.category === "object" && backend.category !== null) {
      const cat: BackendCategory = backend.category as BackendCategory;
      if (cat.parent?.name) {
        path.push({
          id: cat.parent._id || cat.parent.id || "",
          name: cat.parent.name || "",
          slug: cat.parent.slug || cat.parent._id || cat.parent.id || "",
        });
      }
      if (cat._id || cat.id || cat.name) {
        path.push({
          id: cat._id || cat.id || "",
          name: cat.name || "",
          slug: cat.slug || cat._id || cat.id || "",
        });
      }
    }
    return path;
  })();

  const brand =
    typeof backend.brand === "object" && backend.brand !== null
      ? (backend.brand as any).name
      : backend.brand || undefined;

  const brandSlug =
    typeof backend.brand === "object" && backend.brand !== null
      ? (backend.brand as any).slug
      : undefined;

  return {
    id: backend._id || backend.id || "",
    name: backend.name,
    title: backend.title || backend.name,
    slug: backend.slug,
    sku: backend.sku,
    enTitle: backend.enTitle,
    price: pricing.finalPrice,
    oldPrice: pricing.oldPrice,
    compareAtPrice: pricing.basePrice,
    discount: pricing.discount,
    image: images[0],
    images,
    category,
    categoryPath,
    brand,
    brandSlug,
    description: backend.description,
    rating: backend.rating ?? 0,
    reviewCount: backend.numReviews ?? backend.reviewCount ?? 0,
    countInStock: Number(countInStock) || 0,
    colors: backend.colors,
    specs: backend.specs,
    campaignLabel: backend.campaignLabel,
    campaignTheme: backend.campaignTheme,
    isFlashDeal: pricing.flashActive,
    flashDealEndTime: pricing.flashActive ? backend.flashDealEndTime : undefined,
    isSpecialOffer: pricing.specialActive,
    specialOfferEndTime: pricing.specialActive ? backend.specialOfferEndTime : undefined,
    isActive: backend.isActive,
  };
};

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

export const fetchProductById = cache(async (id: string): Promise<(Product & { isActive?: boolean }) | null> => {
  const response = await fetch(`${apiBaseUrl}/products/${id}`, {
    next: { revalidate: 0 },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch product ${id} (${response.status})`);
  }

  const payload = await response.json();
  const data = (payload as any)?.data ?? payload;
  if (!data) return null;

  return mapBackendProduct(data as BackendProduct, apiBaseUrl);
});

export const fetchProductBySlug = cache(async (slug: string): Promise<(Product & { isActive?: boolean }) | null> => {
  try {
    // Try a slug endpoint first
    const resSlug = await fetch(`${apiBaseUrl}/products/slug/${slug}`, {
      next: { revalidate: 0 },
      cache: 'no-store',
    });
    if (resSlug.ok) {
      const payload = await resSlug.json();
      const data = (payload as any)?.data ?? payload;
      if (data) return mapBackendProduct(data as BackendProduct, apiBaseUrl);
    }
  } catch (e) {
    // fall back
  }

  // Fallback: try list query
  try {
    const res = await fetch(`${apiBaseUrl}/products?slug=${slug}`, {
      next: { revalidate: 0 },
      cache: 'no-store',
    });
    if (res.ok) {
      const payload = await res.json();
      const item = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
      if (item) return mapBackendProduct(item as BackendProduct, apiBaseUrl);
    }
  } catch (e) {
    // ignore
  }

  // Final fallback: maybe slug is actually ID
  return fetchProductById(slug);
});

export const fetchProductsForStatic = async (limit: number = 100): Promise<(Product & { isActive?: boolean })[]> => {
  try {
    const response = await fetch(`${apiBaseUrl}/products?limit=${limit}`, {
      next: { revalidate: 0 },
      cache: 'no-store',
    });
    if (!response.ok) return [];
    const payload = await response.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    return items.map((p: BackendProduct) => mapBackendProduct(p, apiBaseUrl));
  } catch (error) {
    console.error("[product static] failed to fetch", error);
    return [];
  }
};

export { buildProductUrl };
