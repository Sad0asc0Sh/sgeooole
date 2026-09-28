import PageHeader from '../../components/ui/PageHeader'
import { useState, useEffect } from 'react'
import {
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  message,
  Popconfirm,
  Card,
} from 'antd'
import ResponsiveTable from '../../components/ResponsiveTable'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SoundOutlined,
} from '@ant-design/icons'
import api from '../../api'

const { Option } = Select

function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form] = Form.useForm()

  // دریافت لیست اعلانات
  const fetchAnnouncements = async () => {
    setLoading(true)
    try {
      const res = await api.get('/announcements/admin')
      if (res.data.success) {
        setAnnouncements(res.data.data)
      }
    } catch (error) {
      const errorMsg =
        error?.response?.data?.message || 'خطا در دریافت لیست اعلانات'
      message.error(errorMsg)
      console.error('Fetch announcements error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  // باز کردن modal برای ایجاد
  const handleCreate = () => {
    setEditingId(null)
    form.resetFields()
    setModalVisible(true)
  }

  // باز کردن modal برای ویرایش
  const handleEdit = (record) => {
    setEditingId(record._id)
    form.setFieldsValue({
      message: record.message,
      link: record.link || '',
      type: record.type,
      isActive: record.isActive,
    })
    setModalVisible(true)
  }

  // ذخیره (ایجاد یا ویرایش)
  const handleSubmit = async (values) => {
    setLoading(true)
    try {
      if (editingId) {
        // ویرایش
        const res = await api.put(`/announcements/admin/${editingId}`, values)
        if (res.data.success) {
          message.success('اعلان با موفقیت به‌روزرسانی شد')
          fetchAnnouncements()
          setModalVisible(false)
        }
      } else {
        // ایجاد
        const res = await api.post('/announcements/admin', values)
        if (res.data.success) {
          message.success('اعلان با موفقیت ایجاد شد')
          fetchAnnouncements()
          setModalVisible(false)
        }
      }
    } catch (error) {
      const errorMsg =
        error?.response?.data?.message || 'خطا در ذخیره اعلان'
      message.error(errorMsg)
      console.error('Save announcement error:', error)
    } finally {
      setLoading(false)
    }
  }

  // حذف
  const handleDelete = async (id) => {
    setLoading(true)
    try {
      const res = await api.delete(`/announcements/admin/${id}`)
      if (res.data.success) {
        message.success('اعلان با موفقیت حذف شد')
        fetchAnnouncements()
      }
    } catch (error) {
      const errorMsg = error?.response?.data?.message || 'خطا در حذف اعلان'
      message.error(errorMsg)
      console.error('Delete announcement error:', error)
    } finally {
      setLoading(false)
    }
  }

  // فعال‌سازی (toggle isActive)
  const handleToggleActive = async (record) => {
    setLoading(true)
    try {
      const res = await api.put(`/announcements/admin/${record._id}`, {
        isActive: !record.isActive,
      })
      if (res.data.success) {
        message.success(
          record.isActive
            ? 'اعلان غیرفعال شد'
            : 'اعلان فعال شد (سایر اعلانات غیرفعال شدند)',
        )
        fetchAnnouncements()
      }
    } catch (error) {
      const errorMsg =
        error?.response?.data?.message || 'خطا در تغییر وضعیت اعلان'
      message.error(errorMsg)
      console.error('Toggle active error:', error)
    } finally {
      setLoading(false)
    }
  }

  // ستون‌های جدول
  const columns = [
    {
      title: 'پیام',
      dataIndex: 'message',
      key: 'message',
      render: (text) => (
        <span style={{ fontWeight: 500, maxWidth: 400, display: 'block' }}>
          {text}
        </span>
      ),
    },
    {
      title: 'لینک',
      dataIndex: 'link',
      key: 'link',
      render: (text) =>
        text ? (
          <a href={text} target="_blank" rel="noopener noreferrer">
            {text.length > 30 ? text.substring(0, 30) + '...' : text}
          </a>
        ) : (
          <span style={{ color: '#999' }}>—</span>
        ),
    },
    {
      title: 'نوع',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => {
        const typeConfig = {
          info: { color: 'blue', text: 'اطلاع‌رسانی' },
          warning: { color: 'orange', text: 'هشدار' },
          promo: { color: 'green', text: 'تبلیغاتی' },
        }
        const config = typeConfig[type] || typeConfig.info
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: 'وضعیت',
      mobileBadge: true,
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (isActive, record) => (
        <Space>
          <Tag color={isActive ? 'success' : 'default'}>
            {isActive ? 'فعال' : 'غیرفعال'}
          </Tag>
          <Button
            type="link"
            size="small"
            onClick={() => handleToggleActive(record)}
            disabled={loading}
          >
            {isActive ? 'غیرفعال کن' : 'فعال کن'}
          </Button>
        </Space>
      ),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={loading}
          >
            ویرایش
          </Button>
          <Popconfirm
            title="آیا از حذف این اعلان اطمینان دارید؟"
            onConfirm={() => handleDelete(record._id)}
            okText="بله"
            cancelText="خیر"
            disabled={loading}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              disabled={loading}
            >
              حذف
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="مدیریت اعلانات سایت"
        subtitle="پیام‌های کوتاهی که در بالای صفحات فروشگاه نمایش داده می‌شوند"
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            disabled={loading}
          >
            افزودن اعلان جدید
          </Button>
        }
      />
      <Card>
        <ResponsiveTable
          columns={columns}
          dataSource={announcements}
          rowKey="_id"
          scroll={{ x: 'max-content' }}
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: 'هیچ اعلانی یافت نشد',
          }}
        />
      </Card>

      {/* Modal ایجاد/ویرایش */}
      <Modal
        title={editingId ? 'ویرایش اعلان' : 'افزودن اعلان جدید'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            type: 'info',
            isActive: false,
          }}
        >
          <Form.Item
            name="message"
            label="متن اعلان"
            rules={[
              {
                required: true,
                message: 'لطفاً متن اعلان را وارد کنید',
              },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="مثال: 20% تخفیف عید فطر با کد EID20"
            />
          </Form.Item>

          <Form.Item
            name="link"
            label="لینک (اختیاری)"
            rules={[
              {
                type: 'url',
                message: 'لطفاً یک آدرس معتبر وارد کنید',
              },
            ]}
          >
            <Input placeholder="https://example.com/promotion" />
          </Form.Item>

          <Form.Item name="type" label="نوع اعلان">
            <Select>
              <Option value="info">اطلاع‌رسانی (آبی)</Option>
              <Option value="warning">هشدار (نارنجی)</Option>
              <Option value="promo">تبلیغاتی (سبز)</Option>
            </Select>
          </Form.Item>

          <Form.Item name="isActive" valuePropName="checked">
            <Checkbox>
              فعال‌سازی این اعلان (سایر اعلانات به‌طور خودکار غیرفعال می‌شوند)
            </Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalVisible(false)}>انصراف</Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingId ? 'به‌روزرسانی' : 'ایجاد'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AnnouncementsPage
