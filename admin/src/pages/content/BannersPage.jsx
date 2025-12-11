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
    size: '1920×600 پیکسل',
    color: 'blue',
  },
  'middle-banner': {
    label: '📢 بنرهای تبلیغاتی',
    description: 'بنرهای میانه صفحه اصلی',
    size: '600×300 پیکسل',
    color: 'orange',
  },
  'campaign-banner': {
    label: '🎯 بنر کمپین',
    description: 'بنر ویژه کمپین و تخفیفات',
    size: '1200×400 پیکسل',
    color: 'purple',
  },
}

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

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      let image = values.imageUrl ? { url: values.imageUrl } : undefined

      if (fileList.length > 0 && fileList[0].originFileObj) {
        const b64 = await toBase64(fileList[0].originFileObj)
        image = { url: String(b64) }
      }

      // اطمینان از مقادیر صحیح
      const payload = {
        title: values.title,
        link: values.link || '',
        position: values.position,
        isActive: values.isActive !== undefined ? values.isActive : true,
        sortOrder: values.sortOrder ?? 0,
        image,
      }

      console.log('Banner payload:', payload) // برای دیباگ

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
        message.error(err?.response?.data?.message || 'خطا در ذخیره بنر')
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
      {/* راهنمای موقعیت‌ها */}
      {/* ============================================ */}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="راهنمای موقعیت بنرها"
        description={
          <Row gutter={16} style={{ marginTop: 8 }}>
            {Object.entries(BANNER_POSITIONS).map(([key, config]) => (
              <Col span={8} key={key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color={config.color}>{config.label}</Tag>
                  <span style={{ fontSize: 12, color: '#666' }}>
                    {config.description} ({config.size})
                  </span>
                </div>
              </Col>
            ))}
          </Row>
        }
      />

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
                    <Select size="large">
                      {Object.entries(BANNER_POSITIONS).map(([key, config]) => (
                        <Select.Option key={key} value={key}>
                          <div>
                            <div>{config.label}</div>
                            <div style={{ fontSize: 11, color: '#999' }}>
                              {config.size}
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
                  beforeUpload={() => false}
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
                    فرمت‌های مجاز: JPG, PNG, WEBP
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
