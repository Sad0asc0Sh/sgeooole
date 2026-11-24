import { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Upload,
  Avatar,
  Button,
  message,
  Space,
} from 'antd'
import { UserOutlined, UploadOutlined, CameraOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../stores'
import api from '../../api'

function ProfileModal({ open, onClose }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [previewAvatar, setPreviewAvatar] = useState(null)
  const { user, permissions, setUser, setAuth } = useAuthStore()

  // مقداردهی اولیه فرم با اطلاعات کاربر
  useEffect(() => {
    if (open && user) {
      form.setFieldsValue({
        name: user.name,
        email: user.email,
      })
      setPreviewAvatar(user.avatar?.url || null)
    }
  }, [open, user, form])

  // به‌روزرسانی اطلاعات پروفایل (نام، ایمیل، رمز عبور)
  const handleUpdateProfile = async (values) => {
    setLoading(true)
    try {
      const updateData = {
        name: values.name,
        email: values.email,
      }

      // فقط اگر رمز عبور وارد شده باشد آن را ارسال کن
      if (values.password && values.password.trim() !== '') {
        updateData.password = values.password
        updateData.currentPassword = values.currentPassword
      }

      const res = await api.put('/auth/admin/profile', updateData)

      if (res.data.success) {
        message.success('پروفایل با موفقیت به‌روزرسانی شد')
        // به‌روزرسانی اطلاعات کاربر و توکن در store
        if (res.data.token) {
          setAuth(res.data.data, res.data.token, permissions)
        } else {
          setUser(res.data.data)
        }
        // پاک کردن فیلدهای رمز عبور
        form.setFieldsValue({
          currentPassword: '',
          password: '',
          confirmPassword: '',
        })
      }
    } catch (error) {
      const errorMsg =
        error?.response?.data?.message || 'خطا در به‌روزرسانی پروفایل'
      message.error(errorMsg)
      console.error('Profile update error:', error)
    } finally {
      setLoading(false)
    }
  }

  // آپلود آواتار
  const handleAvatarUpload = async ({ file, onSuccess, onError }) => {
    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const res = await api.put('/auth/me/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (res.data.success) {
        message.success('آواتار با موفقیت به‌روزرسانی شد')
        // به‌روزرسانی اطلاعات کاربر در store
        setUser(res.data.data)
        setPreviewAvatar(res.data.data.avatar?.url)
        onSuccess(res.data.data)
      }
    } catch (error) {
      const errorMsg =
        error?.response?.data?.message || 'خطا در آپلود آواتار'
      message.error(errorMsg)
      console.error('Avatar upload error:', error)
      onError(error)
    } finally {
      setAvatarUploading(false)
    }
  }

  const beforeUpload = (file) => {
    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      message.error('فقط فایل‌های تصویری مجاز هستند!')
      return false
    }

    const isLt2M = file.size / 1024 / 1024 < 2
    if (!isLt2M) {
      message.error('حجم تصویر باید کمتر از 2 مگابایت باشد!')
      return false
    }

    return true
  }

  return (
    <Modal
      title="ویرایش پروفایل"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      centered
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Avatar
            size={120}
            src={previewAvatar}
            icon={!previewAvatar && <UserOutlined />}
            style={{ marginBottom: 16 }}
          />
          <Upload
            showUploadList={false}
            customRequest={handleAvatarUpload}
            beforeUpload={beforeUpload}
            accept="image/*"
          >
            <Button
              type="primary"
              shape="circle"
              icon={<CameraOutlined />}
              loading={avatarUploading}
              style={{
                position: 'absolute',
                bottom: 16,
                right: 0,
              }}
            />
          </Upload>
        </div>
        <div style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
          برای تغییر آواتار، روی دکمه دوربین کلیک کنید
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleUpdateProfile}
        autoComplete="off"
      >
        <Form.Item
          name="name"
          label="نام"
          rules={[
            {
              required: true,
              message: 'لطفاً نام خود را وارد کنید',
            },
          ]}
        >
          <Input placeholder="نام کامل" />
        </Form.Item>

        <Form.Item
          name="email"
          label="ایمیل"
          rules={[
            {
              required: true,
              message: 'لطفاً ایمیل خود را وارد کنید',
            },
            {
              type: 'email',
              message: 'فرمت ایمیل نامعتبر است',
            },
          ]}
        >
          <Input placeholder="example@domain.com" dir="ltr" />
        </Form.Item>

        <Form.Item
          name="currentPassword"
          label="رمز عبور فعلی (در صورت تغییر رمز)"
          dependencies={['password']}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                const password = getFieldValue('password')
                if (!password || !password.trim() || (value && value.length > 0)) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('برای تغییر رمز عبور، رمز فعلی الزامی است'))
              },
            }),
          ]}
        >
          <Input.Password placeholder="رمز عبور فعلی" autoComplete="current-password" />
        </Form.Item>

        <Form.Item
          name="password"
          label="رمز عبور جدید (اختیاری)"
          rules={[
            {
              min: 8,
              message: 'رمز عبور باید حداقل ۸ کاراکتر باشد',
            },
          ]}
        >
          <Input.Password placeholder="حداقل ۸ کاراکتر" autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="تکرار رمز عبور جدید"
          dependencies={['password']}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                const password = getFieldValue('password')
                if (!password || !value || password === value) {
                  return Promise.resolve()
                }
                return Promise.reject(
                  new Error('رمز عبور و تکرار آن یکسان نیستند')
                )
              },
            }),
          ]}
        >
          <Input.Password placeholder="تکرار رمز عبور جدید" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>انصراف</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              ذخیره تغییرات
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default ProfileModal
