import { useEffect, useState, useRef } from 'react'
import { Card, Table, Button, Space, Input, Select, Modal, Form, Tag, message, Popconfirm } from 'antd'
import { Editor } from '@tinymce/tinymce-react'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'

// فعال‌سازی تقویم جلالی
dayjs.extend(jalaliday)
dayjs.calendar('jalali')

// نام ماه‌های شمسی
const persianMonths = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

// تابع برای فرمت کردن تاریخ با نام ماه فارسی
const formatPersianDate = (date, includeTime = false) => {
  if (!date) return '—'
  const jalaliDate = dayjs(date).calendar('jalali').locale('fa')
  const year = jalaliDate.format('YYYY')
  const month = persianMonths[parseInt(jalaliDate.format('M')) - 1]
  const day = jalaliDate.format('DD')

  if (includeTime) {
    const time = jalaliDate.format('HH:mm')
    return `${day} ${month} ${year} - ساعت ${time}`
  }
  return `${day} ${month} ${year}`
}

// TinyMCE API Key - برای استفاده رایگان می‌توانید از کلید رایگان استفاده کنید
// ثبت‌نام رایگان در: https://www.tiny.cloud/auth/signup/
const TINYMCE_API_KEY = 'no-api-key'

function BlogPosts() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [status, setStatus] = useState()
  const [category, setCategory] = useState()
  const [search, setSearch] = useState('')

  const [categories, setCategories] = useState([])
  const [catOpen, setCatOpen] = useState(false)
  const [catForm] = Form.useForm()
  const [editingCat, setEditingCat] = useState(null)

  const [postOpen, setPostOpen] = useState(false)
  const [postForm] = Form.useForm()
  const [editingPost, setEditingPost] = useState(null)
  const [savingPost, setSavingPost] = useState(false)
  const editorRef = useRef(null)

  const fetchCategories = async () => {
    try {
      const res = await api.get('/blog/categories')
      setCategories(res?.data?.data || [])
    } catch (_) { }
  }

  const fetchPosts = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const params = { page, limit: pageSize, sort: '-createdAt' }
      if (status) params.status = status
      if (category) params.category = category
      if (search) params.search = search
      const res = await api.get('/blog', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination
      setPosts(list)
      if (pg) setPagination({ current: pg.currentPage || page, pageSize, total: pg.totalItems || list.length })
    } catch (err) {
      message.error(err?.message || 'خطا در دریافت پست‌ها')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCategories(); fetchPosts(1, pagination.pageSize) }, [])
  useEffect(() => { fetchPosts(1, pagination.pageSize) }, [status, category])

  const columns = [
    { title: 'عنوان', dataIndex: 'title', key: 'title' },
    { title: 'دسته', key: 'category', render: (_, r) => r.category?.name || '-' },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'published' ? 'green' : 'orange'}>{s}</Tag> },
    { title: 'ایجاد', dataIndex: 'createdAt', key: 'createdAt', render: (d) => formatPersianDate(d, true) },
    {
      title: 'عملیات', key: 'actions', render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => onEditPost(r)}>ویرایش</Button>
          <Popconfirm title="حذف این پست؟" onConfirm={() => onDeletePost(r._id)}>
            <Button size="small" danger>حذف</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  const onTableChange = (pag) => {
    setPagination((prev) => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))
    fetchPosts(pag.current, pag.pageSize)
  }

  const onNewPost = () => {
    setEditingPost(null)
    postForm.resetFields()
    postForm.setFieldsValue({ status: 'draft', content: '' })
    setPostOpen(true)
  }

  const onEditPost = (post) => {
    setEditingPost(post)
    postForm.setFieldsValue({
      title: post.title,
      slug: post.slug,
      category: post.category?._id,
      tags: (post.tags || []).join(','),
      status: post.status,
      featuredImageUrl: post.featuredImage?.url || '',
      content: post.content,
      metaTitle: post.meta?.title || '',
      metaDescription: post.meta?.description || '',
    })
    setPostOpen(true)
  }

  const onDeletePost = async (id) => {
    try {
      await api.delete(`/blog/${id}`)
      message.success('حذف شد')
      fetchPosts()
    } catch (err) {
      message.error(err?.message || 'حذف انجام نشد')
    }
  }

  const savePost = async () => {
    try {
      const values = await postForm.validateFields()
      // دریافت محتوا از ادیتور TinyMCE
      const content = editorRef.current ? editorRef.current.getContent() : values.content
      setSavingPost(true)
      const payload = {
        title: values.title,
        slug: values.slug,
        category: values.category || undefined,
        tags: values.tags ? String(values.tags).split(',').map(t => t.trim()).filter(Boolean) : [],
        status: values.status,
        featuredImage: values.featuredImageUrl ? { url: values.featuredImageUrl } : undefined,
        content: content,
        meta: { title: values.metaTitle, description: values.metaDescription },
      }
      if (editingPost) {
        await api.put(`/blog/${editingPost._id}`, payload)
        message.success('ویرایش شد')
      } else {
        await api.post('/blog', payload)
        message.success('ایجاد شد')
      }
      setPostOpen(false)
      setEditingPost(null)
      fetchPosts()
    } catch (err) {
      if (!err?.errorFields) message.error(err?.message || 'ذخیره انجام نشد')
    } finally {
      setSavingPost(false)
    }
  }

  const onNewCategory = () => {
    setEditingCat(null)
    catForm.resetFields()
    setCatOpen(true)
  }

  const onEditCategory = (cat) => {
    setEditingCat(cat)
    catForm.setFieldsValue({ name: cat.name, slug: cat.slug })
    setCatOpen(true)
  }

  const saveCategory = async () => {
    try {
      const values = await catForm.validateFields()
      if (editingCat) {
        await api.put(`/blog/categories/${editingCat._id}`, values)
        message.success('ویرایش شد')
      } else {
        await api.post('/blog/categories', values)
        message.success('ایجاد شد')
      }
      setCatOpen(false)
      setEditingCat(null)
      fetchCategories()
    } catch (err) {
      if (!err?.errorFields) message.error(err?.message || 'ذخیره انجام نشد')
    }
  }

  const deleteCategory = async (id) => {
    try { await api.delete(`/blog/categories/${id}`); message.success('حذف شد'); fetchCategories() } catch (err) { message.error(err?.message || 'حذف انجام نشد') }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>پست‌های بلاگ</h1>
        <Space>
          <Input placeholder="جستجو" allowClear style={{ width: 200 }} onChange={(e) => setSearch(e.target.value)} onPressEnter={() => fetchPosts(1, pagination.pageSize)} onBlur={() => fetchPosts(1, pagination.pageSize)} />
          <Select placeholder="وضعیت" allowClear style={{ width: 140 }} onChange={setStatus}>
            <Select.Option value="draft">draft</Select.Option>
            <Select.Option value="published">published</Select.Option>
          </Select>
          <Select placeholder="دسته‌بندی" allowClear style={{ width: 200 }} onChange={setCategory}>
            {categories.map(c => <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>)}
          </Select>
          <Button onClick={() => fetchPosts(1, pagination.pageSize)}>اعمال</Button>
          <Button type="primary" onClick={onNewPost}>پست جدید</Button>
          <Button onClick={onNewCategory}>مدیریت دسته‌بندی</Button>
        </Space>
      </div>
      <Card>
        <Table
          columns={columns}
          dataSource={posts}
          loading={loading}
          rowKey="_id"
          pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true }}
          onChange={onTableChange}
        />
      </Card>

      {/* Post Modal */}
      <Modal open={postOpen} onCancel={() => setPostOpen(false)} onOk={savePost} okText={editingPost ? 'ذخیره' : 'ایجاد'} confirmLoading={savingPost} title={editingPost ? 'ویرایش پست' : 'پست جدید'} width={900}>
        <Form layout="vertical" form={postForm}>
          <Form.Item name="title" label="عنوان" rules={[{ required: true, message: 'عنوان را وارد کنید' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="اسلاگ (اختیاری)">
            <Input />
          </Form.Item>
          <Form.Item name="category" label="دسته‌بندی">
            <Select allowClear>
              {categories.map(c => <Select.Option key={c._id} value={c._id}>{c.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="tags" label="تگ‌ها (جدا با کاما)"><Input /></Form.Item>
          <Form.Item name="status" label="وضعیت" initialValue="draft">
            <Select>
              <Select.Option value="draft">draft</Select.Option>
              <Select.Option value="published">published</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="featuredImageUrl" label="آدرس تصویر شاخص"><Input placeholder="https://..." /></Form.Item>
          <Form.Item name="content" label="محتوا" rules={[{ required: true, message: 'محتوا را وارد کنید' }]}>
            <Editor
              apiKey={TINYMCE_API_KEY}
              onInit={(evt, editor) => editorRef.current = editor}
              initialValue={postForm.getFieldValue('content') || ''}
              init={{
                height: 350,
                menubar: true,
                directionality: 'rtl',
                language: 'fa',
                plugins: [
                  'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                  'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                  'insertdatetime', 'media', 'table', 'help', 'wordcount'
                ],
                toolbar: 'undo redo | blocks | ' +
                  'bold italic forecolor | alignleft aligncenter ' +
                  'alignright alignjustify | bullist numlist outdent indent | ' +
                  'removeformat | link image | help',
                content_style: 'body { font-family: Vazirmatn, Tahoma, Arial, sans-serif; font-size: 14px; direction: rtl; }',
              }}
              onEditorChange={(content) => {
                postForm.setFieldsValue({ content })
              }}
            />
          </Form.Item>
          <Form.Item name="metaTitle" label="Meta Title"><Input /></Form.Item>
          <Form.Item name="metaDescription" label="Meta Description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Category Modal */}
      <Modal open={catOpen} onCancel={() => setCatOpen(false)} onOk={saveCategory} okText={editingCat ? 'ذخیره' : 'ایجاد'} title="مدیریت دسته‌بندی">
        <Form layout="vertical" form={catForm}>
          <Form.Item name="name" label="نام" rules={[{ required: true, message: 'نام را وارد کنید' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="اسلاگ (اختیاری)"><Input /></Form.Item>
        </Form>
        <div style={{ marginTop: 16 }}>
          {categories.map(c => (
            <div key={c._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span>{c.name}</span>
              <Space>
                <Button size="small" onClick={() => onEditCategory(c)}>ویرایش</Button>
                <Popconfirm title="حذف این دسته؟" onConfirm={() => deleteCategory(c._id)}>
                  <Button danger size="small">حذف</Button>
                </Popconfirm>
              </Space>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

export default BlogPosts
