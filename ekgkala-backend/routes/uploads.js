const express = require("express");
const router = express.Router();
const path = require("path");
const {
  uploadToParsPack,
  deleteFromParsPack,
  validateFile,
  generateSafeFilename,
  getPublicUrl,
  MAX_UPLOAD_FILE_SIZE_MB,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
} = require("../lib/parspackS3");
const { protect, checkPermission, checkAnyPermission, PERMISSIONS } = require("../middleware/auth");

// ============================================
// Stream handling middleware for ParsPack upload
// ============================================
const handleSingleImageUpload = (req, res, next) => {
  // Use multer memory storage for direct buffer handling
  const multer = require("multer");
  const storage = multer.memoryStorage();
  
  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
      fieldArrayIndexLimit: 20, // multer>=2.3 DoS hardening (max real index is 9)
    },
    fileFilter: (req, file, cb) => {
      const mime = file.mimetype?.toLowerCase();
      const ext = path.extname(file.originalname).toLowerCase();
      
      // Block dangerous mime types
      const BLOCKED_MIME_TYPES = [
        "image/svg+xml",
        "image/svg",
        "application/xml",
        "text/xml",
        "text/html",
        "application/javascript",
        "text/javascript",
      ];
      
      if (BLOCKED_MIME_TYPES.includes(mime)) {
        return cb(new Error(`نوع فایل ${mime} مجاز نیست`));
      }
      
      if (!ALLOWED_MIME_TYPES.includes(mime)) {
        return cb(new Error("فقط فایل‌های تصویری مجاز هستند"));
      }
      
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new Error(`پسوند ${ext} مجاز نیست`));
      }
      
      cb(null, true);
    },
  });

  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: `حجم فایل نباید بیشتر از ${MAX_UPLOAD_FILE_SIZE_MB} مگابایت باشد`,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || "خطا در آپلود فایل",
      });
    }
    next();
  });
};

// ============================================
// Multiple images upload middleware
// ============================================
const handleMultipleImagesUpload = (req, res, next) => {
  const multer = require("multer");
  const storage = multer.memoryStorage();
  
  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
      fieldArrayIndexLimit: 20, // multer>=2.3 DoS hardening (max real index is 9)
      files: 10,
    },
    fileFilter: (req, file, cb) => {
      const mime = file.mimetype?.toLowerCase();
      const ext = path.extname(file.originalname).toLowerCase();
      
      const BLOCKED_MIME_TYPES = [
        "image/svg+xml",
        "image/svg",
        "application/xml",
        "text/xml",
        "text/html",
        "application/javascript",
        "text/javascript",
      ];
      
      if (BLOCKED_MIME_TYPES.includes(mime)) {
        return cb(new Error(`نوع فایل ${mime} مجاز نیست`));
      }
      
      if (!ALLOWED_MIME_TYPES.includes(mime)) {
        return cb(new Error("فقط فایل‌های تصویری مجاز هستند"));
      }
      
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new Error(`پسوند ${ext} مجاز نیست`));
      }
      
      cb(null, true);
    },
  });

  upload.array("images", 10)(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: `حجم فایل نباید بیشتر از ${MAX_UPLOAD_FILE_SIZE_MB} مگابایت باشد`,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || "خطا در آپلود فایل‌ها",
      });
    }
    next();
  });
};

// ============================================
// POST /api/uploads/image — تک تصویر محصول
// Upload to ParsPack S3
// ============================================
router.post(
  "/image",
  protect,
  checkPermission(PERMISSIONS.PRODUCT_MANAGE_IMAGES),
  handleSingleImageUpload,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "هیچ فایلی آپلود نشده است",
        });
      }

      // Validate file
      validateFile(req.file);

      // Upload to ParsPack S3
      const result = await uploadToParsPack(req.file.buffer, req.file.originalname);

      console.log("[UPLOAD] Uploaded to ParsPack:", {
        filename: result.filename,
        key: result.key,
        url: result.url,
      });

      res.json({
        success: true,
        message: "تصویر با موفقیت در ParsPack آپلود شد",
        data: {
          url: result.url,
          public_id: result.filename,
          key: result.key,
        },
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(400).json({
        success: false,
        message: error.message || "خطا در آپلود تصویر",
        error: error.message,
      });
    }
  }
);

// ============================================
// POST /api/uploads/images — چند تصویر محصول
// ============================================
router.post(
  "/images",
  protect,
  checkPermission(PERMISSIONS.PRODUCT_MANAGE_IMAGES),
  handleMultipleImagesUpload,
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "هیچ فایلی آپلود نشده است",
        });
      }

      const uploadedImages = [];

      for (const file of req.files) {
        // Validate file
        validateFile(file);

        // Upload to ParsPack S3
        const result = await uploadToParsPack(file.buffer, file.originalname);

        uploadedImages.push({
          url: result.url,
          public_id: result.filename,
          key: result.key,
        });
      }

      res.json({
        success: true,
        message: `${uploadedImages.length} تصویر با موفقیت در ParsPack آپلود شدند`,
        data: uploadedImages,
      });
    } catch (error) {
      console.error("Error uploading images:", error);
      res.status(400).json({
        success: false,
        message: "خطا در آپلود تصاویر",
        error: error.message,
      });
    }
  }
);

// ============================================
// POST /api/uploads/banner — آپلود بنر
// ============================================
router.post(
  "/banner",
  protect,
  checkAnyPermission(PERMISSIONS.BANNER_CREATE, PERMISSIONS.BANNER_UPDATE),
  handleSingleImageUpload,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "هیچ فایلی آپلود نشده است",
        });
      }

      // Validate file
      validateFile(req.file);

      // Upload to ParsPack S3
      const result = await uploadToParsPack(req.file.buffer, req.file.originalname);

      res.json({
        success: true,
        message: "بنر با موفقیت در ParsPack آپلود شد",
        data: {
          url: result.url,
          public_id: result.filename,
          key: result.key,
        },
      });
    } catch (error) {
      console.error("Error uploading banner:", error);
      res.status(400).json({
        success: false,
        message: "خطا در آپلود بنر",
        error: error.message,
      });
    }
  }
);

// ============================================
// DELETE /api/uploads/image/:key — حذف تصویر از ParsPack
// ============================================
router.delete(
  "/image/:key",
  protect,
  checkPermission(PERMISSIONS.PRODUCT_MANAGE_IMAGES),
  async (req, res) => {
    try {
      const { key } = req.params;

      if (!key) {
        return res.status(400).json({
          success: false,
          message: "شناسه فایل مشخص نشده است",
        });
      }

      // Delete from ParsPack S3
      await deleteFromParsPack(key);

      res.json({
        success: true,
        message: "تصویر با موفقیت از ParsPack حذف شد",
      });
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({
        success: false,
        message: "خطا در حذف تصویر",
        error: error.message,
      });
    }
  }
);

module.exports = router;
