import { useEffect, useState } from 'react'
import {
  Card,
  Tree,
  TreeSelect,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  Checkbox,
  message,
  Space,
  Spin,
  Popconfirm,
  Divider,
  Tag,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  InboxOutlined,
  StarFilled,
  SettingOutlined,
} from '@ant-design/icons'
import { useCategoryStore } from '../../stores'
import api from '../../api'

function CategoriesPage() {
  // Zustand Store - Single Source of Truth
  const { categoriesTree, loading, fetchCategoriesTree } = useCategoryStore(
    (state) => ({
      categoriesTree: state.categoriesTree,
      loading: state.loading,
      fetchCategoriesTree: state.fetchCategoriesTree,
    }),
  )

  // Local State
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [form] = Form.useForm()

  // Properties (Technical Specifications) State
  const [properties, setProperties] = useState([])
  const [newPropertyName, setNewPropertyName] = useState('')
  const [newPropertyType, setNewPropertyType] = useState('select')
  const [newPropertyOptions, setNewPropertyOptions] = useState('')
  const [newPropertyUnit, setNewPropertyUnit] = useState('')
  const [newPropertyFilterable, setNewPropertyFilterable] = useState(true)

  // Initial load
  useEffect(() => {
    if (!categoriesTree || categoriesTree.length === 0) {
      fetchCategoriesTree()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Normalize Upload event to fileList
  const normFileList = (e) => {
    if (Array.isArray(e)) return e
    return e?.fileList || []
  }

  // Submit handler (create / update)
  const onFinish = async (values) => {
    try {
      setSubmitting(true)

      const formData = new FormData()

      formData.append('name', values.name)
      if (values.parent) {
        formData.append('parent', values.parent)
      }
      if (values.description) {
        formData.append('description', values.description)
      }
      formData.append('isFeatured', values.isFeatured || false)
      formData.append('isPopular', values.isPopular || false)

      const hadIconBefore = Boolean(editingCategory?.iconUrl)
      const hadImageBefore = Boolean(editingCategory?.imageUrl)

      const pickNewFile = (files) => {
        if (!Array.isArray(files)) return null
        return files.find((f) => f.originFileObj) || null
      }

      const iconFile = pickNewFile(values.icon)
      if (iconFile) {
        formData.append('icon', iconFile.originFileObj)
      } else if (hadIconBefore && (!values.icon || values.icon.length === 0)) {
        // Explicitly request icon removal when user cleared existing icon
        formData.append('removeIcon', 'true')
      }

      const imageFile = pickNewFile(values.image)
      if (imageFile) {
        formData.append('image', imageFile.originFileObj)
      } else if (hadImageBefore && (!values.image || values.image.length === 0)) {
        // Explicitly request image removal when user cleared existing image
        formData.append('removeImage', 'true')
      }

      // Add properties as JSON string
      formData.append('properties', JSON.stringify(properties))

      if (editingCategory && editingCategory._id) {
        // Let axios handle Content-Type automatically for FormData (includes boundary)
        await api.put(`/categories/${editingCategory._id}`, formData)
        message.success('دسته‌بندی با موفقیت ویرایش شد')
      } else {
        // Let axios handle Content-Type automatically for FormData (includes boundary)
        await api.post('/categories', formData)
        message.success('دسته‌بندی با موفقیت ایجاد شد')
      }

      await fetchCategoriesTree()
      setModalVisible(false)
      setEditingCategory(null)
      setProperties([]) // Reset properties
      form.resetFields()
    } catch (error) {
      if (error?.errorFields) return
      message.error(
        error?.message || 'خطا در ذخیره‌سازی اطلاعات دسته‌بندی',
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Open Modal for Create
  const handleCreate = () => {
    setEditingCategory(null)
    setProperties([]) // Reset properties
    form.resetFields()
    setModalVisible(true)
  }

  // Open Modal for Edit
  const handleEdit = (category) => {
    const node = {
      ...category,
      _id: category._id || category.key,
    }
    setEditingCategory(node)
    form.setFieldsValue({
      name: node.title,
      parent: node.parent || null,
      description: node.description || '',
      isFeatured: node.isFeatured || false,
      isPopular: node.isPopular || false,
      icon: node.iconUrl
        ? [
          {
            uid: '-1',
            name: 'icon',
            status: 'done',
            url: node.iconUrl,
          },
        ]
        : [],
      image: node.imageUrl
        ? [
          {
            uid: '-1',
            name: 'image',
            status: 'done',
            url: node.imageUrl,
          },
        ]
        : [],
    })
    // Load properties for editing
    setProperties(node.properties || [])
    setModalVisible(true)
  }

  // Delete Category
  const handleDelete = async (categoryId) => {
    try {
      await api.delete(`/categories/${categoryId}`)
      message.success('دسته‌بندی با موفقیت حذف شد')
      await fetchCategoriesTree()
    } catch (error) {
      message.error(error?.message || 'خطا در حذف دسته‌بندی')
    }
  }

  // Drag & Drop Handler (change parent)
  const onDrop = async (info) => {
    const dragNodeId = info.dragNode.key
    const dropNodeId = info.node.key
    const dropToGap = info.dropToGap

    try {
      let newParentId = null

      if (!dropToGap) {
        // dropped on node -> make it parent
        newParentId = dropNodeId
      } else if (info.node.parent) {
        // dropped between nodes -> keep same parent as target node
        newParentId = info.node.parent
      }

      await api.put(`/categories/${dragNodeId}`, { parent: newParentId })
      message.success('ساختار دسته‌بندی با موفقیت به‌روزرسانی شد')
      await fetchCategoriesTree()
    } catch (error) {
      message.error(error?.message || 'خطا در جابجایی دسته‌بندی')
    }
  }

  // Render Tree with Actions and icon preview
  const renderTreeNodes = (data) =>
    data.map((item) => ({
      ...item,
      title: (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {item.iconUrl && (
              <img
                src={item.iconUrl}
                alt="icon"
                style={{
                  width: 20,
                  height: 20,
                  objectFit: 'cover',
                  borderRadius: 4,
                }}
              />
            )}
            <span>{item.title}</span>
            {item.isPopular && <StarFilled style={{ color: '#f59e0b', fontSize: 14 }} />}
          </span>
          <Space size="small">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                handleEdit(item)
              }}
            />
            <Popconfirm
              title="حذف این دسته‌بندی؟"
              onConfirm={(e) => {
                e.stopPropagation()
                handleDelete(item.key)
              }}
              okText="حذف"
              cancelText="انصراف"
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          </Space>
        </div>
      ),
      children: item.children ? renderTreeNodes(item.children) : undefined,
    }))

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
        <h1>مدیریت دسته‌بندی‌ها</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          افزودن دسته‌بندی جدید
        </Button>
      </div>

      <Card>
        {loading && categoriesTree.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="در حال دریافت دسته‌بندی‌ها..." />
          </div>
        ) : categoriesTree.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 0',
              color: '#999',
            }}
          >
            <p>هنوز هیچ دسته‌بندی‌ای ثبت نشده است.</p>
            <p style={{ fontSize: 12 }}>
              روی «افزودن دسته‌بندی جدید» کلیک کنید تا اولین دسته‌بندی را ایجاد
              کنید.
            </p>
          </div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <h3 style={{ marginBottom: 12 }}>
                ساختار درختی دسته‌بندی‌ها (برای جابجایی، درخت را درگ و دراپ
                کنید):
              </h3>
              <Tree
                treeData={renderTreeNodes(categoriesTree)}
                defaultExpandAll
                showLine
                draggable
                onDrop={onDrop}
                style={{
                  background: '#fafafa',
                  padding: 16,
                  borderRadius: 8,
                }}
              />
            </div>
          </Space>
        )}
      </Card>

      {/* Modal: Create/Edit Category */}
      <Modal
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingCategory(null)
          setProperties([])
          form.resetFields()
        }}
        onOk={() => form.submit()}
        title={editingCategory ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید'}
        okText={editingCategory ? 'ذخیره تغییرات' : 'ایجاد'}
        cancelText="انصراف"
        confirmLoading={submitting}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          {/* 1. Name */}
          <Form.Item
            name="name"
            label="نام دسته‌بندی"
            rules={[
              {
                required: true,
                message: 'وارد کردن نام دسته‌بندی الزامی است',
              },
            ]}
          >
            <Input placeholder="مثلاً: دوربین مداربسته" />
          </Form.Item>

          {/* 2. Parent */}
          <Form.Item
            name="parent"
            label="دسته‌بندی والد (اختیاری)"
            help="در صورت خالی بودن، این دسته در سطح ریشه قرار می‌گیرد."
          >
            <TreeSelect
              treeData={categoriesTree}
              loading={loading}
              placeholder="انتخاب دسته‌بندی والد..."
              allowClear
              showSearch
              treeDefaultExpandAll
              filterTreeNode={(input, node) =>
                node.title.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          {/* 3. Description */}
          <Form.Item name="description" label="توضیحات (اختیاری)">
            <Input.TextArea rows={3} placeholder="توضیحات کوتاه درباره دسته‌بندی" />
          </Form.Item>

          {/* 4. Icon */}
          <Form.Item
            name="icon"
            label="آیکون دسته‌بندی (اختیاری)"
            help="برای نمایش درخت و لیست‌ها، یک آیکون کوچک انتخاب کنید."
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
                آیکون را بکشید و رها کنید یا برای انتخاب کلیک کنید.
              </p>
            </Upload.Dragger>
          </Form.Item>

          {/* 5. Image */}
          <Form.Item
            name="image"
            label="تصویر دسته‌بندی (اختیاری)"
            help="این تصویر می‌تواند در صفحات فروشگاه نمایش داده شود."
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
                تصویر را بکشید و رها کنید یا برای انتخاب کلیک کنید.
              </p>
            </Upload.Dragger>
          </Form.Item>

          {/* 6. Featured */}
          <Form.Item name="isFeatured" valuePropName="checked">
            <Checkbox>نمایش در ویژه‌ها (بالای صفحه - دایره‌ای)</Checkbox>
          </Form.Item>

          {/* 7. Popular */}
          <Form.Item name="isPopular" valuePropName="checked">
            <Checkbox>نمایش در محبوب‌ها (پایین - کارتی)</Checkbox>
          </Form.Item>

          <Divider orientation="right">
            <Space>
              <SettingOutlined />
              <span>ویژگی‌های فنی (مشخصات)</span>
            </Space>
          </Divider>

          {/* 8. Properties (Technical Specifications) */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>
              ویژگی‌های فنی برای محصولات این دسته‌بندی را تعریف کنید. این ویژگی‌ها در فرم ایجاد محصول و فیلترهای صفحه محصولات نمایش داده می‌شوند.
            </p>

            {/* List of existing properties */}
            {properties.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {properties.map((prop, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#fafafa',
                      borderRadius: 8,
                      marginBottom: 8,
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <Space>
                        <Tag color="blue">{prop.name}</Tag>
                        <Tag color="green">{prop.type === 'select' ? 'انتخابی' : prop.type === 'number' ? 'عددی' : 'متنی'}</Tag>
                        {prop.unit && <Tag color="orange">{prop.unit}</Tag>}
                        {prop.isFilterable && <Tag color="purple">قابل فیلتر</Tag>}
                      </Space>
                      {prop.type === 'select' && prop.options && prop.options.length > 0 && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#888' }}>
                          گزینه‌ها: {prop.options.join(' ، ')}
                        </div>
                      )}
                    </div>
                    <Popconfirm
                      title="حذف این ویژگی؟"
                      onConfirm={() => {
                        const newProps = [...properties]
                        newProps.splice(index, 1)
                        setProperties(newProps)
                        message.success('ویژگی حذف شد')
                      }}
                      okText="حذف"
                      cancelText="انصراف"
                    >
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                ))}
              </div>
            )}

            {/* Add new property form */}
            <Card size="small" title="افزودن ویژگی جدید" style={{ background: '#fafafa' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Input
                    placeholder="نام ویژگی (مثلاً: رزولوشن)"
                    value={newPropertyName}
                    onChange={(e) => setNewPropertyName(e.target.value)}
                    style={{ flex: 1, minWidth: 150 }}
                  />
                  <Select
                    value={newPropertyType}
                    onChange={setNewPropertyType}
                    style={{ width: 100 }}
                    options={[
                      { value: 'select', label: 'انتخابی' },
                      { value: 'text', label: 'متنی' },
                      { value: 'number', label: 'عددی' },
                    ]}
                  />
                  <Input
                    placeholder="واحد (اختیاری)"
                    value={newPropertyUnit}
                    onChange={(e) => setNewPropertyUnit(e.target.value)}
                    style={{ width: 100 }}
                  />
                </div>

                {newPropertyType === 'select' && (
                  <Input
                    placeholder="گزینه‌ها (با ویرگول جدا کنید: 2MP, 4MP, 8MP)"
                    value={newPropertyOptions}
                    onChange={(e) => setNewPropertyOptions(e.target.value)}
                  />
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Checkbox
                    checked={newPropertyFilterable}
                    onChange={(e) => setNewPropertyFilterable(e.target.checked)}
                  >
                    نمایش در فیلترهای صفحه محصولات
                  </Checkbox>
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      if (!newPropertyName.trim()) {
                        message.warning('نام ویژگی را وارد کنید')
                        return
                      }

                      const newProp = {
                        name: newPropertyName.trim(),
                        type: newPropertyType,
                        options: newPropertyType === 'select'
                          ? newPropertyOptions.split(',').map(o => o.trim()).filter(Boolean)
                          : [],
                        unit: newPropertyUnit.trim(),
                        isFilterable: newPropertyFilterable,
                        order: properties.length,
                      }

                      setProperties([...properties, newProp])
                      setNewPropertyName('')
                      setNewPropertyOptions('')
                      setNewPropertyUnit('')
                      setNewPropertyFilterable(true)
                      message.success('ویژگی اضافه شد')
                    }}
                  >
                    افزودن
                  </Button>
                </div>
              </Space>
            </Card>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default CategoriesPage
