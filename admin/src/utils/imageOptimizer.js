/**
 * Client-side Image Optimization Pipeline
 * ========================================
 * Converts images to WebP (with JPEG fallback) before upload,
 * enforcing max dimensions and quality to reduce upload payload
 * and guarantee optimized format reaches S3.
 *
 * Usage:
 *   import { optimizeImageFile, createBlobPreview } from './imageOptimizer';
 *
 *   const preview = createBlobPreview(file);        // instant local preview
 *   const optimized = await optimizeImageFile(file); // WebP/JPEG compressed
 */

const DEFAULT_MAX_WIDTH = 1200;
const DEFAULT_MAX_HEIGHT = 1200;
const TARGET_QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55];
const TARGET_MAX_BYTES = 140 * 1024; // 140 KB target (gallery tier)
const CARD_TARGET_BYTES = 28 * 1024; // 28 KB target (card tier)
const CARD_QUALITY_STEPS = [0.78, 0.72, 0.66, 0.58];

/**
 * Create an instant blob URL for local preview (zero network latency).
 * IMPORTANT: Caller must revoke via URL.revokeObjectURL when done.
 */
export function createBlobPreview(file) {
  if (!file) return null;
  return URL.createObjectURL(file);
}

/**
 * Safely create an ImageBitmap from a File.
 * Falls back to HTMLImageElement if createImageBitmap is unavailable.
 */
async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        // fall through to HTMLImageElement
      }
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    if (!canvas?.toBlob) return resolve(null);
    canvas.toBlob(resolve, type, quality);
  });
}

function fitDimensions(srcW, srcH, maxW, maxH) {
  if (srcW <= maxW && srcH <= maxH) return { width: srcW, height: srcH };
  const ratio = Math.min(maxW / srcW, maxH / srcH);
  return {
    width: Math.max(1, Math.round(srcW * ratio)),
    height: Math.max(1, Math.round(srcH * ratio)),
  };
}

/**
 * Optimize an image file client-side before upload.
 *
 * Pipeline:
 * 1. Decode the image
 * 2. Downscale to maxWidth x maxHeight
 * 3. Try WebP at descending quality steps
 * 4. Try JPEG if WebP is not smaller
 * 5. Return the smallest result (or original if optimization did not help)
 */
/**
 * Shared encode helper: render `source` at fitDimensions(maxWidth × maxHeight)
 * and try WebP then JPEG across the given quality steps.
 * Returns the smallest blob found, and whether it meets targetBytes.
 */
async function encodeBest(source, { maxWidth, maxHeight, targetBytes, qualitySteps }) {
  const srcW = source.width || 0;
  const srcH = source.height || 0;
  if (!srcW || !srcH) return { blob: null, type: null };

  const { width, height } = fitDimensions(srcW, srcH, maxWidth, maxHeight);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { blob: null, type: null };

  let bestBlob = null;
  let bestType = null;

  const tryFormat = async (type, needsFill) => {
    for (const quality of qualitySteps) {
      ctx.clearRect(0, 0, width, height);
      if (needsFill) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(source, 0, 0, width, height);

      const blob = await canvasToBlob(canvas, type, quality);
      if (!blob) continue;

      const isBetter = !bestBlob || blob.size < bestBlob.size;
      if (isBetter) {
        bestBlob = blob;
        bestType = type;
      }

      if (blob.size <= targetBytes) return true;
    }
    return false;
  };

  await tryFormat("image/webp", false);
  await tryFormat("image/jpeg", true);

  return { blob: bestBlob, type: bestType };
}

export async function optimizeImageFile(file, opts = {}) {
  if (!file) return file;
  if (!file.type?.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;

  const maxWidth = opts.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxHeight = opts.maxHeight ?? DEFAULT_MAX_HEIGHT;
  const targetBytes = opts.targetBytes ?? TARGET_MAX_BYTES;

  let source;
  try {
    source = await decodeImage(file);
  } catch {
    return file;
  }

  const srcW = source.width || 0;
  const srcH = source.height || 0;
  if (!srcW || !srcH) return file;

  // Only skip conversion when the file is ALREADY a WebP that fits both the
  // dimension and size budget — small JPEG/PNG uploads must still become WebP.
  const alreadyOptimized =
    file.type === "image/webp" &&
    srcW <= maxWidth &&
    srcH <= maxHeight &&
    file.size <= targetBytes;
  if (alreadyOptimized) return file;

  const { blob: bestBlob, type: bestType } = await encodeBest(source, {
    maxWidth,
    maxHeight,
    targetBytes,
    qualitySteps: TARGET_QUALITY_STEPS,
  });

  if (source.close) {
    try { source.close(); } catch {}
  }

  if (!bestBlob || !bestType) return file;
  if (bestBlob.size >= file.size) return file;

  const baseName = (file.name || "image").replace(/\.[^/.]+$/, "");
  const ext = bestType === "image/webp" ? "webp" : "jpg";

  return new File([bestBlob], `${baseName}.${ext}`, {
    type: bestType,
    lastModified: Date.now(),
  });
}

/**
 * Build both product-image tiers in the browser:
 * - mainFile: 1200×1200 WebP, 140KB target (gallery / PDP)
 * - cardFile: 420×420 WebP, 28KB target, quality 0.78→0.58 (cards / rails)
 * GIFs pass through untouched with no card variant.
 */
export async function createProductImageVariants(file) {
  if (!file || !file.type?.startsWith("image/") || file.type === "image/gif") {
    return { mainFile: file, cardFile: null };
  }

  let source;
  try {
    source = await decodeImage(file);
  } catch {
    return { mainFile: file, cardFile: null };
  }

  const bake = async ({ maxWidth, maxHeight, targetBytes, qualitySteps, suffix }) => {
    const { blob, type } = await encodeBest(source, { maxWidth, maxHeight, targetBytes, qualitySteps });
    if (!blob || !type) return null;
    const baseName = (file.name || "image").replace(/\.[^/.]+$/, "");
    const ext = type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${baseName}${suffix}.${ext}`, { type, lastModified: Date.now() });
  };

  // Encode sequentially against the same decoded source so we only decode once.
  const mainFile = (await bake({
    maxWidth: 1200, maxHeight: 1200, targetBytes: TARGET_MAX_BYTES,
    qualitySteps: TARGET_QUALITY_STEPS, suffix: "",
  })) || file;

  const cardFile = await bake({
    maxWidth: 420, maxHeight: 420, targetBytes: CARD_TARGET_BYTES,
    qualitySteps: CARD_QUALITY_STEPS, suffix: "-card",
  });

  if (source.close) {
    try { source.close(); } catch {}
  }

  return { mainFile, cardFile };
}

/**
 * Generate a tiny LQIP base64 data URL from a File (16px wide).
 */
export async function generateTinyPlaceholder(file) {
  if (!file) return null;
  try {
    const source = await decodeImage(file);
    const ratio = source.height / source.width;
    const tinyW = 16;
    const tinyH = Math.max(1, Math.round(tinyW * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = tinyW;
    canvas.height = tinyH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, tinyW, tinyH);
    if (source.close) try { source.close(); } catch {}
    return canvas.toDataURL("image/webp", 0.3);
  } catch {
    return null;
  }
}
