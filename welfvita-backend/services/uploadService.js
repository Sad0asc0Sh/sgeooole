const { v2: cloudinary } = require('cloudinary');
const sharp = require('sharp');
const path = require('path');

/**
 * Upload Service - Professional Image Upload & Processing
 *
 * Features:
 * - Image validation (type, size, dimensions)
 * - Image processing (resize, optimize, format conversion)
 * - Cloudinary integration with transformations
 * - Error handling and cleanup
 */

// ============================================
// Configuration
// ============================================

const UPLOAD_CONFIG = {
  // Product Images
  product: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    folder: 'welfvita/products',
    sizes: {
      thumbnail: { width: 150, height: 150 },
      small: { width: 300, height: 300 },
      medium: { width: 600, height: 600 },
      large: { width: 1200, height: 1200 },
    },
  },

  // User Avatars
  avatar: {
    maxSize: 2 * 1024 * 1024, // 2MB
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    folder: 'welfvita/avatars',
    size: { width: 300, height: 300 }, // Square avatar
  },

  // Category Icons
  category: {
    maxSize: 1 * 1024 * 1024, // 1MB
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
    folder: 'welfvita/categories',
    size: { width: 200, height: 200 },
  },

  // Brand Logos
  brand: {
    maxSize: 1 * 1024 * 1024, // 1MB
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
    folder: 'welfvita/brands',
    size: { width: 300, height: 150 },
  },
};

// ============================================
// Validation Functions
// ============================================

/**
 * Validate image file
 * @param {Object} file - Multer file object
 * @param {String} type - Upload type (product, avatar, category, brand)
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateImage = (file, type = 'product') => {
  const config = UPLOAD_CONFIG[type];

  if (!file) {
    return { valid: false, error: 'فایلی انتخاب نشده است' };
  }

  // Check file size
  if (file.size > config.maxSize) {
    const maxSizeMB = (config.maxSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `حجم فایل نباید بیشتر از ${maxSizeMB} مگابایت باشد`
    };
  }

  // Check file format
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (!config.allowedFormats.includes(ext)) {
    return {
      valid: false,
      error: `فرمت فایل باید یکی از این‌ها باشد: ${config.allowedFormats.join(', ')}`
    };
  }

  // Check mimetype
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

/**
 * Validate multiple images
 * @param {Array} files - Array of Multer file objects
 * @param {String} type - Upload type
 * @param {Number} maxCount - Maximum number of files
 * @returns {Object} { valid: boolean, error?: string }
 */
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

  // Validate each file
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

/**
 * Process and optimize image using Sharp
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Processing options
 * @returns {Promise<Buffer>} Processed image buffer
 */
const processImage = async (buffer, options = {}) => {
  const {
    width,
    height,
    fit = 'inside', // contain, cover, fill, inside, outside
    quality = 85,
    format = 'webp',
  } = options;

  let pipeline = sharp(buffer);

  // Resize if dimensions provided
  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit,
      withoutEnlargement: true, // Don't upscale small images
    });
  }

  // Convert to format and optimize
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

  // Remove metadata for privacy & size
  pipeline = pipeline.rotate().withMetadata({
    orientation: undefined
  });

  return await pipeline.toBuffer();
};

// ============================================
// Cloudinary Upload Functions
// ============================================

/**
 * Upload image buffer to Cloudinary
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} { url, public_id, width, height }
 */
const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const {
      folder = 'welfvita/uploads',
      transformation = {},
      resource_type = 'image',
    } = options;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type,
        transformation,
        overwrite: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve({
          url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Delete image from Cloudinary
 * @param {String} publicId - Cloudinary public_id
 * @returns {Promise<Object>} Deletion result
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) {
      throw new Error('public_id is required');
    }

    const result = await cloudinary.uploader.destroy(publicId);
    return { success: result.result === 'ok', result };
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

/**
 * Delete multiple images from Cloudinary
 * @param {Array<String>} publicIds - Array of public_ids
 * @returns {Promise<Object>} Deletion results
 */
const deleteMultipleFromCloudinary = async (publicIds) => {
  try {
    if (!publicIds || publicIds.length === 0) {
      return { success: true, deleted: [] };
    }

    const result = await cloudinary.api.delete_resources(publicIds);
    return {
      success: true,
      deleted: result.deleted,
      errors: result.deleted_counts
    };
  } catch (error) {
    console.error('Error deleting multiple from Cloudinary:', error);
    throw error;
  }
};

// ============================================
// High-Level Upload Functions
// ============================================

/**
 * Upload product image with processing
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} Upload result with multiple sizes
 */
const uploadProductImage = async (file) => {
  try {
    // Validate
    const validation = validateImage(file, 'product');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const config = UPLOAD_CONFIG.product;

    // Process original image (large size)
    const processedBuffer = await processImage(file.buffer, {
      width: config.sizes.large.width,
      height: config.sizes.large.height,
      fit: 'inside',
      quality: 90,
      format: 'webp',
    });

    // Upload to Cloudinary with transformations for different sizes
    const result = await uploadToCloudinary(processedBuffer, {
      folder: config.folder,
      transformation: [
        // Cloudinary will generate these on-demand
        { width: config.sizes.thumbnail.width, height: config.sizes.thumbnail.height, crop: 'fill' },
        { width: config.sizes.small.width, height: config.sizes.small.height, crop: 'fit' },
        { width: config.sizes.medium.width, height: config.sizes.medium.height, crop: 'fit' },
      ],
    });

    // Return image info with generated URLs for different sizes
    return {
      url: result.url,
      public_id: result.public_id,
      sizes: {
        thumbnail: result.url.replace('/upload/', `/upload/w_${config.sizes.thumbnail.width},h_${config.sizes.thumbnail.height},c_fill/`),
        small: result.url.replace('/upload/', `/upload/w_${config.sizes.small.width},h_${config.sizes.small.height},c_fit/`),
        medium: result.url.replace('/upload/', `/upload/w_${config.sizes.medium.width},h_${config.sizes.medium.height},c_fit/`),
        large: result.url,
      },
    };
  } catch (error) {
    console.error('Error uploading product image:', error);
    throw error;
  }
};

/**
 * Upload avatar with processing
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} Upload result
 */
const uploadAvatar = async (file) => {
  try {
    // Validate
    const validation = validateImage(file, 'avatar');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const config = UPLOAD_CONFIG.avatar;

    // Process avatar (square, cropped)
    const processedBuffer = await processImage(file.buffer, {
      width: config.size.width,
      height: config.size.height,
      fit: 'cover', // Crop to square
      quality: 85,
      format: 'webp',
    });

    // Upload to Cloudinary
    const result = await uploadToCloudinary(processedBuffer, {
      folder: config.folder,
      transformation: {
        gravity: 'face', // Focus on face if detected
        crop: 'thumb',
      },
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

/**
 * Upload category icon with processing
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} Upload result
 */
const uploadCategoryIcon = async (file) => {
  try {
    const validation = validateImage(file, 'category');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const config = UPLOAD_CONFIG.category;

    // Process icon
    const processedBuffer = await processImage(file.buffer, {
      width: config.size.width,
      height: config.size.height,
      fit: 'inside',
      quality: 90,
      format: 'webp',
    });

    const result = await uploadToCloudinary(processedBuffer, {
      folder: config.folder,
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

/**
 * Upload brand logo with processing
 * @param {Object} file - Multer file object
 * @returns {Promise<Object>} Upload result
 */
const uploadBrandLogo = async (file) => {
  try {
    const validation = validateImage(file, 'brand');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const config = UPLOAD_CONFIG.brand;

    // Process logo
    const processedBuffer = await processImage(file.buffer, {
      width: config.size.width,
      height: config.size.height,
      fit: 'inside',
      quality: 90,
      format: 'webp',
    });

    const result = await uploadToCloudinary(processedBuffer, {
      folder: config.folder,
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
  // Validation
  validateImage,
  validateImages,

  // Processing
  processImage,

  // Cloudinary Operations
  uploadToCloudinary,
  deleteFromCloudinary,
  deleteMultipleFromCloudinary,

  // High-Level Upload Functions
  uploadProductImage,
  uploadAvatar,
  uploadCategoryIcon,
  uploadBrandLogo,

  // Config
  UPLOAD_CONFIG,
};
