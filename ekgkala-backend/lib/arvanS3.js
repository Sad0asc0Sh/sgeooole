const crypto = require("crypto");
const path = require("path");
const axios = require("axios");

// ============================================
// ArvanCloud S3 Configuration
// ============================================
const ARVAN_ENDPOINT = (process.env.ARVAN_ENDPOINT || "s3.ir-thr-at1.arvanstorage.ir").replace(/^https?:\/\//, "");
const ARVAN_BUCKET_NAME = process.env.ARVAN_BUCKET_NAME || "";
const ARVAN_ACCESS_KEY = process.env.ARVAN_ACCESS_KEY || "";
const ARVAN_SECRET_KEY = process.env.ARVAN_SECRET_KEY || "";
const ARVAN_REGION = process.env.ARVAN_REGION || "ir-thr-at1";
const SERVICE = "s3";

// Validate required env vars
const isValidConfig = ARVAN_BUCKET_NAME && ARVAN_ACCESS_KEY && ARVAN_SECRET_KEY;

if (!isValidConfig) {
  console.warn("[ArvanS3] Missing ARVAN_BUCKET_NAME, ARVAN_ACCESS_KEY, or ARVAN_SECRET_KEY — uploads will fail.");
}

// ============================================
// AWS Signature V4 Helpers
// ============================================

const sha256 = (data) =>
  crypto.createHash("sha256").update(data).digest("hex");

const hmacSha256 = (key, data) =>
  crypto.createHmac("sha256", key).update(data).digest();

const hmacSha256Hex = (key, data) =>
  crypto.createHmac("sha256", key).update(data).digest("hex");

const getSigningKey = (secretKey, dateStamp, region, service) => {
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  return kSigning;
};

const buildAuthorizationHeader = ({
  method,
  pathname,
  queryString,
  headers,
  signedHeaders,
  payloadHash,
  accessKey,
  secretKey,
  region,
  service,
  dateStamp,
  amzDate,
}) => {
  const canonicalHeaders = signedHeaders
    .map((h) => `${h}:${headers[h]}`)
    .join("\n") + "\n";
  const signedHeadersStr = signedHeaders.join(";");

  const canonicalRequest = [
    method,
    pathname,
    queryString || "",
    canonicalHeaders,
    signedHeadersStr,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSigningKey(secretKey, dateStamp, region, service);
  const signature = hmacSha256Hex(signingKey, stringToSign);

  return `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;
};

// ============================================
// Security Configuration
// ============================================
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const BLOCKED_MIME_TYPES = [
  "image/svg+xml",
  "image/svg",
  "application/xml",
  "text/xml",
  "text/html",
  "application/javascript",
  "text/javascript",
];

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

const BLOCKED_EXTENSIONS = [
  ".svg",
  ".html",
  ".htm",
  ".xml",
  ".js",
  ".php",
  ".asp",
  ".aspx",
  ".exe",
  ".sh",
  ".bat",
];

const DEFAULT_MAX_UPLOAD_FILE_SIZE_MB = 10;
const parsedMaxUploadFileSizeMb = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB);
const MAX_UPLOAD_FILE_SIZE_MB =
  Number.isFinite(parsedMaxUploadFileSizeMb) && parsedMaxUploadFileSizeMb > 0
    ? parsedMaxUploadFileSizeMb
    : DEFAULT_MAX_UPLOAD_FILE_SIZE_MB;
const MAX_UPLOAD_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;

// ============================================
// File Validation
// ============================================
const validateFile = (file) => {
  const mime = file.mimetype?.toLowerCase();
  const ext = path.extname(file.originalname).toLowerCase();
  const originalName = file.originalname?.toLowerCase() || "";

  // Check blocked mime types
  if (BLOCKED_MIME_TYPES.includes(mime)) {
    throw new Error(`نوع فایل ${mime} مجاز نیست`);
  }

  // Check allowed mime types
  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    throw new Error("فقط فایل‌های تصویری مجاز هستند");
  }

  // Check allowed extensions
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`پسوند ${ext} مجاز نیست`);
  }

  // Check blocked extensions
  if (BLOCKED_EXTENSIONS.some((blocked) => originalName.includes(blocked))) {
    throw new Error("فایل مشکوک شناسایی شد");
  }

  // Check suspicious patterns
  const suspiciousPatterns = [
    /\.php$/i,
    /\.asp$/i,
    /\.exe$/i,
    /\.sh$/i,
    /\.bat$/i,
    /\.js$/i,
    /\.svg$/i,
    /\.htm$/i,
    /\0/,
    /\.\./,
  ];
  if (suspiciousPatterns.some((p) => p.test(originalName))) {
    throw new Error("نام فایل مشکوک است");
  }

  // Check file size
  if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    throw new Error(
      `حجم فایل نباید بیشتر از ${MAX_UPLOAD_FILE_SIZE_MB} مگابایت باشد`
    );
  }

  return true;
};

// ============================================
// Generate Safe Filename
// ============================================
const generateSafeFilename = (originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  const uuid = crypto.randomUUID();
  return `${uuid}${ext}`;
};

// ============================================
// Upload to ArvanCloud S3
// ============================================
const uploadToArvan = async (buffer, originalName) => {
  if (!isValidConfig) {
    throw new Error("تنظیمات ArvanCloud انجام نشده است");
  }

  const filename = generateSafeFilename(originalName);
  const key = `uploads/${filename}`;
  const host = `${ARVAN_BUCKET_NAME}.${ARVAN_ENDPOINT}`;
  const url = `https://${host}/${key}`;

  const ext = path.extname(originalName).toLowerCase();
  const mimeMap = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
  const contentType = mimeMap[ext] || "application/octet-stream";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(buffer);

  const headersObj = {
    host: host,
    "content-type": contentType,
    "x-amz-acl": "public-read",
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaders = Object.keys(headersObj).sort();

  const authorization = buildAuthorizationHeader({
    method: "PUT",
    pathname: `/${key}`,
    queryString: "",
    headers: headersObj,
    signedHeaders,
    payloadHash,
    accessKey: ARVAN_ACCESS_KEY,
    secretKey: ARVAN_SECRET_KEY,
    region: ARVAN_REGION,
    service: SERVICE,
    dateStamp,
    amzDate,
  });

  try {
    const response = await axios.put(url, buffer, {
      headers: {
        ...headersObj,
        Authorization: authorization,
        "Content-Length": buffer.length,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return {
      key,
      filename,
      url,
      etag: response.ETag,
    };
  } catch (error) {
    const msg = error.response
      ? `[ArvanS3] Upload error (${error.response.status}): ${typeof error.response.data === "string" ? error.response.data.slice(0, 300) : JSON.stringify(error.response.data).slice(0, 300)}`
      : `[ArvanS3] Upload error: ${error.message}`;
    console.error(msg);
    throw new Error("خطا در آپلود روی ابر آروان");
  }
};

// ============================================
// Get image dimensions from buffer
// ============================================
const getImageDimensions = (buffer) => {
  try {
    // Check first 24 bytes
    const buf = buffer.slice(0, 24);
    const fd = Buffer.alloc(24);
    buf.copy(fd);

    // PNG
    if (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    ) {
      return {
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
      };
    }

    // JPEG
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const segLen = buffer.readUInt16BE(offset + 2);
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + segLen;
    }

    return { width: null, height: null };
  } catch (e) {
    return { width: null, height: null };
  }
};

// ============================================
// Delete file from ArvanCloud
// ============================================
const deleteFromArvan = async (key) => {
  if (!isValidConfig || !key) {
    console.warn("[ArvanS3] Config not set, skip delete");
    return;
  }

  const host = `${ARVAN_BUCKET_NAME}.${ARVAN_ENDPOINT}`;
  const objectKey = key.startsWith("uploads/") ? key : `uploads/${key}`;
  const url = `https://${host}/${objectKey}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256("");

  const headersObj = {
    host: host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaders = Object.keys(headersObj).sort();

  const authorization = buildAuthorizationHeader({
    method: "DELETE",
    pathname: `/${objectKey}`,
    queryString: "",
    headers: headersObj,
    signedHeaders,
    payloadHash,
    accessKey: ARVAN_ACCESS_KEY,
    secretKey: ARVAN_SECRET_KEY,
    region: ARVAN_REGION,
    service: SERVICE,
    dateStamp,
    amzDate,
  });

  try {
    await axios.delete(url, {
      headers: {
        ...headersObj,
        Authorization: authorization,
      },
    });
    console.log("[ArvanS3] File deleted:", objectKey);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log("[ArvanS3] File already gone (404):", objectKey);
      return;
    }
    console.error("[ArvanS3] Delete error:", error.response ? error.response.status : error.message);
  }
};

// ============================================
// Get public URL from key
// ============================================
const getPublicUrl = (key) => {
  return `https://${ARVAN_BUCKET_NAME}.${ARVAN_ENDPOINT}/${key}`;
};

// ============================================
// Extract image info from buffer
// ============================================
const extractImageInfo = (buffer, originalName) => {
  const filename = generateSafeFilename(originalName);
  const key = `uploads/${filename}`;
  const dims = getImageDimensions(buffer);

  return {
    url: `https://${ARVAN_BUCKET_NAME}.${ARVAN_ENDPOINT}/${key}`,
    public_id: filename,
    key: key,
    width: dims.width,
    height: dims.height,
  };
};

// ============================================
// Export
// ============================================
module.exports = {
  uploadToArvan,
  deleteFromArvan,
  getPublicUrl,
  extractImageInfo,
  validateFile,
  generateSafeFilename,
  isValidConfig,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  BLOCKED_MIME_TYPES,
  BLOCKED_EXTENSIONS,
  MAX_UPLOAD_FILE_SIZE_MB,
  MAX_UPLOAD_FILE_SIZE_BYTES,
};
