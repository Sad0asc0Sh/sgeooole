const crypto = require("crypto");
const path = require("path");
const axios = require("axios");
const https = require("https");
const { execFile } = require("child_process");
const MAX_UPLOAD_RETRIES = 4;
// ============================================
// ParsPack S3 Configuration
// ============================================
const PARSPACK_ENDPOINT = (process.env.PARSPACK_ENDPOINT || "c258565.parspack.net").replace(/^https?:\/\//, "");
const PARSPACK_BUCKET_NAME = process.env.PARSPACK_BUCKET_NAME || "";
const PARSPACK_ACCESS_KEY = process.env.PARSPACK_ACCESS_KEY || "";
const PARSPACK_SECRET_KEY = process.env.PARSPACK_SECRET_KEY || "";
const PARSPACK_REGION = process.env.PARSPACK_REGION || "default";
const SERVICE = "s3";

// ParsPack uses virtual-hosted-style routing: the first label of the
// endpoint hostname (e.g. "c258565" from "c258565.parspack.net") is the
// real S3 bucket.
const HOST_BUCKET = PARSPACK_ENDPOINT.split(".")[0];

const isValidConfig = !!(PARSPACK_BUCKET_NAME && PARSPACK_ACCESS_KEY && PARSPACK_SECRET_KEY);

// TLS debug override — set S3_TLS_REJECT_UNAUTHORIZED=0 ONLY for temporary
// debugging when the endpoint DNS is misconfigured on the host machine.
// NEVER use in production.
const S3_REJECT_UNAUTHORIZED = process.env.S3_TLS_REJECT_UNAUTHORIZED !== "0";
const s3HttpsAgent = new https.Agent({
  rejectUnauthorized: S3_REJECT_UNAUTHORIZED,
  keepAlive: true,
});
if (!S3_REJECT_UNAUTHORIZED) {
  console.warn("[ParspackS3] ⚠ TLS certificate validation DISABLED (S3_TLS_REJECT_UNAUTHORIZED=0). Do NOT use in production.");
}

if (!isValidConfig) {
  console.warn("[ParspackS3] Missing PARSPACK_BUCKET_NAME, PARSPACK_ACCESS_KEY, or PARSPACK_SECRET_KEY — uploads will fail.");
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
// URI-encode per AWS spec (RFC 3986)
// Encodes every character except unreserved ones: A-Z a-z 0-9 - _ . ~
// Forward slashes '/' are preserved (not encoded).
// ============================================
const uriEncode = (str) => {
  return String(str).replace(/[^A-Za-z0-9\-_.~\/]/g, (ch) => {
    const hex = ch.charCodeAt(0).toString(16).toUpperCase();
    return "%" + (hex.length === 1 ? "0" + hex : hex);
  });
};

// ============================================
// WebP Conversion via ImageMagick
// Converts an image buffer to WebP using the system `convert` binary.
// Falls back to the original buffer on any error (missing binary,
// unsupported format, timeout, etc.).
// GIF is skipped because animated frames are not reliably preserved.
// ============================================
const WEBP_QUALITY = 82;
const CONVERT_TIMEOUT_MS = 15000;

const convertToWebp = (buffer) =>
  new Promise((resolve) => {
    const child = execFile(
      "convert",
      [
        "-",              // read from stdin
        "-quality", String(WEBP_QUALITY),
        "-strip",         // remove metadata for smaller size
        "webp:-",         // write webp to stdout
      ],
      {
        encoding: "buffer",
        timeout: CONVERT_TIMEOUT_MS,
        maxBuffer: 50 * 1024 * 1024,
      },
      (err, stdout) => {
        if (err || !stdout || stdout.length === 0) {
          if (err) {
            console.warn("[ParspackS3] WebP conversion failed, using original:", err.message);
          }
          resolve(null);
        } else {
          resolve(stdout);
        }
      }
    );

    try {
      child.stdin.write(buffer);
      child.stdin.end();
    } catch (stdinErr) {
      console.warn("[ParspackS3] Could not write to convert stdin:", stdinErr.message);
      resolve(null);
    }
  });

const shouldConvertToWebp = (extLower) => {
  // Skip GIF (animated frames) and files already in webp format
  if (extLower === ".gif" || extLower === ".webp") return false;
  return [".jpg", ".jpeg", ".png"].includes(extLower);
};

const MIME_MAP = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
};

// ============================================
// Verbose S3 error logger
// ============================================
const logS3Error = (label, error) => {
  if (error.response) {
    const { status, headers, data } = error.response;
    const body = typeof data === "string"
      ? data
      : (Buffer.isBuffer(data) ? data.toString("utf-8") : JSON.stringify(data));
    console.error(`[ParspackS3] ${label} — HTTP ${status}`);
    console.error(`[ParspackS3] ${label} — Response Headers:`, JSON.stringify(headers));
    console.error(`[ParspackS3] ${label} — Response Body (S3 XML):`, body);
  } else if (error.request) {
    console.error(`[ParspackS3] ${label} — No response received (network error):`, error.message);
  } else {
    console.error(`[ParspackS3] ${label} — Error:`, error.message);
  }
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

  if (BLOCKED_MIME_TYPES.includes(mime)) {
    throw new Error(`نوع فایل ${mime} مجاز نیست`);
  }

  if (!ALLOWED_MIME_TYPES.includes(mime)) {
    throw new Error("فقط فایل‌های تصویری مجاز هستند");
  }

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`پسوند ${ext} مجاز نیست`);
  }

  if (BLOCKED_EXTENSIONS.some((blocked) => originalName.includes(blocked))) {
    throw new Error("فایل مشکوک شناسایی شد");
  }

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
// Upload to ParsPack S3
// Virtual-hosted: host already contains the bucket; PARSPACK_BUCKET_NAME
// is a key prefix.  The canonical URI signed must equal what ParsPack
// internally resolves: /<hostBucket>/<bucketName>/<objectKey>
// ============================================
const uploadToParsPack = async (buffer, originalName) => {
  if (!isValidConfig) {
    throw new Error("تنظیمات ParsPack Cloud Storage انجام نشده است");
  }

  if (!Buffer.isBuffer(buffer)) {
    throw new Error("[ParspackS3] Upload payload must be a Buffer");
  }

  const filename = generateSafeFilename(originalName);
  const ext = path.extname(originalName).toLowerCase();

  let uploadBuffer = buffer;
  let uploadFilename = filename;
  let contentType = MIME_MAP[ext] || "application/octet-stream";

  if (shouldConvertToWebp(ext)) {
    const webpBuffer = await convertToWebp(buffer);
    if (webpBuffer) {
      uploadBuffer = webpBuffer;
      uploadFilename = filename.replace(/\.[^.]+$/, ".webp");
      contentType = "image/webp";
      console.log(
        `[ParspackS3] Converted to WebP: ${buffer.length} → ${webpBuffer.length} bytes (${Math.round((1 - webpBuffer.length / buffer.length) * 100)}% smaller)`
      );
    }
  }

  const objectKey = `uploads/${uploadFilename}`;
  const urlPath = `/${PARSPACK_BUCKET_NAME}/${objectKey}`;
  const canonicalUri = uriEncode(`/${HOST_BUCKET}${urlPath}`);
  const hostname = PARSPACK_ENDPOINT;
  const publicUrl = `https://${hostname}${urlPath}`;

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
    console.log(`[ParspackS3] Upload attempt ${attempt}/${MAX_UPLOAD_RETRIES} via ${hostname}`);

    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = "UNSIGNED-PAYLOAD";

    const headersObj = {
      "content-type": contentType,
      host: hostname,
      "x-amz-acl": "public-read",
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    headersObj["cache-control"] = "public, max-age=31536000, immutable";
    const signedHeaders = Object.keys(headersObj).sort();

    const authorization = buildAuthorizationHeader({
      method: "PUT",
      pathname: canonicalUri,
      queryString: "",
      headers: headersObj,
      signedHeaders,
      payloadHash,
      accessKey: PARSPACK_ACCESS_KEY,
      secretKey: PARSPACK_SECRET_KEY,
      region: PARSPACK_REGION,
      service: SERVICE,
      dateStamp,
      amzDate,
    });

    const url = `https://${hostname}${urlPath}`;

    try {
      const response = await axios.put(url, uploadBuffer, {
        headers: {
          ...headersObj,
          "content-length": String(uploadBuffer.length),
          Authorization: authorization,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        transformRequest: [(data) => data],
        httpsAgent: s3HttpsAgent,
      });

      console.log(`[ParspackS3] Upload succeeded on attempt ${attempt} via ${hostname}`);

      return {
        key: objectKey,
        filename: uploadFilename,
        url: publicUrl,
        etag: response.headers && response.headers.etag,
      };
    } catch (error) {
      lastError = error;
      logS3Error(`Upload attempt ${attempt}`, error);

      if (attempt < MAX_UPLOAD_RETRIES) {
        const delay = Math.pow(2, attempt - 1) * 500;
        console.warn(`[ParspackS3] Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  const detail = lastError.response
    ? `(HTTP ${lastError.response.status}) ${typeof lastError.response.data === "string" ? lastError.response.data.slice(0, 500) : JSON.stringify(lastError.response.data).slice(0, 500)}`
    : lastError.message;
  throw new Error(`خطا در آپلود روی ParsPack Cloud Storage (after ${MAX_UPLOAD_RETRIES} attempts): ${detail}`);
};

// ============================================
// Delete file from ParsPack S3
// ============================================
const deleteFromParsPack = async (key) => {
  if (!isValidConfig || !key) {
    console.warn("[ParspackS3] Config not set, skip delete");
    return;
  }

  const objectKey = key.startsWith("uploads/") ? key : `uploads/${key}`;

  const host = PARSPACK_ENDPOINT;
  const urlPath = `/${PARSPACK_BUCKET_NAME}/${objectKey}`;
  const url = `https://${host}${urlPath}`;
  const canonicalUri = uriEncode(`/${HOST_BUCKET}${urlPath}`);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = "UNSIGNED-PAYLOAD";

  const headersObj = {
    host: host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaders = Object.keys(headersObj).sort();

  const authorization = buildAuthorizationHeader({
    method: "DELETE",
    pathname: canonicalUri,
    queryString: "",
    headers: headersObj,
    signedHeaders,
    payloadHash,
    accessKey: PARSPACK_ACCESS_KEY,
    secretKey: PARSPACK_SECRET_KEY,
    region: PARSPACK_REGION,
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
      httpsAgent: s3HttpsAgent,
    });
    console.log("[ParspackS3] File deleted:", objectKey);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log("[ParspackS3] File already gone (404):", objectKey);
      return;
    }
    logS3Error("Delete", error);
  }
};

// ============================================
// Get public URL from key
// ============================================
const getPublicUrl = (key) => {
  return `https://${PARSPACK_ENDPOINT}/${PARSPACK_BUCKET_NAME}/${key}`;
};

// ============================================
// Extract image info from buffer
// ============================================
const extractImageInfo = (buffer, originalName) => {
  const filename = generateSafeFilename(originalName);
  const key = `uploads/${filename}`;

  return {
    url: `https://${PARSPACK_ENDPOINT}/${PARSPACK_BUCKET_NAME}/${key}`,
    public_id: filename,
    key: key,
  };
};

// ============================================
// Export
// ============================================
module.exports = {
  uploadToParsPack,
  deleteFromParsPack,
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
