/**
 * Client-side Image Optimization & Responsive Helpers
 * ====================================================
 * - WebP/JPEG transcoding before upload
 * - Instant blob previews
 * - Responsive srcset generation for S3 URLs
 */

const DEFAULT_MAX_WIDTH = 1200;
const DEFAULT_MAX_HEIGHT = 1200;
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55];
const TARGET_MAX_BYTES = 140 * 1024;

/* ── Instant Blob Preview ──────────────────────────────────── */

export function createBlobPreview(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeBlobPreview(url: string | null): void {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

/* ── Image Decoding ────────────────────────────────────────── */

async function decodeImage(
  file: File
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        /* fall through */
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

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function fitDimensions(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number
) {
  if (srcW <= maxW && srcH <= maxH) return { width: srcW, height: srcH };
  const ratio = Math.min(maxW / srcW, maxH / srcH);
  return {
    width: Math.max(1, Math.round(srcW * ratio)),
    height: Math.max(1, Math.round(srcH * ratio)),
  };
}

/* ── Client-side Optimization ──────────────────────────────── */

interface OptimizeOpts {
  maxWidth?: number;
  maxHeight?: number;
  targetBytes?: number;
}

export async function optimizeImageFile(
  file: File,
  opts: OptimizeOpts = {}
): Promise<File> {
  if (!file?.type?.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;

  const maxWidth = opts.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxHeight = opts.maxHeight ?? DEFAULT_MAX_HEIGHT;
  const targetBytes = opts.targetBytes ?? TARGET_MAX_BYTES;

  let source: ImageBitmap | HTMLImageElement;
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

  const { width, height } = fitDimensions(srcW, srcH, maxWidth, maxHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  let bestBlob: Blob | null = null as Blob | null;
  let bestType: string | null = null as string | null;

  const tryFormat = async (type: string, fillBg: boolean) => {
    for (const quality of QUALITY_STEPS) {
      ctx.clearRect(0, 0, width, height);
      if (fillBg) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(source, 0, 0, width, height);
      const blob = await canvasToBlob(canvas, type, quality);
      if (!blob) continue;
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestType = type;
      }
      if (blob.size <= targetBytes) return true;
    }
    return false;
  };

  await tryFormat("image/webp", false);
  await tryFormat("image/jpeg", true);

  if ("close" in source && typeof source.close === "function") {
    try {
      source.close();
    } catch {}
  }

  if (!bestBlob || !bestType || bestBlob.size >= file.size) return file;

  const finalBlob: Blob = bestBlob;
  const finalType: string = bestType;
  const baseName = (file.name || "image").replace(/\.[^/.]+$/, "");
  const ext = finalType === "image/webp" ? "webp" : "jpg";

  return new File([finalBlob], `${baseName}.${ext}`, {
    type: finalType,
    lastModified: Date.now(),
  });
}

/* ── Responsive srcset Generation ──────────────────────────── */

const RESPONSIVE_WIDTHS = [320, 640, 768, 1024, 1280, 1536];

/**
 * Generate a srcSet string from an S3 URL using Next.js image loader.
 * For use with `<img>` tags when you need manual srcset control.
 * If using next/image, prefer the `sizes` prop instead.
 */
export function generateSrcSet(
  url: string,
  widths: number[] = RESPONSIVE_WIDTHS
): string {
  // Images are served unoptimized straight from ParsPack S3, so there is no
  // server-side resize pipeline to point at. The dual-tier files on S3
  // (1200px main + 420px `-card.webp`) are the responsive story; a plain
  // `<img>` just uses `url` directly.
  void widths;
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return "";
  return `${url} 1x`;
}

/**
 * Generate a tiny LQIP data URL from a File (16px wide).
 */
export async function generateTinyPlaceholder(
  file: File
): Promise<string | null> {
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
    if ("close" in source && typeof source.close === "function") {
      try {
        source.close();
      } catch {}
    }
    return canvas.toDataURL("image/webp", 0.3);
  } catch {
    return null;
  }
}
