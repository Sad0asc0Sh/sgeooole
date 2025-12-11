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
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import api from '../../api'

const { Option } = Select

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h1>مدیریت ادمین‌ها</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
        >
          ایجاد ادمین جدید
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={admins}
          loading={loading}
          rowKey="_id"
        />
      </Card>

      <Modal
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditingAdmin(null)
          form.resetFields()
        }}
        onOk={handleSubmit}
        confirmLoading={saving}
        title={editingAdmin ? 'ویرایش ادمین' : 'ایجاد ادمین جدید'}
        okText="ذخیره"
        cancelText="انصراف"
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="name"
            label="نام"
            rules={[{ required: true, message: 'لطفاً نام را وارد کنید.' }]}
          >
            <Input placeholder="مثلاً: مدیر سیستم" />
          </Form.Item>

          <Form.Item
            name="email"
            label="ایمیل"
            rules={[
              { required: true, message: 'لطفاً ایمیل را وارد کنید.' },
              { type: 'email', message: 'ایمیل وارد شده معتبر نیست.' },
            ]}
          >
            <Input placeholder="admin@example.com" />
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
              <Input.Password placeholder="******" />
            </Form.Item>
          )}

          <Form.Item
            name="role"
            label="نقش"
            rules={[{ required: true, message: 'لطفاً نقش را انتخاب کنید.' }]}
          >
            <Select placeholder="انتخاب نقش">
              <Option value="support">پشتیبان - دسترسی به تیکت‌ها و سفارشات</Option>
              <Option value="editor">ویرایشگر محتوا - دسترسی به محصولات و بلاگ</Option>
              <Option value="admin">ادمین - دسترسی عملیاتی کامل</Option>
              <Option value="manager">مدیر ارشد - دسترسی به تنظیمات و گزارشات</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="isActive"
            label="وضعیت"
            valuePropName="checked"
          >
            <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminsPage
