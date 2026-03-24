/**
 * ArvanCloud-Optimized Image URL Resolver
 * ============================================================
 * 
 * This utility resolves image URLs from multiple sources:
 * 1. ArvanCloud Object Storage (primary)
 * 2. Local uploads (for backward compatibility)
 * 3. Cloudinary (for legacy data)
 * 4. Fallback placeholder
 * 
 * Environment variables required:
 * - ARVAN_ENDPOINT: e.g., https://s3.ir-thr-at1.arvanstorage.ir
 * - ARVAN_BUCKET_NAME: e.g., ekgkala-media
 * 
 * Usage:
 *   resolveImageUrl(imageSource, fallbackUrl)
 */

export const resolveImageUrl = (
  source: unknown,
  fallback: string = "/placeholder.png"
): string => {
  if (!source) {
    return fallback;
  }

  // Handle string source
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (trimmed !== "") {
      return trimmed;
    }
    return fallback;
  }

  // Handle object with URL property
  if (
    typeof source === "object" &&
    source !== null &&
    "url" in source &&
    typeof (source as any).url === "string"
  ) {
    const url = (source as any).url.trim();
    if (url !== "") {
      return url;
    }
    return fallback;
  }

  // Handle object with path/key property (ArvanCloud key)
  if (
    typeof source === "object" &&
    source !== null &&
    "key" in source &&
    typeof (source as any).key === "string"
  ) {
    const endpoint = process.env.NEXT_PUBLIC_ARVAN_ENDPOINT || "https://s3.ir-thr-at1.arvanstorage.ir";
    const bucketName = process.env.NEXT_PUBLIC_ARVAN_BUCKET_NAME || "";
    const key = (source as any).key.trim();
    
    if (endpoint && bucketName && key) {
      return `${endpoint}/${bucketName}/${key}`;
    }
    return fallback;
  }

  return fallback;
};

/**
 * Generate blur placeholder data URL from image dimensions
 * Creates a lightweight base64 SVG for better UX during loading
 */
export const generateBlurPlaceholder = (
  width: number,
  height: number,
  color: string = "#f3f4f6"
): string => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="${color}"/>
      <rect width="${width}" height="${height}" fill="none" stroke="${color}" stroke-width="1"/>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg.trim()).toString('base64')}`;
};

/**
 * Generate blur placeholder for banner images
 * Default colors based on typical banner backgrounds
 */
export const generateBannerBlurPlaceholder = (
  width: number = 1200,
  height: number = 500
): string => {
  return generateBlurPlaceholder(width, height, "#e5e7eb");
};
