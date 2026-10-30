/**
 * Product Types - DEP0169 Safe
 * 
 * This file contains only type definitions for products.
 * It is safe to import in both Server and Client components
 * as it contains no runtime dependencies (especially no axios).
 * 
 * IMPORTANT: Do NOT import any modules that use axios or legacy Node.js APIs
 * in this file to keep it SSR-safe.
 */

// Color Interface
export interface ProductColor {
    id: number;
    hex: string;
    name: string;
}

// Specification Interface
export interface ProductSpec {
    label: string;
    value: string;
}

// Category Path Interface
export interface CategoryPathItem {
    id: string;
    name: string;
    slug: string;
}

// Category Property Interface (for dynamic filters)
export interface CategoryProperty {
    name: string;
    type: 'text' | 'number' | 'select';
    options?: string[];
    isFilterable?: boolean;
    unit?: string;
    order?: number;
}

// Category Details Interface
export interface CategoryDetails {
    _id: string;
    name: string;
    slug: string;
    description?: string;
    parent?: {
        _id: string;
        name: string;
        slug: string;
    };
    properties: CategoryProperty[];
}

// Variant / Attribute types (variable products: backend productType === 'variable')
export interface ProductVariantOption {
    name: string;
    value: string;
}

export interface ProductVariant {
    id: string;
    sku?: string;
    price: number; // قیمت نهایی (بعد از تخفیف)
    oldPrice?: number; // قیمت خط‌خورده (مبنای قبل از تخفیف)
    stock: number;
    options: ProductVariantOption[];
    images?: string[];
    // مستثنی از تخفیف: تیک تخفیف در ادمین خاموش => هیچ تخفیفی روی این وariant اعمال نمی‌شود
    excludeFromPromotion?: boolean;
}

export interface ProductAttribute {
    name: string;
    values: string[];
    displayType?: "button" | "color";
    swatches?: Record<string, string>; // { "قرمز": "#dc2626" }
}

// Frontend Product Interface (matching our UI expectations)
export interface Product {
    id: string;
    name: string;
    title: string; // Display name (same as name for now)
    slug?: string;
    sku?: string; // Product SKU
    productCode?: string; // SEO-friendly product code (KY-XXXXXXX)
    enTitle?: string; // English title (optional)
    price: number;
    oldPrice?: number; // Original price before discount
    discount: number;
    image: string;
    images: string[]; // Gallery images
    category: string;
    categoryPath?: CategoryPathItem[]; // Structured category hierarchy
    brand?: string;
    brandSlug?: string; // Brand slug for navigation links
    description?: string;
    rating: number;
    reviewCount: number;
    countInStock: number;
    colors?: ProductColor[]; // Optional color variants
    specs?: ProductSpec[]; // Technical specifications
    guarantee?: string; // Product guarantee text (e.g. "36 ماه گارانتی سایلکس")
    campaignLabel?: string; // Active campaign name (time-limited discount)
    campaignTheme?: string; // Badge color theme
    compareAtPrice?: number; // Original price for comparison

    // Time-based promotion fields
    isFlashDeal?: boolean;
    flashDealEndTime?: string; // ISO date string
    isSpecialOffer?: boolean;
    specialOfferEndTime?: string; // ISO date string

    // Variable-product fields (only set when backend productType === 'variable')
    productType?: "simple" | "variable";
    attributes?: ProductAttribute[];
    variants?: ProductVariant[];
}

// Extended product with optional isActive flag (for admin/internal use)
export interface ProductWithStatus extends Product {
    isActive?: boolean;
}
