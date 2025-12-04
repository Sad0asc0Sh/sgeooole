import React, { useState } from 'react';
import { Upload, message, Modal, Progress, Card, Row, Col, Button, Space } from 'antd';
import {
  InboxOutlined,
  DeleteOutlined,
  EyeOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import api from '../api';

const { Dragger } = Upload;

/**
 * Professional Drag & Drop Image Upload Component
 *
 * Features:
 * - Large drag & drop area
 * - Multiple image upload with progress
 * - Grid preview with actions
 * - Delete confirmation
 * - File validation
 * - Professional UI
 *
 * Props:
 * - value: Array of image objects
 * - onChange: Callback
 * - maxCount: Max images (default: 10)
 * - uploadUrl: API endpoint
 * - maxSize: Max size in MB (default: 5)
 */
const ImageUploadDragger = ({
  value = [],
  onChange,
  maxCount = 10,
  uploadUrl,
  maxSize = 5,
  disabled = false,
}) => {
  const [fileList, setFileList] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // Convert value to fileList
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
          percent: 100,
        };
      });
      setFileList(list);
    }
  }, [value]);

  // Validate before upload
  const beforeUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('فقط فایل‌های تصویری مجاز هستند!');
      return Upload.LIST_IGNORE;
    }

    const isValidSize = file.size / 1024 / 1024 < maxSize;
    if (!isValidSize) {
      message.error(`حجم فایل باید کمتر از ${maxSize}MB باشد!`);
      return Upload.LIST_IGNORE;
    }

    if (fileList.length >= maxCount) {
      message.error(`حداکثر ${maxCount} تصویر می‌توانید آپلود کنید!`);
      return Upload.LIST_IGNORE;
    }

    return false;
  };

  // Custom upload
  const customUpload = async ({ file, onProgress, onSuccess, onError }) => {
    try {
      if (!uploadUrl) {
        throw new Error('Upload URL not provided');
      }

      const formData = new FormData();
      formData.append('images', file);

      // Add file to list with uploading status
      const newFile = {
        uid: file.uid,
        name: file.name,
        status: 'uploading',
        url: URL.createObjectURL(file),
        percent: 0,
      };

      setFileList(prev => [...prev, newFile]);

      const response = await api.post(uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);

          // Update progress
          setFileList(prev =>
            prev.map(f =>
              f.uid === file.uid ? { ...f, percent } : f
            )
          );

          onProgress({ percent });
        },
      });

      if (response.data.success) {
        const uploadedImages = response.data.data.images;
        const lastImage = uploadedImages[uploadedImages.length - 1];

        // Update file with success status
        setFileList(prev =>
          prev.map(f =>
            f.uid === file.uid
              ? {
                  ...f,
                  status: 'done',
                  url: lastImage.url,
                  public_id: lastImage.public_id,
                  sizes: lastImage.sizes,
                  percent: 100,
                }
              : f
          )
        );

        onSuccess(lastImage, file);
        message.success('تصویر با موفقیت آپلود شد');

        // Update parent
        updateParent([
          ...fileList.filter(f => f.status === 'done'),
          {
            url: lastImage.url,
            public_id: lastImage.public_id,
            sizes: lastImage.sizes,
          },
        ]);
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      console.error('Upload error:', error);

      // Update file with error status
      setFileList(prev =>
        prev.map(f =>
          f.uid === file.uid ? { ...f, status: 'error' } : f
        )
      );

      onError(error);
      message.error(error.response?.data?.message || 'خطا در آپلود تصویر');
    }
  };

  // Update parent component
  const updateParent = (images) => {
    const urls = images
      .filter(img => img.status === 'done')
      .map(img => ({
        url: img.url,
        public_id: img.public_id,
        sizes: img.sizes,
      }));

    onChange?.(urls);
  };

  // Handle delete
  const handleDelete = async (file) => {
    Modal.confirm({
      title: 'حذف تصویر',
      content: 'آیا از حذف این تصویر اطمینان دارید؟',
      okText: 'بله',
      cancelText: 'خیر',
      okType: 'danger',
      onOk: async () => {
        try {
          // Delete from server if has public_id
          if (file.public_id && uploadUrl) {
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

          // Remove from list
          const newFileList = fileList.filter(item => item.uid !== file.uid);
          setFileList(newFileList);
          updateParent(newFileList);

          message.success('تصویر حذف شد');
        } catch (error) {
          console.error('[DELETE] Delete error:', error);
          message.error(error.response?.data?.message || 'خطا در حذف تصویر');

          // اگر خطا رخ داد، از حذف از state جلوگیری می‌کنیم
          throw error;
        }
      },
    });
  };

  // Handle preview
  const handlePreview = (file) => {
    setPreviewImage(file.url);
    setPreviewVisible(true);
  };

  return (
    <div className="image-upload-dragger">
      {/* Drag & Drop Area */}
      {fileList.length < maxCount && (
        <Dragger
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          showUploadList={false}
          beforeUpload={beforeUpload}
          customRequest={customUpload}
          disabled={disabled}
          style={{ marginBottom: 16 }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16 }}>
            برای آپلود تصاویر کلیک کنید یا فایل‌ها را بکشید و اینجا رها کنید
          </p>
          <p className="ant-upload-hint" style={{ color: '#999' }}>
            پشتیبانی از آپلود چندتایی. فرمت‌های JPG، PNG، WEBP (حداکثر {maxSize}MB)
          </p>
          <p className="ant-upload-hint" style={{ color: '#999' }}>
            {fileList.length} / {maxCount} تصویر آپلود شده
          </p>
        </Dragger>
      )}

      {/* Image Grid */}
      {fileList.length > 0 && (
        <Row gutter={[16, 16]}>
          {fileList.map((file) => (
            <Col xs={24} sm={12} md={8} lg={6} key={file.uid}>
              <Card
                hoverable
                cover={
                  <div style={{ position: 'relative', paddingTop: '100%', overflow: 'hidden' }}>
                    <img
                      alt={file.name}
                      src={file.url}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    {file.status === 'uploading' && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.6)',
                        }}
                      >
                        <Progress
                          type="circle"
                          percent={file.percent}
                          width={60}
                          strokeColor="#1890ff"
                        />
                      </div>
                    )}
                  </div>
                }
                actions={[
                  <EyeOutlined key="preview" onClick={() => handlePreview(file)} />,
                  <DeleteOutlined
                    key="delete"
                    onClick={() => handleDelete(file)}
                    style={{ color: 'red' }}
                  />,
                ]}
                bodyStyle={{ padding: 8 }}
              >
                <div style={{ fontSize: 12, color: '#999', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Preview Modal */}
      <Modal
        open={previewVisible}
        title="پیش‌نمایش تصویر"
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width={800}
      >
        <img alt="preview" style={{ width: '100%' }} src={previewImage} />
      </Modal>

      <style jsx>{`
        .image-upload-dragger {
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default ImageUploadDragger;
