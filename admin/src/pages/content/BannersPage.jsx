import { useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Select,
  Modal,
  Form,
  Input,
  Tag,
  message,
  Popconfirm,
  Upload,
  Switch,
  InputNumber,
  Row,
  Col,
  Image,
  Empty,
  Tooltip,
  Divider,
  Alert,
} from 'antd'
import {
  InboxOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  PictureOutlined,
  LinkOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'

// فعال‌سازی تقویم جلالی
dayjs.extend(jalaliday)
dayjs.calendar('jalali')

// نام ماه‌های شمسی
const persianMonths = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

const formatPersianDate = (date, includeTime = false) => {
  if (!date) return '—'
  const jalaliDate = dayjs(date).calendar('jalali').locale('fa')
  const year = jalaliDate.format('YYYY')
  const month = persianMonths[parseInt(jalaliDate.format('M')) - 1]
  const day = jalaliDate.format('DD')

  if (includeTime) {
    const time = jalaliDate.format('HH:mm')
    return `${day} ${month} ${year} - ${time}`
  }
  return `${day} ${month} ${year}`
}

// ============================================
// تنظیمات موقعیت بنرها - راهنمای واضح
// ============================================
const BANNER_POSITIONS = {
  'main-slider': {
    label: '🖼️ اسلایدر اصلی',
    description: 'بنرهای بزرگ بالای صفحه اصلی',
    size: '1920×500 پیکسل',
    aspectRatio: '21:9 یا 16:9',
    minSize: '1200×315 پیکسل',
    mobileTip: 'متن/محتوا را در مرکز تصویر قرار دهید',
    color: 'blue',
  },
  'middle-banner': {
    label: '📢 بنرهای تبلیغاتی',
    description: 'بنرهای میانه صفحه اصلی (حداکثر ۳ عدد)',
    size: '600×200 پیکسل',
    aspectRatio: '3:1',
    minSize: '400×133 پیکسل',
    mobileTip: 'در موبایل تمام عرض نمایش داده می‌شود',
    color: 'orange',
  },
  'campaign-banner': {
    label: '🎯 بنر کمپین',
    description: 'بنر ویژه کمپین و تخفیفات',
    size: '1200×375 پیکسل',
    aspectRatio: '16:5',
    minSize: '800×250 پیکسل',
    mobileTip: 'متن مهم را در ناحیه امن مرکز بگذارید',
    color: 'purple',
  },
}

const MAX_BANNER_UPLOAD_SIZE_MB = 10
const MAX_BANNER_UPLOAD_SIZE_BYTES = MAX_BANNER_UPLOAD_SIZE_MB * 1024 * 1024

function BannersPage() {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [positionFilter, setPositionFilter] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [fileList, setFileList] = useState([])
  const [previewImage, setPreviewImage] = useState(null)
  const [selectedPosition, setSelectedPosition] = useState('main-slider')

  // ============================================
  // دریافت لیست بنرها
  // ============================================
  const fetchBanners = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const params = { page, limit: pageSize, sort: 'sortOrder -createdAt' }
      if (positionFilter) params.position = positionFilter
      const res = await api.get('/banners', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination
      setBanners(list)
      if (pg) {
        setPagination({
          current: pg.currentPage || page,
          pageSize,
          total: pg.totalItems || list.length,
        })
      }
    } catch (err) {
      message.error(err?.response?.data?.message || 'خطا در دریافت بنرها')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBanners(1, pagination.pageSize)
  }, [positionFilter])

  // ============================================
  // ستون‌های جدول با طراحی بهتر
  // ============================================
  const columns = [
    {
      title: '📷 تصویر',
      dataIndex: ['image', 'url'],
      key: 'image',
      width: 120,
      render: (url) =>
        url ? (
          <Image
            src={url}
            alt="بنر"
            width={100}
            height={50}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            preview={{ mask: <EyeOutlined /> }}
          />
        ) : (
          <div
            style={{
              width: 100,
              height: 50,
              background: '#f5f5f5',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
            }}
          >
            <PictureOutlined style={{ fontSize: 20 }} />
          </div>
        ),
    },
    {
      title: '📝 عنوان',
      dataIndex: 'title',
      key: 'title',
      render: (title) => <strong>{title || '—'}</strong>,
    },
    {
      title: '📍 موقعیت',
      dataIndex: 'position',
      key: 'position',
      width: 180,
      render: (pos) => {
        const config = BANNER_POSITIONS[pos] || { label: pos, color: 'default' }
        return (
          <Tooltip title={config.description}>
            <Tag color={config.color}>{config.label}</Tag>
          </Tooltip>
        )
      },
    },
    {
      title: '🔢 ترتیب',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
      align: 'center',
      render: (order) => (
        <Tag color="geekblue" style={{ fontWeight: 'bold' }}>
          {order ?? 0}
        </Tag>
      ),
    },
    {
      title: '🔗 لینک',
      dataIndex: 'link',
      key: 'link',
      width: 100,
      align: 'center',
      render: (link) =>
        link ? (
          <Tooltip title={link}>
            <a href={link} target="_blank" rel="noreferrer">
              <LinkOutlined style={{ fontSize: 18 }} />
            </a>
          </Tooltip>
        ) : (
          <span style={{ color: '#ccc' }}>—</span>
        ),
    },
    {
      title: '✅ وضعیت',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      align: 'center',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'error'} style={{ fontWeight: 'bold' }}>
          {isActive ? '✓ فعال' : '✗ غیرفعال'}
        </Tag>
      ),
    },
    {
      title: '📅 تاریخ',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => (
        <span style={{ fontSize: 12, color: '#666' }}>
          {formatPersianDate(date, false)}
        </span>
      ),
    },
    {
      title: '⚙️ عملیات',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title="ویرایش">
            <Button
              type="primary"
              ghost
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="حذف بنر"
            description="آیا از حذف این بنر مطمئن هستید؟"
            onConfirm={() => handleDelete(record._id)}
            okText="حذف"
            cancelText="انصراف"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="حذف">
              <Button danger icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ============================================
  // عملیات‌ها
  // ============================================
  const handleTableChange = (pag) => {
    setPagination((prev) => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))
    fetchBanners(pag.current, pag.pageSize)
  }

  const handleNew = () => {
    setEditing(null)
    form.resetFields()
    setFileList([])
    setPreviewImage(null)
    setSelectedPosition('main-slider')
    form.setFieldsValue({
      position: 'main-slider',
      isActive: true,
      sortOrder: 0,
    })
    setModalOpen(true)
  }

  const handleEdit = (banner) => {
    setEditing(banner)
    setFileList([])
    setPreviewImage(banner.image?.url || null)
    setSelectedPosition(banner.position || 'main-slider')
    form.setFieldsValue({
      title: banner.title,
      link: banner.link,
      position: banner.position,
      isActive: banner.isActive,
      sortOrder: banner.sortOrder ?? 0,
      imageUrl: banner.image?.url,
    })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/banners/${id}`)
      message.success('بنر با موفقیت حذف شد')
      fetchBanners()
    } catch (err) {
      message.error(err?.response?.data?.message || 'خطا در حذف بنر')
    }
  }

  const uploadBannerImage = async (file) => {
    const formData = new FormData()
    formData.append('image', file)

    const res = await api.post('/uploads/banner', formData, {
      timeout: 180000, // 3 minutes for slow Cloudinary uploads
    })

    return res?.data?.data
  }

  const handleSave = async () => {
    let uploadedImage = null

    try {
      const values = await form.validateFields()
      setSaving(true)

      const hasNewImageFile = fileList.length > 0 && fileList[0].originFileObj

      if (hasNewImageFile) {
        uploadedImage = await uploadBannerImage(fileList[0].originFileObj)
      }

      const payload = {
        title: values.title,
        link: values.link || '',
        position: values.position,
        isActive: values.isActive !== undefined ? values.isActive : true,
        sortOrder: values.sortOrder ?? 0,
      }

      if (uploadedImage) {
        payload.image = uploadedImage
      } else if (values.imageUrl) {
        payload.image = { url: values.imageUrl }
      }

      if (editing) {
        await api.put(`/banners/${editing._id}`, payload)
        message.success('بنر با موفقیت ویرایش شد')
      } else {
        await api.post('/banners', payload)
        message.success('بنر جدید با موفقیت ایجاد شد')
      }

      setModalOpen(false)
      setEditing(null)
      fetchBanners()
    } catch (err) {
      if (!err?.errorFields) {
        if (uploadedImage?.public_id) {
          const encodedPublicId = encodeURIComponent(uploadedImage.public_id)
          api.delete(`/uploads/image/${encodedPublicId}`).catch(() => { })
        }

        if (err?.code === 'ECONNABORTED') {
          message.error('زمان آپلود تصویر به پایان رسید. حجم تصویر را کمتر کنید یا اتصال سرور را بررسی کنید.')
        } else {
          message.error(err?.response?.data?.message || 'خطا در ذخیره بنر')
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const handleUploadChange = ({ fileList: newFileList }) => {
    setFileList(newFileList)
    // نمایش پیش‌نمایش
    if (newFileList.length > 0 && newFileList[0].originFileObj) {
      const reader = new FileReader()
      reader.onload = () => setPreviewImage(reader.result)
      reader.readAsDataURL(newFileList[0].originFileObj)
    }
  }

  const beforeUploadBanner = (file) => {
    if (!file?.type?.startsWith('image/')) {
      message.error('فقط فایل تصویری مجاز است')
      return Upload.LIST_IGNORE
    }

    if (file.size > MAX_BANNER_UPLOAD_SIZE_BYTES) {
      message.error(`حداکثر حجم فایل ${MAX_BANNER_UPLOAD_SIZE_MB} مگابایت است`)
      return Upload.LIST_IGNORE
    }

    return false
  }

  // ============================================
  // UI اصلی
  // ============================================
  return (
    <div>
      {/* ============================================ */}
      {/* هدر صفحه */}
      {/* ============================================ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🖼️ مدیریت بنرها</h1>
          <p style={{ margin: '4px 0 0', color: '#666' }}>
            بنرهای تبلیغاتی صفحه اصلی فروشگاه را از اینجا مدیریت کنید
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchBanners()}>
            بروزرسانی
          </Button>
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={handleNew}>
            افزودن بنر جدید
          </Button>
        </Space>
      </div>

      {/* ============================================ */}
      {/* راهنمای کامل ابعاد بنرها */}
      {/* ============================================ */}
      <Card
        size="small"
        style={{ marginBottom: 16, background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 100%)', border: '1px solid #91caff' }}
        title={
          <Space>
            <PictureOutlined style={{ color: '#1677ff' }} />
            <span style={{ fontWeight: 'bold', fontSize: 14 }}>📐 راهنمای ابعاد بنرها</span>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          {Object.entries(BANNER_POSITIONS).map(([key, config]) => (
            <Col xs={24} md={8} key={key}>
              <div
                style={{
                  background: '#fff',
                  borderRadius: 8,
                  padding: 12,
                  border: `2px solid`,
                  borderColor: config.color === 'blue' ? '#1677ff' : config.color === 'orange' ? '#fa8c16' : '#722ed1',
                  height: '100%',
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <Tag color={config.color} style={{ fontSize: 13, padding: '2px 8px' }}>
                    {config.label}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  {config.description}
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888', fontSize: 11 }}>🎯 سایز ایده‌آل:</span>
                    <strong style={{ fontSize: 12, color: '#1677ff' }}>{config.size}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888', fontSize: 11 }}>📏 نسبت تصویر:</span>
                    <span style={{ fontSize: 12 }}>{config.aspectRatio}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888', fontSize: 11 }}>📉 حداقل سایز:</span>
                    <span style={{ fontSize: 12, color: '#fa541c' }}>{config.minSize}</span>
                  </div>
                </div>
                <div style={{ marginTop: 8, padding: '6px 8px', background: '#fffbe6', borderRadius: 4, fontSize: 11, color: '#ad6800' }}>
                  💡 {config.mobileTip}
                </div>
              </div>
            </Col>
          ))}
        </Row>
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          message="نکات مهم برای آپلود بنر"
          description={
            <ul style={{ margin: 0, paddingRight: 20, fontSize: 12 }}>
              <li><strong>فرمت‌های مجاز:</strong> JPG, PNG, WEBP (ترجیحاً WEBP برای سرعت بارگذاری)</li>
              <li><strong>حداکثر حجم فنی:</strong> 10 مگابایت (پیشنهادی: زیر 2 مگابایت)</li>
              <li><strong>محتوای مهم:</strong> متن و لوگو را در 60% مرکزی تصویر قرار دهید تا در موبایل بریده نشود</li>
              <li><strong>کیفیت:</strong> تصویر با کیفیت بالا (DPI بالا) استفاده نکنید - باعث کندی سایت می‌شود</li>
            </ul>
          }
        />
      </Card>

      {/* ============================================ */}
      {/* فیلتر و جدول */}
      {/* ============================================ */}
      <Card
        title={
          <Space>
            <span>📋 لیست بنرها</span>
            <Tag color="blue">{pagination.total} بنر</Tag>
          </Space>
        }
        extra={
          <Select
            placeholder="فیلتر بر اساس موقعیت"
            allowClear
            style={{ width: 220 }}
            value={positionFilter}
            onChange={setPositionFilter}
          >
            {Object.entries(BANNER_POSITIONS).map(([key, config]) => (
              <Select.Option key={key} value={key}>
                {config.label}
              </Select.Option>
            ))}
          </Select>
        }
      >
        <Table
          columns={columns}
          dataSource={banners}
          loading={loading}
          rowKey="_id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `مجموع: ${total} بنر`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="هیچ بنری یافت نشد"
              />
            ),
          }}
        />
      </Card>

      {/* ============================================ */}
      {/* مودال ایجاد/ویرایش */}
      {/* ============================================ */}
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={editing ? '💾 ذخیره تغییرات' : '✅ ایجاد بنر'}
        cancelText="انصراف"
        confirmLoading={saving}
        title={
          <span style={{ fontSize: 18 }}>
            {editing ? '✏️ ویرایش بنر' : '➕ افزودن بنر جدید'}
          </span>
        }
        width={800}
        centered
      >
        <Divider style={{ margin: '12px 0' }} />

        <Form layout="vertical" form={form} requiredMark="optional">
          <Row gutter={16}>
            {/* ستون چپ - اطلاعات */}
            <Col span={14}>
              <Form.Item
                name="title"
                label="📝 عنوان بنر"
                rules={[{ required: true, message: 'لطفاً عنوان را وارد کنید' }]}
                tooltip="عنوان داخلی برای شناسایی بنر"
              >
                <Input placeholder="مثال: بنر تخفیف نوروزی" size="large" />
              </Form.Item>

              <Form.Item
                name="link"
                label="🔗 لینک (اختیاری)"
                tooltip="آدرسی که کاربر با کلیک روی بنر به آن منتقل می‌شود"
              >
                <Input placeholder="https://example.com/products" size="large" dir="ltr" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="position"
                    label="📍 موقعیت نمایش"
                    rules={[{ required: true, message: 'موقعیت را انتخاب کنید' }]}
                  >
                    <Select
                      size="large"
                      onChange={(val) => setSelectedPosition(val)}
                    >
                      {Object.entries(BANNER_POSITIONS).map(([key, config]) => (
                        <Select.Option key={key} value={key}>
                          <div>
                            <div>{config.label}</div>
                            <div style={{ fontSize: 11, color: '#999' }}>
                              {config.size} • {config.aspectRatio}
                            </div>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="sortOrder"
                    label="🔢 ترتیب نمایش"
                    tooltip="عدد کمتر = نمایش زودتر"
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      size="large"
                      style={{ width: '100%' }}
                      placeholder="0"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="isActive"
                label="✅ وضعیت فعال"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="فعال"
                  unCheckedChildren="غیرفعال"
                  defaultChecked
                />
              </Form.Item>
            </Col>

            {/* ستون راست - تصویر */}
            <Col span={10}>
              {/* باکس اطلاعات ابعاد */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
                  border: '1px solid #91d5ff',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#0050b3' }}>
                  📐 ابعاد توصیه شده برای موقعیت انتخابی:
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>سایز ایده‌آل:</span>
                    <strong style={{ color: '#1677ff' }}>
                      {BANNER_POSITIONS[selectedPosition]?.size}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>نسبت تصویر:</span>
                    <span>{BANNER_POSITIONS[selectedPosition]?.aspectRatio}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>حداقل سایز:</span>
                    <span style={{ color: '#fa541c' }}>
                      {BANNER_POSITIONS[selectedPosition]?.minSize}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    padding: '6px 8px',
                    background: '#fffbe6',
                    borderRadius: 4,
                    fontSize: 11,
                    color: '#ad6800'
                  }}
                >
                  💡 {BANNER_POSITIONS[selectedPosition]?.mobileTip}
                </div>
              </div>

              <Form.Item label="📷 تصویر بنر">
                {/* پیش‌نمایش */}
                {previewImage && (
                  <div
                    style={{
                      marginBottom: 12,
                      border: '1px solid #e8e8e8',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <Image
                      src={previewImage}
                      alt="preview"
                      style={{ width: '100%', maxHeight: 150, objectFit: 'cover' }}
                    />
                  </div>
                )}

                <Upload.Dragger
                  beforeUpload={beforeUploadBanner}
                  fileList={fileList}
                  onChange={handleUploadChange}
                  maxCount={1}
                  accept="image/*"
                  style={{ borderRadius: 8 }}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                  </p>
                  <p className="ant-upload-text">
                    تصویر را اینجا رها کنید یا کلیک کنید
                  </p>
                  <p className="ant-upload-hint" style={{ fontSize: 11 }}>
                    فرمت‌های مجاز: JPG, PNG, WEBP (ترجیحاً WEBP)
                  </p>
                  <p className="ant-upload-hint" style={{ fontSize: 10, color: '#888' }}>
                    حداکثر حجم فنی: 10 مگابایت (پیشنهادی: زیر 2 مگابایت)
                  </p>
                </Upload.Dragger>
              </Form.Item>

              <Form.Item
                name="imageUrl"
                label="🌐 یا آدرس تصویر"
                tooltip="اگر تصویر آپلود نکردید، آدرس را وارد کنید"
              >
                <Input placeholder="https://..." size="large" dir="ltr" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default BannersPage
