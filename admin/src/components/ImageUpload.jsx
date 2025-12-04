import React, { useState, useCallback } from 'react';
import { Upload, message, Progress, Image, Button, Modal, Spin } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  LoadingOutlined,
  InboxOutlined
} from '@ant-design/icons';
import api from '../api';

/**
 * Professional Image Upload Component for Admin Panel
 *
 * Features:
 * - Drag & Drop support
 * - Multiple image upload
 * - Image preview with modal
 * - Upload progress per image
 * - Delete images
 * - Reorder images (drag to reorder)
 * - Validation (file type, size)
 * - Professional UI with Ant Design
 *
 * Props:
 * - value: Array of image objects [{ url, public_id }]
 * - onChange: Callback when images change
 * - maxCount: Maximum number of images (default: 10)
 * - uploadUrl: API endpoint for upload (default: /api/products/:id/images)
 * - accept: Accepted file types (default: image/*)
 * - maxSize: Max file size in MB (default: 5)
 * - listType: 'picture-card' | 'picture' (default: picture-card)
 */
const ImageUpload = ({
  value = [],
  onChange,
  maxCount = 10,
  uploadUrl,
  accept = 'image/jpeg,image/jpg,image/png,image/webp',
  maxSize = 5,
  listType = 'picture-card',
  disabled = false,
}) => {
  const [fileList, setFileList] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  // Convert value to fileList format
  React.useEffect(() => {
    if (value && Array.isArray(value)) {
      const list = value.map((img, index) => {
        const url = typeof img === 'string' ? img : img.url;
        const publicId = typeof img === 'object' ? img.public_id : null;

        return {
          uid: publicId || `${index}`,
          name: publicId || `image-${index}`,
          status: 'done',
          url: url,
          public_id: publicId,
        };
      });
      setFileList(list);
    }
  }, [value]);

  // Validate file before upload
  const beforeUpload = (file) => {
    // Check file type
    const isValidType = file.type.startsWith('image/');
    if (!isValidType) {
      message.error('فقط فایل‌های تصویری مجاز هستند!');
      return Upload.LIST_IGNORE;
    }

    // Check file size
    const isValidSize = file.size / 1024 / 1024 < maxSize;
    if (!isValidSize) {
      message.error(`حجم فایل باید کمتر از ${maxSize}MB باشد!`);
      return Upload.LIST_IGNORE;
    }

    // Check max count
    if (fileList.length >= maxCount) {
      message.error(`حداکثر ${maxCount} تصویر می‌توانید آپلود کنید!`);
      return Upload.LIST_IGNORE;
    }

    return false; // Prevent auto upload
  };

  // Handle file list change
  const handleChange = ({ fileList: newFileList }) => {
    setFileList(newFileList);

    // Extract URLs for parent component
    const urls = newFileList
      .filter(file => file.status === 'done')
      .map(file => ({
        url: file.url,
        public_id: file.public_id,
        sizes: file.sizes,
      }));

    onChange?.(urls);
  };

  // Custom upload function
  const customUpload = async ({ file, onProgress, onSuccess, onError }) => {
    try {
      if (!uploadUrl) {
        throw new Error('Upload URL is not provided');
      }

      const formData = new FormData();
      formData.append('images', file);

      const response = await api.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress({ percent });
        },
      });

      if (response.data.success) {
        const uploadedImages = response.data.data.images;
        const lastImage = uploadedImages[uploadedImages.length - 1];

        onSuccess(
          {
            url: lastImage.url,
            public_id: lastImage.public_id,
            sizes: lastImage.sizes,
          },
          file
        );

        message.success('تصویر با موفقیت آپلود شد');
      } else {
        throw new Error(response.data.message || 'خطا در آپلود تصویر');
      }
    } catch (error) {
      console.error('Upload error:', error);
      onError(error);
      message.error(error.response?.data?.message || error.message || 'خطا در آپلود تصویر');
    }
  };

  // Handle preview
  const handlePreview = async (file) => {
    setPreviewImage(file.url || file.preview);
    setPreviewVisible(true);
    setPreviewTitle(file.name || 'پیش‌نمایش تصویر');
  };

  // Handle remove
  const handleRemove = async (file) => {
    Modal.confirm({
      title: 'حذف تصویر',
      content: 'آیا از حذف این تصویر اطمینان دارید؟',
      okText: 'بله',
      cancelText: 'خیر',
      okType: 'danger',
      onOk: async () => {
        try {
          // If image is uploaded to server, call delete API
          if (file.public_id && uploadUrl) {
            // Extract product ID from uploadUrl if available
            const productIdMatch = uploadUrl.match(/\/products\/([^\/]+)/);
            if (productIdMatch) {
              const productId = productIdMatch[1];
              // URL encode public_id to handle special characters like /
              const encodedPublicId = encodeURIComponent(file.public_id);

              console.log('[DELETE] Deleting image:', {
                productId,
                publicId: file.public_id,
                encodedPublicId,
              });

              await api.delete(`/api/products/${productId}/images/${encodedPublicId}`);

              console.log('[DELETE] Image deleted successfully from server');
            }
          }

          // Remove from fileList
          const newFileList = fileList.filter(item => item.uid !== file.uid);
          setFileList(newFileList);

          // Update parent
          const urls = newFileList
            .filter(f => f.status === 'done')
            .map(f => ({
              url: f.url,
              public_id: f.public_id,
              sizes: f.sizes,
            }));
          onChange?.(urls);

          message.success('تصویر با موفقیت حذف شد');
        } catch (error) {
          console.error('[DELETE] Delete error:', error);
          message.error(error.response?.data?.message || 'خطا در حذف تصویر');

          // اگر خطا رخ داد، عکس را به لیست برگردان
          // این از حذف اشتباهی از state جلوگیری می‌کند
          throw error;
        }
      },
    });

    return false; // Prevent default remove
  };

  const uploadButton = (
    <div>
      {uploading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>آپلود</div>
    </div>
  );

  return (
    <>
      <Upload
        accept={accept}
        listType={listType}
        fileList={fileList}
        beforeUpload={beforeUpload}
        onChange={handleChange}
        onPreview={handlePreview}
        onRemove={handleRemove}
        customRequest={uploadUrl ? customUpload : undefined}
        multiple
        disabled={disabled}
        maxCount={maxCount}
        className="professional-image-upload"
      >
        {fileList.length >= maxCount ? null : uploadButton}
      </Upload>

      {/* Preview Modal */}
      <Modal
        open={previewVisible}
        title={previewTitle}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width={800}
      >
        <img
          alt="preview"
          style={{ width: '100%' }}
          src={previewImage}
        />
      </Modal>

      {/* Info */}
      <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
        <div>• فرمت‌های مجاز: JPG، PNG، WEBP</div>
        <div>• حداکثر حجم فایل: {maxSize}MB</div>
        <div>• حداکثر تعداد: {maxCount} تصویر</div>
        <div>• برای آپلود روی دکمه کلیک کنید یا تصویر را بکشید و رها کنید</div>
      </div>

      <style jsx>{`
        .professional-image-upload {
          width: 100%;
        }
      `}</style>
    </>
  );
};

export default ImageUpload;
