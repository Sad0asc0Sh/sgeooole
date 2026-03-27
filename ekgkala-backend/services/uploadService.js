const sharp = require('sharp');
const path = require('path');
const { uploadToParsPack, deleteFromParsPack } = require('../lib/parspackS3');

/**
 * Upload Service - Professional Image Upload & Processing (ParsPack S3)
 *
 * Features:
 * - Image validation (type, size, dimensions)
 * - Image processing (resize, optimize, format conversion)
 * - ParsPack S3 integration
 * - Error handling and cleanup
 */

// ============================================
// Configuration
// ============================================

const UPLOAD_CONFIG = {
  product: {
    maxSize: 5 * 1024 * 1024,
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    sizes: {
      thumbnail: { width: 150, height: 150 },
      small: { width: 300, height: 300 },
      medium: { width: 600, height: 600 },
      large: { width: 1200, height: 1200 },
    },
  },
  avatar: {
    maxSize: 2 * 1024 * 1024,
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    size: { width: 300, height: 300 },
  },
  category: {
    maxSize: 1 * 1024 * 1024,
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
    size: { width: 200, height: 200 },
  },
  brand: {
    maxSize: 1 * 1024 * 1024,
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
    size: { width: 300, height: 150 },
  },
};

// ============================================
// Validation Functions
// ============================================

const validateImage = (file, type = 'product') => {
  const config = UPLOAD_CONFIG[type];

  if (!file) {
    return { valid: false, error: 'فایلی انتخاب نشده است' };
  }

  if (file.size > config.maxSize) {
    const maxSizeMB = (config.maxSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `حجم فایل نباید بیشتر از ${maxSizeMB} مگابایت باشد`
    };
  }

  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (!config.allowedFormats.includes(ext)) {
    return {
      valid: false,
      error: `فرمت فایل باید یکی از این‌ها باشد: ${config.allowedFormats.join(', ')}`
    };
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml'
  ];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return { valid: false, error: 'نوع فایل نامعتبر است' };
  }

  return { valid: true };
};

const validateImages = (files, type = 'product', maxCount = 10) => {
  if (!files || files.length === 0) {
    return { valid: false, error: 'فایلی انتخاب نشده است' };
  }

  if (files.length > maxCount) {
    return {
      valid: false,
      error: `حداکثر ${maxCount} تصویر می‌توانید آپلود کنید`
    };
  }

  for (const file of files) {
    const validation = validateImage(file, type);
    if (!validation.valid) {
      return validation;
    }
  }

  return { valid: true };
};

// ============================================
// Image Processing Functions
// ============================================

const processImage = async (buffer, options = {}) => {
  const {
    width,
    height,
    fit = 'inside',
    quality = 85,
    format = 'webp',
  } = options;

  let pipeline = sharp(buffer);

  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit,
      withoutEnlargement: true,
    });
  }

  if (format === 'webp') {
    pipeline = pipeline.webp({ quality });
  } else if (format === 'jpeg' || format === 'jpg') {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  } else if (format === 'png') {
    pipeline = pipeline.png({
      quality,
      compressionLevel: 9,
      adaptiveFiltering: true
    });
  }

  pipeline = pipeline.rotate().withMetadata({
    orientation: undefined
  });

  return await pipeline.toBuffer();
};

// ============================================
// ParsPack S3 Upload Functions
// ============================================

const uploadToS3 = async (buffer, options = {}) => {
  const { filename = `upload-${Date.now()}.webp` } = options;
  const result = await uploadToParsPack(buffer, filename);
  return {
    url: result.url,
    public_id: result.filename,
    key: result.key,
  };
};

const deleteFromS3 = async (publicId) => {
  try {
    await deleteFromParsPack(publicId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting from ParsPack S3:', error);
    throw error;
  }
};

const deleteMultipleFromS3 = async (publicIds) => {
  try {
    if (!publicIds || publicIds.length === 0) {
      return { success: true, deleted: [] };
    }

    const results = await Promise.allSettled(
      publicIds.map((id) => deleteFromParsPack(id))
    );
    const deleted = results.filter((r) => r.status === 'fulfilled').map((_, i) => publicIds[i]);
    return { success: true, deleted };
  } catch (error) {
    console.error('Error deleting multiple from ParsPack S3:', error);
    throw error;
  }
};

// ============================================
// High-Level Upload Functions
// ============================================

const uploadProductImage = async (file) => {
  try {
    const validation = validateImage(file, 'product');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const config = UPLOAD_CONFIG.product;

    const processedBuffer = await processImage(file.buffer, {
      width: config.sizes.large.width,
      height: config.sizes.large.height,
      fit: 'inside',
      quality: 90,
      format: 'webp',
    });

    const result = await uploadToS3(processedBuffer, {
      filename: `product-${Date.now()}.webp`,
    });

    return {
      url: result.url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error('Error uploading product image:', error);
    throw error;
  }
};

const uploadAvatar = async (file) => {
  try {
    const validation = validateImage(file, 'avatar');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const config = UPLOAD_CONFIG.avatar;

    const processedBuffer = await processImage(file.buffer, {
      width: config.size.width,
      height: config.size.height,
      fit: 'cover',
      quality: 85,
      format: 'webp',
    });

    const result = await uploadToS3(processedBuffer, {
      filename: `avatar-${Date.now()}.webp`,
    });

    return {
      url: result.url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
};

const uploadCategoryIcon = async (file) => {
  try {
    const validation = validateImage(file, 'category');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const config = UPLOAD_CONFIG.category;

    const processedBuffer = await processImage(file.buffer, {
      width: config.size.width,
      height: config.size.height,
      fit: 'inside',
      quality: 90,
      format: 'webp',
    });

    const result = await uploadToS3(processedBuffer, {
      filename: `category-${Date.now()}.webp`,
    });

    return {
      url: result.url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error('Error uploading category icon:', error);
    throw error;
  }
};

const uploadBrandLogo = async (file) => {
  try {
    const validation = validateImage(file, 'brand');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const config = UPLOAD_CONFIG.brand;

    const processedBuffer = await processImage(file.buffer, {
      width: config.size.width,
      height: config.size.height,
      fit: 'inside',
      quality: 90,
      format: 'webp',
    });

    const result = await uploadToS3(processedBuffer, {
      filename: `brand-${Date.now()}.webp`,
    });

    return {
      url: result.url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error('Error uploading brand logo:', error);
    throw error;
  }
};

// ============================================
// Exports
// ============================================

module.exports = {
  validateImage,
  validateImages,
  processImage,
  uploadToS3,
  deleteFromS3,
  deleteMultipleFromS3,
  uploadProductImage,
  uploadAvatar,
  uploadCategoryIcon,
  uploadBrandLogo,
  UPLOAD_CONFIG,
};
