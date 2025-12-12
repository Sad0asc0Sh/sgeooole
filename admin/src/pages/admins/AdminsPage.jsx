import { useEffect, useState } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Space,
  Popconfirm,
  message,
  Row,
  Col,
  Divider,
  Alert,
  Collapse,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import api from '../../api'

const { Option } = Select
const { Panel } = Collapse
const { Text, Title } = Typography

// ============================================
// تعریف نقش‌ها و سطوح دسترسی
// ============================================
const ROLES_INFO = [
  {
    key: 'superadmin',
    name: 'سوپرادمین',
    color: 'red',
    level: 6,
    icon: '👑',
    description: 'دسترسی کامل به تمام بخش‌ها بدون محدودیت',
    permissions: [
      'مدیریت کامل سیستم',
      'ایجاد و حذف ادمین‌ها',
      'تغییر نقش کاربران',
      'مشاهده گزارش‌های امنیتی',
      'تنظیمات اصلی سیستم',
    ],
  },
  {
    key: 'manager',
    name: 'مدیر ارشد',
    color: 'purple',
    level: 5,
    icon: '🏆',
    description: 'دسترسی به تمام بخش‌های عملیاتی و گزارشات',
    permissions: [
      'مدیریت محصولات و دسته‌بندی‌ها',
      'مدیریت سفارشات و کوپن‌ها',
      'مشاهده گزارش‌های مالی',
      'تنظیمات فروشگاه',
      'تغییر نقش کاربران سطح پایین‌تر',
    ],
  },
  {
    key: 'admin',
    name: 'ادمین',
    color: 'blue',
    level: 4,
    icon: '⚡',
    description: 'دسترسی عملیاتی کامل بدون تنظیمات حساس',
    permissions: [
      'مدیریت محصولات و موجودی',
      'پردازش سفارشات',
      'مدیریت دسته‌بندی‌ها و برندها',
      'مدیریت بنرها و محتوا',
      'مشاهده گزارش‌های عملیاتی',
    ],
  },
  {
    key: 'editor',
    name: 'ویرایشگر محتوا',
    color: 'geekblue',
    level: 3,
    icon: '✏️',
    description: 'ویرایش محصولات، بلاگ و محتوای سایت',
    permissions: [
      'ویرایش محصولات',
      'مدیریت بلاگ و مقالات',
      'آپلود تصاویر',
      'مدیریت صفحات استاتیک',
    ],
  },
  {
    key: 'support',
    name: 'پشتیبان',
    color: 'cyan',
    level: 2,
    icon: '🎧',
    description: 'پاسخگویی به مشتریان و پیگیری سفارشات',
    permissions: [
      'مشاهده سفارشات',
      'پاسخ به تیکت‌ها',
      'مشاهده اطلاعات مشتریان',
      'بروزرسانی وضعیت سفارش',
    ],
  },
]

function AdminsPage() {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [form] = Form.useForm()

  const fetchAdmins = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/management')
      const data = res?.data?.data || []
      setAdmins(Array.isArray(data) ? data : [])
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'خطا در دریافت لیست ادمین‌ها'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdmins()
  }, [])

  const openCreateModal = () => {
    setEditingAdmin(null)
    form.resetFields()
    form.setFieldsValue({
      role: 'admin',
      isActive: true,
    })
    setModalOpen(true)
  }

  const openEditModal = (admin) => {
    setEditingAdmin(admin)
    form.resetFields()
    form.setFieldsValue({
      name: admin.name,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      const payload = {
        name: values.name,
        email: values.email,
        role: values.role,
        isActive: values.isActive,
      }

      // رمز عبور فقط برای ایجاد
      if (!editingAdmin) {
        payload.password = values.password
      }

      setSaving(true)

      if (editingAdmin) {
        await api.put(`/admin/management/${editingAdmin._id}`, payload)
        message.success('اطلاعات ادمین با موفقیت به‌روزرسانی شد.')
      } else {
        await api.post('/admin/management', payload)
        message.success('ادمین جدید با موفقیت ایجاد شد.')
      }

      setModalOpen(false)
      setEditingAdmin(null)
      form.resetFields()
      fetchAdmins()
    } catch (err) {
      if (err?.errorFields) {
        return
      }

      const msg =
        err?.response?.data?.message ||
        err?.message ||
        (editingAdmin
          ? 'خطا در به‌روزرسانی اطلاعات ادمین'
          : 'خطا در ایجاد ادمین جدید')
      message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (admin) => {
    try {
      await api.delete(`/admin/management/${admin._id}`)
      message.success('ادمین با موفقیت حذف شد.')
      fetchAdmins()
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'خطا در حذف ادمین'
      message.error(msg)
    }
  }

  const renderRoleTag = (role) => {
    const config = {
      superadmin: { color: 'red', label: 'سوپرادمین' },
      manager: { color: 'purple', label: 'مدیر ارشد' },
      admin: { color: 'blue', label: 'ادمین' },
      editor: { color: 'geekblue', label: 'ویرایشگر محتوا' },
      support: { color: 'cyan', label: 'پشتیبان' },
    }
    const c = config[role] || { color: 'default', label: role }
    return <Tag color={c.color}>{c.label}</Tag>
  }

  const columns = [
    { title: 'نام', dataIndex: 'name', key: 'name' },
    { title: 'ایمیل', dataIndex: 'email', key: 'email' },
    {
      title: 'نقش',
      dataIndex: 'role',
      key: 'role',
      render: renderRoleTag,
    },
    {
      title: 'وضعیت',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v) => (
        <Tag color={v ? 'green' : 'red'}>
          {v ? 'فعال' : 'غیرفعال'}
        </Tag>
      ),
    },
    {
      title: 'عملیات',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            ویرایش
          </Button>
          <Popconfirm
            title="حذف ادمین"
            description="آیا از حذف این ادمین مطمئن هستید؟"
            okText="حذف"
            cancelText="انصراف"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
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
      {/* ============================================ */}
      {/* هدر صفحه */}
      {/* ============================================ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h1>🔐 مدیریت ادمین‌ها</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
        >
          ایجاد ادمین جدید
        </Button>
      </div>

      {/* ============================================ */}
      {/* راهنمای نقش‌ها و سطوح دسترسی */}
      {/* ============================================ */}
      <Collapse
        ghost
        style={{ marginBottom: 16, background: '#fafafa', borderRadius: 8 }}
        defaultActiveKey={[]}
      >
        <Panel
          header={
            <Space>
              <SafetyCertificateOutlined style={{ color: '#1890ff' }} />
              <Text strong>🔐 راهنمای نقش‌ها و سطوح دسترسی (کلیک کنید)</Text>
            </Space>
          }
          key="1"
        >
          <Alert
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            message="هنگام انتخاب نقش برای ادمین جدید، به دسترسی‌های هر نقش توجه کنید"
            style={{ marginBottom: 16 }}
          />

          <Row gutter={[16, 16]}>
            {ROLES_INFO.map((role) => (
              <Col xs={24} sm={12} lg={8} key={role.key}>
                <Card
                  size="small"
                  style={{
                    border: `2px solid`,
                    borderColor: role.color === 'red' ? '#ff4d4f' :
                      role.color === 'purple' ? '#722ed1' :
                        role.color === 'blue' ? '#1890ff' :
                          role.color === 'geekblue' ? '#2f54eb' :
                            '#13c2c2',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <Tag color={role.color} style={{ fontSize: 14, padding: '2px 8px' }}>
                      {role.icon} {role.name}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
                      سطح {role.level}
                    </Text>
                  </div>

                  <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                    {role.description}
                  </Text>

                  <Divider style={{ margin: '8px 0' }} />

                  <div>
                    <Text strong style={{ fontSize: 12 }}>دسترسی‌ها:</Text>
                    <ul style={{ margin: '4px 0 0 0', paddingRight: 16, fontSize: 11 }}>
                      {role.permissions.map((perm, idx) => (
                        <li key={idx} style={{ color: '#666', marginBottom: 2 }}>
                          {perm}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          <Divider style={{ margin: '16px 0 8px' }} />

          <Alert
            type="warning"
            showIcon
            message="قوانین تغییر نقش"
            description={
              <ul style={{ margin: 0, paddingRight: 16, fontSize: 13 }}>
                <li>هر مدیر فقط می‌تواند نقش‌هایی با سطح پایین‌تر از خود اختصاص دهد</li>
                <li>مثال: مدیر ارشد (سطح 5) می‌تواند admin، editor و support را تنظیم کند</li>
                <li>سوپرادمین می‌تواند تمام نقش‌ها را تغییر دهد</li>
                <li>نقش superadmin فقط توسط superadmin دیگر قابل اختصاص است</li>
              </ul>
            }
            style={{ marginBottom: 0 }}
          />
        </Panel>
      </Collapse>

      {/* ============================================ */}
      {/* جدول ادمین‌ها */}
      {/* ============================================ */}
      <Card title="📋 لیست ادمین‌ها">
        <Table
          columns={columns}
          dataSource={admins}
          loading={loading}
          rowKey="_id"
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `مجموع: ${total} ادمین`,
          }}
        />
      </Card>

      {/* ============================================ */}
      {/* مودال ایجاد/ویرایش */}
      {/* ============================================ */}
      <Modal
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditingAdmin(null)
          form.resetFields()
        }}
        onOk={handleSubmit}
        confirmLoading={saving}
        title={editingAdmin ? '✏️ ویرایش ادمین' : '➕ ایجاد ادمین جدید'}
        okText="ذخیره"
        cancelText="انصراف"
        width={500}
      >
        <Divider style={{ margin: '12px 0' }} />

        <Form layout="vertical" form={form}>
          <Form.Item
            name="name"
            label="نام"
            rules={[{ required: true, message: 'لطفاً نام را وارد کنید.' }]}
          >
            <Input placeholder="مثلاً: مدیر سیستم" size="large" />
          </Form.Item>

          <Form.Item
            name="email"
            label="ایمیل"
            rules={[
              { required: true, message: 'لطفاً ایمیل را وارد کنید.' },
              { type: 'email', message: 'ایمیل وارد شده معتبر نیست.' },
            ]}
          >
            <Input placeholder="admin@example.com" size="large" dir="ltr" />
          </Form.Item>

          {!editingAdmin && (
            <Form.Item
              name="password"
              label="رمز عبور"
              rules={[
                { required: true, message: 'لطفاً رمز عبور را وارد کنید.' },
                {
                  min: 6,
                  message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.',
                },
              ]}
            >
              <Input.Password placeholder="******" size="large" />
            </Form.Item>
          )}

          <Form.Item
            name="role"
            label="نقش"
            rules={[{ required: true, message: 'لطفاً نقش را انتخاب کنید.' }]}
            tooltip="نقش تعیین‌کننده سطح دسترسی ادمین است"
          >
            <Select placeholder="انتخاب نقش" size="large">
              {ROLES_INFO.filter(r => r.key !== 'superadmin').map((role) => (
                <Option key={role.key} value={role.key}>
                  <Space>
                    <span>{role.icon}</span>
                    <span>{role.name}</span>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      - {role.description}
                    </Text>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="isActive"
            label="وضعیت"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="فعال"
              unCheckedChildren="غیرفعال"
              style={{ width: 80 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminsPage
