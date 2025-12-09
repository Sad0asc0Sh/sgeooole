import { useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Upload,
  message,
  Space,
  Popconfirm,
  Image,
  Switch,
  InputNumber,
  ColorPicker,
  Tag,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  InboxOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { useBrandStore } from '../../stores'
import api from '../../api'

function BrandsPage() {
  // Zustand Store - Single Source of Truth
  const { brands, loading, fetchBrands } = useBrandStore((state) => ({
    brands: state.brands,
    loading: state.loading,
    fetchBrands: state.fetchBrands,
  }))

  // Local State
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingBrand, setEditingBrand] = useState(null)
  const [form] = Form.useForm()

  // Initial load
  useEffect(() => {
    if (!brands || brands.length === 0) {
      fetchBrands()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Normalize Upload event to fileList
  const normFileList = (e) => {
    if (Array.isArray(e)) return e
    return e?.fileList || []
  }

  // Convert ColorPicker value to hex string
  const colorToHex = (color) => {
    if (!color) return null
    if (typeof color === 'string') return color
    if (color.toHexString) return color.toHexString()
    return null
  }

  // Submit handler (create / update)
  const onFinish = async (values) => {
    try {
      setSubmitting(true)

      const formData = new FormData()

      formData.append('name', values.name)
      if (values.description) {
        formData.append('description', values.description)
      }

      // Homepage display settings
      formData.append('showOnHomepage', values.showOnHomepage ? 'true' : 'false')
      formData.append('displayOrder', values.displayOrder || 0)

      const textColorHex = colorToHex(values.textColor)
      if (textColorHex) {
        formData.append('textColor', textColorHex)
      }

      const hoverColorHex = colorToHex(values.hoverColor)
      if (hoverColorHex) {
        formData.append('hoverColor', hoverColorHex)
      }

      const hadLogoBefore = Boolean(editingBrand?.logo?.url)

      const pickNewFile = (files) => {
        if (!Array.isArray(files)) return null
        return files.find((f) => f.originFileObj) || null
      }

      const logoFile = pickNewFile(values.logo)
      if (logoFile) {
        formData.append('logo', logoFile.originFileObj)
      } else if (hadLogoBefore && (!values.logo || values.logo.length === 0)) {
        // Explicitly request logo removal when user cleared existing logo
        formData.append('removeLogo', 'true')
      }

      if (editingBrand && editingBrand._id) {
        await api.put(`/brands/${editingBrand._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        message.success('برند با موفقیت ویرایش شد')
      } else {
        await api.post('/brands', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        message.success('برند با موفقیت ایجاد شد')
      }

      await fetchBrands()
      setModalVisible(false)
      setEditingBrand(null)
      form.resetFields()
    } catch (error) {
      if (error?.errorFields) return
      message.error(error?.message || 'خطا در ذخیره‌سازی اطلاعات برند')
    } finally {
      setSubmitting(false)
    }
  }

  // Open Modal for Create
  const handleCreate = () => {
    setEditingBrand(null)
    form.resetFields()
    form.setFieldsValue({
      showOnHomepage: false,
      displayOrder: 0,
      textColor: '#6b7280',
      hoverColor: '#374151',
    })
    setModalVisible(true)
  }

  // Open Modal for Edit
  const handleEdit = (brand) => {
    setEditingBrand(brand)
    form.setFieldsValue({
      name: brand.name,
      description: brand.description || '',
      logo:
        brand.logo && brand.logo.url
          ? [
            {
              uid: '-1',
              name: 'logo',
              status: 'done',
              url: brand.logo.url,
            },
          ]
          : [],
      showOnHomepage: brand.showOnHomepage || false,
      displayOrder: brand.displayOrder || 0,
      textColor: brand.textColor || '#6b7280',
      hoverColor: brand.hoverColor || '#374151',
    })
    setModalVisible(true)
  }

  // Delete Brand
  const handleDelete = async (brandId) => {
    try {
      await api.delete(`/brands/${brandId}`)
      message.success('برند با موفقیت حذف شد')
      await fetchBrands()
    } catch (error) {
      message.error(error?.message || 'خطا در حذف برند')
    }
  }

  // Toggle showOnHomepage directly from table
  const handleToggleHomepage = async (brand) => {
    try {
      const formData = new FormData()
      formData.append('showOnHomepage', !brand.showOnHomepage ? 'true' : 'false')

      await api.put(`/brands/${brand._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      message.success(
        !brand.showOnHomepage
          ? `برند "${brand.name}" به صفحه اصلی اضافه شد`
          : `برند "${brand.name}" از صفحه اصلی حذف شد`
      )
      await fetchBrands()
    } catch (error) {
      message.error(error?.message || 'خطا در بروزرسانی')
    }
  }

  // Table Columns
  const columns = [
    {
      title: 'لوگو',
      dataIndex: 'logo',
      key: 'logo',
      width: 80,
      render: (logo) => {
        if (logo && logo.url) {
          return (
            <Image
              src={logo.url}
              alt="logo"
              width={50}
              height={50}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              preview={{
                mask: 'مشاهده',
              }}
            />
          )
        }
        return (
          <div
            style={{
              width: 50,
              height: 50,
              background: '#f0f0f0',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#999',
            }}
          >
            بدون لوگو
          </div>
        )
      },
    },
    {
      title: 'نام برند',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'توضیحات',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'صفحه اصلی',
      dataIndex: 'showOnHomepage',
      key: 'showOnHomepage',
      width: 120,
      align: 'center',
      filters: [
        { text: 'نمایش در صفحه اصلی', value: true },
        { text: 'عدم نمایش', value: false },
      ],
      onFilter: (value, record) => record.showOnHomepage === value,
      render: (showOnHomepage, record) => (
        <Tooltip title={showOnHomepage ? 'حذف از صفحه اصلی' : 'افزودن به صفحه اصلی'}>
          <Switch
            checked={showOnHomepage}
            onChange={() => handleToggleHomepage(record)}
            checkedChildren={<HomeOutlined />}
            unCheckedChildren={<HomeOutlined />}
            style={{
              backgroundColor: showOnHomepage ? '#52c41a' : undefined,
            }}
          />
        </Tooltip>
      ),
    },
    {
      title: 'ترتیب',
      dataIndex: 'displayOrder',
      key: 'displayOrder',
      width: 80,
      align: 'center',
      sorter: (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0),
      render: (order, record) => (
        record.showOnHomepage ? (
          <Tag color="blue">{order || 0}</Tag>
        ) : (
          <span style={{ color: '#ccc' }}>—</span>
        )
      ),
    },
    {
      title: 'رنگ‌ها',
      key: 'colors',
      width: 100,
      align: 'center',
      render: (_, record) => (
        record.showOnHomepage ? (
          <Space size={4}>
            <Tooltip title="رنگ متن">
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  backgroundColor: record.textColor || '#6b7280',
                  border: '1px solid #d9d9d9',
                }}
              />
            </Tooltip>
            <Tooltip title="رنگ هاور">
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  backgroundColor: record.hoverColor || '#374151',
                  border: '1px solid #d9d9d9',
                }}
              />
            </Tooltip>
          </Space>
        ) : (
          <span style={{ color: '#ccc' }}>—</span>
        )
      ),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            ویرایش
          </Button>
          <Popconfirm
            title="حذف این برند؟"
            onConfirm={() => handleDelete(record._id)}
            okText="حذف"
            cancelText="انصراف"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>
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
        <h1>مدیریت برندها</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          افزودن برند جدید
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={brands}
          loading={loading}
          rowKey="_id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `مجموع: ${total} برند`,
          }}
          locale={{
            emptyText: (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 0',
                  color: '#999',
                }}
              >
                <p>هنوز هیچ برندی ثبت نشده است.</p>
                <p style={{ fontSize: 12 }}>
                  روی «افزودن برند جدید» کلیک کنید تا اولین برند را ایجاد کنید.
                </p>
              </div>
            ),
          }}
        />
      </Card>

      {/* Modal: Create/Edit Brand */}
      <Modal
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingBrand(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        title={editingBrand ? 'ویرایش برند' : 'برند جدید'}
        okText={editingBrand ? 'ذخیره تغییرات' : 'ایجاد'}
        cancelText="انصراف"
        confirmLoading={submitting}
        width={650}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          {/* 1. Name */}
          <Form.Item
            name="name"
            label="نام برند"
            rules={[
              {
                required: true,
                message: 'وارد کردن نام برند الزامی است',
              },
            ]}
          >
            <Input placeholder="مثلاً: Samsung" />
          </Form.Item>

          {/* 2. Description */}
          <Form.Item name="description" label="توضیحات (اختیاری)">
            <Input.TextArea rows={3} placeholder="توضیحات کوتاه درباره برند" />
          </Form.Item>

          {/* 3. Logo */}
          <Form.Item
            name="logo"
            label="لوگوی برند (اختیاری)"
            help="یک لوگو برای نمایش در لیست محصولات انتخاب کنید."
            valuePropName="fileList"
            getValueFromEvent={normFileList}
          >
            <Upload.Dragger
              maxCount={1}
              accept="image/*"
              beforeUpload={() => false}
              listType="picture"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                لوگو را بکشید و رها کنید یا برای انتخاب کلیک کنید.
              </p>
              <p className="ant-upload-hint">
                فایل انتخاب‌شده بعد از ذخیره‌سازی، روی Cloudinary آپلود می‌شود.
              </p>
            </Upload.Dragger>
          </Form.Item>

          {/* 4. Homepage Settings */}
          <Card
            size="small"
            title={
              <Space>
                <HomeOutlined />
                <span>تنظیمات نمایش در صفحه اصلی</span>
              </Space>
            }
            style={{ marginTop: 16 }}
          >
            <Form.Item
              name="showOnHomepage"
              label="نمایش در صفحه اصلی"
              valuePropName="checked"
              style={{ marginBottom: 16 }}
            >
              <Switch
                checkedChildren="فعال"
                unCheckedChildren="غیرفعال"
              />
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prev, curr) => prev.showOnHomepage !== curr.showOnHomepage}
            >
              {({ getFieldValue }) =>
                getFieldValue('showOnHomepage') && (
                  <>
                    <Form.Item
                      name="displayOrder"
                      label="ترتیب نمایش"
                      help="برندها بر اساس این عدد از کوچک به بزرگ مرتب می‌شوند."
                      style={{ marginBottom: 16 }}
                    >
                      <InputNumber min={0} max={999} style={{ width: '100%' }} />
                    </Form.Item>

                    <Space size={16} style={{ width: '100%' }}>
                      <Form.Item
                        name="textColor"
                        label="رنگ متن"
                        style={{ marginBottom: 0 }}
                      >
                        <ColorPicker
                          showText
                          format="hex"
                        />
                      </Form.Item>

                      <Form.Item
                        name="hoverColor"
                        label="رنگ هاور"
                        style={{ marginBottom: 0 }}
                      >
                        <ColorPicker
                          showText
                          format="hex"
                        />
                      </Form.Item>
                    </Space>
                  </>
                )
              }
            </Form.Item>
          </Card>
        </Form>
      </Modal>
    </div>
  )
}

export default BrandsPage
