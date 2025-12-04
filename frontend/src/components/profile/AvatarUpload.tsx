"use client";
import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { authService } from '@/services/authService';

/**
 * Professional Avatar Upload Component for User Profile
 *
 * Features:
 * - Click to upload or camera button
 * - Preview before upload
 * - Circular crop preview
 * - Upload progress
 * - Error handling
 * - Clean UI with Tailwind CSS
 * - Validation (file type, size)
 *
 * Props:
 * - currentAvatar: Current avatar URL
 * - onUploadSuccess: Callback after successful upload
 * - onUploadError: Callback on error
 */

interface AvatarUploadProps {
  currentAvatar?: string | { url: string; public_id: string } | null;
  onUploadSuccess?: (newAvatarUrl: string) => void;
  onUploadError?: (error: string) => void;
}

export default function AvatarUpload({
  currentAvatar,
  onUploadSuccess,
  onUploadError,
}: AvatarUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get avatar URL (handle both string and object)
  const getAvatarUrl = () => {
    if (!currentAvatar) return null;
    if (typeof currentAvatar === 'string') {
      return currentAvatar.startsWith('http')
        ? currentAvatar
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/${currentAvatar}`;
    }
    return currentAvatar.url;
  };

  const avatarUrl = previewUrl || getAvatarUrl();

  // Validate file
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return 'فقط فایل‌های تصویری مجاز هستند';
    }

    // Check file size (2MB max)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return 'حجم فایل نباید بیشتر از 2 مگابایت باشد';
    }

    // Check image format
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return 'فرمت فایل باید JPG، PNG یا WEBP باشد';
    }

    return null;
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      onUploadError?.(validationError);
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);

    // Upload immediately
    handleUpload(file);
  };

  // Upload to server
  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('avatar', file);

      const response = await authService.updateAvatar(formData);

      if (response.success) {
        const newAvatar = response.data?.user?.avatar;
        const newAvatarUrl = typeof newAvatar === 'object' ? newAvatar.url : newAvatar;

        // Success callback
        onUploadSuccess?.(newAvatarUrl);

        // Show success message briefly
        setTimeout(() => {
          setPreviewUrl(null);
        }, 1000);
      } else {
        throw new Error(response.message || 'خطا در آپلود تصویر');
      }
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'خطا در آپلود تصویر';
      setError(errorMessage);
      onUploadError?.(errorMessage);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  // Handle click
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // Clear preview
  const handleClearPreview = () => {
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative inline-block">
      {/* Avatar Display */}
      <div className="relative">
        <div
          className={`w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border-4 border-white shadow-lg overflow-hidden ${
            uploading ? 'opacity-50' : ''
          }`}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Camera size={32} />
            </div>
          )}

          {/* Upload Progress Overlay */}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
              <Loader2 className="animate-spin text-white" size={32} />
            </div>
          )}
        </div>

        {/* Camera Button */}
        <button
          onClick={handleClick}
          disabled={uploading}
          className={`absolute bottom-0 right-0 w-9 h-9 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-110 ${
            uploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          title="تغییر تصویر پروفایل"
        >
          {uploading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Camera size={16} />
          )}
        </button>

        {/* Clear Preview Button */}
        {previewUrl && !uploading && (
          <button
            onClick={handleClearPreview}
            className="absolute top-0 left-0 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-110"
            title="لغو"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {/* Error Message */}
      {error && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-red-100 text-red-600 text-xs rounded-lg shadow whitespace-nowrap">
          {error}
        </div>
      )}

      {/* Info Hint */}
      {!error && !uploading && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 text-xs text-gray-400 whitespace-nowrap">
          JPG, PNG, WEBP (حداکثر 2MB)
        </div>
      )}
    </div>
  );
}
