import PageHeader from '../../components/ui/PageHeader'
import { useState, useEffect, useCallback } from 'react'
import {
  Card, Button, Modal, Form, Input, InputNumber, Switch, Space,
  Tag, Tooltip, message, Popconfirm, Alert, Slider, Typography, Badge, Divider
} from 'antd'
import ResponsiveTable from '../../components/ResponsiveTable'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined,
  ApiOutlined, StarOutlined, StarFilled, ExperimentOutlined,
  ReloadOutlined, ArrowRightOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import api from '../../api'

const { Text } = Typography

export default function AiProvidersPage() {
  const [providers, setProviders] = useState([])
  const [runtimeHealth, setRuntimeHealth] = useState({})
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState(null)
  const [testingId, setTestingId] = useState(null)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const fetchProviders = useCallback(async () => {
    setLoading(true)
    try {
      const [providersResponse, healthResponse] = await Promise.all([
        api.get('/ai-providers'),
        api.get('/ai-providers/health/runtime').catch(() => ({ data: { data: [] } })),
      ])
      setProviders(providersResponse.data.data || [])
      setRuntimeHealth(Object.fromEntries((healthResponse.data.data || []).map((item) => [item.id, item])))
    } catch (err) {
      message.error('خطا در دریافت لیست ارائه‌دهندگان')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProviders() }, [fetchProviders])

  const openCreateModal = () => {
    setEditingProvider(null)
    form.resetFields()
    form.setFieldsValue({ isActive: true, isDefault: false, priority: 100, maxTokens: 500, temperature: 0.7 })
    setModalOpen(true)
  }

  const openEditModal = (record) => {
    setEditingProvider(record)
    form.setFieldsValue({
      ...record,
      apiKey: '****',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      if (editingProvider) {
        await api.put(`/ai-providers/${editingProvider._id}`, values)
        message.success('ارائه‌دهنده به‌روزرسانی شد')
      } else {
        await api.post('/ai-providers', values)
        message.success('ارائه‌دهنده ایجاد شد')
      }
      setModalOpen(false)
      fetchProviders()
    } catch (err) {
      if (err.response?.data?.message) {
        message.error(err.response.data.message)
      }
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/ai-providers/${id}`)
      message.success('ارائه‌دهنده حذف شد')
      fetchProviders()
    } catch (err) {
      message.error(err.response?.data?.message || 'خطا در حذف')
    }
  }

  const handleSetDefault = async (id) => {
    try {
      await api.post(`/ai-providers/${id}/set-default`)
      message.success('ارائه‌دهنده پیش‌فرض تنظیم شد')
      fetchProviders()
    } catch (err) {
      message.error(err.response?.data?.message || 'خطا')
    }
  }

  const handleTest = async (id) => {
    setTestingId(id)
    try {
      const { data } = await api.post(`/ai-providers/${id}/test`)
      message.success(data.message || 'اتصال موفق')
      fetchProviders()
    } catch (err) {
      message.error(err.response?.data?.message || 'تست ناموفق')
      fetchProviders()
    } finally {
      setTestingId(null)
    }
  }

  const columns = [
    {
      title: 'نام',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {record.isDefault && <StarFilled style={{ color: '#8a6200' }} />}
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'مدل',
      dataIndex: 'model',
      key: 'model',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'آدرس پایه',
      dataIndex: 'baseUrl',
      key: 'baseUrl',
      ellipsis: true,
      render: (text) => <Text copyable={{ text }} style={{ fontSize: 12 }}>{text}</Text>,
    },
    {
      title: 'اولویت',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (value, record) => record.isDefault ? <Tag color="gold">اصلی</Tag> : <Tag>{value || 100}</Tag>,
    },
    {
      title: 'وضعیت',
      mobileBadge: true,
      key: 'status',
      width: 100,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Tag color={record.isActive ? 'green' : 'red'}>
            {record.isActive ? 'فعال' : 'غیرفعال'}
          </Tag>
          {record.isDefault && <Tag color="gold">پیش‌فرض</Tag>}
          {runtimeHealth[record._id]?.openUntil > Date.now() && <Tag color="orange">موقتاً در انتظار</Tag>}
        </Space>
      ),
    },
    {
      title: 'آخرین تست',
      key: 'lastTest',
      width: 120,
      render: (_, record) => {
        if (!record.lastTestedAt) return <Text type="secondary">تست نشده</Text>
        return (
          <Badge
            status={record.lastTestResult === 'success' ? 'success' : 'error'}
            text={record.lastTestResult === 'success' ? 'موفق' : 'ناموفق'}
          />
        )
      },
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="تست اتصال">
            <Button
              size="small"
              icon={<ExperimentOutlined />}
              loading={testingId === record._id}
              onClick={() => handleTest(record._id)}
            />
          </Tooltip>
          {!record.isDefault && (
            <Tooltip title="تنظیم به عنوان پیش‌فرض">
              <Button
                size="small"
                icon={<StarOutlined />}
                onClick={() => handleSetDefault(record._id)}
              />
            </Tooltip>
          )}
          <Tooltip title="ویرایش">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          {!record.isDefault && (
            <Popconfirm
              title="آیا از حذف مطمئن هستید؟"
              onConfirm={() => handleDelete(record._id)}
              okText="بله"
              cancelText="خیر"
            >
              <Tooltip title="حذف">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="مدیریت ارائه‌دهندگان هوش مصنوعی"
        subtitle="سرویس‌هایی که پاسخ‌گوی چت فروشگاه را تولید می‌کنند"
        actions={
          <>
            <Button icon={<ArrowRightOutlined />} onClick={() => navigate('/settings')}>
              بازگشت به تنظیمات
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchProviders} loading={loading}>
              بارگذاری مجدد
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              افزودن ارائه‌دهنده
            </Button>
          </>
        }
      />
      <Card>
        <Alert
          message="مدیریت ارائه‌دهندگان API هوش مصنوعی"
          description="ارائه‌دهنده پیش‌فرض ابتدا استفاده می‌شود و ارائه‌دهندگان فعال دیگر، بر اساس اولویت، فقط در خطاهای موقت پیش از شروع پاسخ جایگزین می‌شوند. وضعیت «موقتاً در انتظار» پس از چند خطای متوالی خودکار و گذرا است."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <ResponsiveTable
          columns={columns}
          dataSource={providers}
          rowKey="_id"
          scroll={{ x: 'max-content' }}
          loading={loading}
          pagination={false}
          locale={{ emptyText: 'هیچ ارائه‌دهنده‌ای ثبت نشده. اولین ارائه‌دهنده را اضافه کنید.' }}
        />
      </Card>

      <Modal
        title={editingProvider ? 'ویرایش ارائه‌دهنده' : 'افزودن ارائه‌دهنده جدید'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText={editingProvider ? 'به‌روزرسانی' : 'ایجاد'}
        cancelText="انصراف"
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="نام ارائه‌دهنده" rules={[{ required: true, message: 'نام الزامی است' }]}>
            <Input placeholder="مثلاً: Groq، OpenRouter، Together AI" />
          </Form.Item>

          <Form.Item name="baseUrl" label="آدرس پایه API" rules={[{ required: true, message: 'آدرس پایه الزامی است' }]}>
            <Input placeholder="https://api.groq.com/openai/v1" dir="ltr" />
          </Form.Item>

          <Form.Item name="apiKey" label="کلید API" rules={[{ required: !editingProvider, message: 'کلید API الزامی است' }]}>
            <Input.Password placeholder="sk-... یا gsk_..." dir="ltr" />
          </Form.Item>

          <Form.Item name="model" label="شناسه مدل" rules={[{ required: true, message: 'شناسه مدل الزامی است' }]}>
            <Input placeholder="openai/gpt-oss-120b" dir="ltr" />
          </Form.Item>

          <Form.Item name="description" label="توضیحات">
            <Input.TextArea rows={2} placeholder="توضیح اختیاری..." />
          </Form.Item>

          <Divider>تنظیمات پیشرفته</Divider>

          <Form.Item name="maxTokens" label="حداکثر توکن خروجی">
            <Slider min={100} max={16000} step={100} marks={{ 100: '100', 500: '500', 2000: '2K', 8000: '8K', 16000: '16K' }} />
          </Form.Item>

          <Form.Item name="temperature" label="دمای مدل (Temperature)">
            <Slider min={0} max={2} step={0.1} marks={{ 0: 'دقیق', 0.7: 'متعادل', 2: 'خلاق' }} />
          </Form.Item>

          <Form.Item
            name="priority"
            label="اولویت جایگزینی"
            extra="عدد کوچک‌تر زودتر استفاده می‌شود؛ ارائه‌دهنده پیش‌فرض همیشه اول است."
          >
            <InputNumber min={1} max={10000} style={{ width: '100%' }} />
          </Form.Item>

          <Space size="large">
            <Form.Item name="isActive" label="فعال" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="isDefault" label="پیش‌فرض" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
