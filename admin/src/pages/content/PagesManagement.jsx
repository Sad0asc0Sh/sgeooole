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

function PagesManagement() {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [status, setStatus] = useState()
  const [search, setSearch] = useState('')

  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef(null)

  const fetchPages = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const params = { page, limit: pageSize, sort: '-createdAt' }
      if (status) params.status = status
      if (search) params.search = search
      const res = await api.get('/pages', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination
      setPages(list)
      if (pg) setPagination({ current: pg.currentPage || page, pageSize, total: pg.totalItems || list.length })
    } catch (err) {
      message.error(err?.message || 'خطا در دریافت صفحات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPages(1, pagination.pageSize) }, [])
  useEffect(() => { fetchPages(1, pagination.pageSize) }, [status])

  const columns = [
    { title: 'عنوان', dataIndex: 'title', key: 'title' },
    { title: 'اسلاگ', dataIndex: 'slug', key: 'slug' },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'published' ? 'green' : 'orange'}>{s}</Tag> },
    { title: 'ایجاد', dataIndex: 'createdAt', key: 'createdAt', render: (d) => formatPersianDate(d, true) },
    {
      title: 'عملیات', key: 'actions', render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => onEdit(r)}>ویرایش</Button>
          <Popconfirm title="حذف این صفحه؟" onConfirm={() => onDelete(r._id)}>
            <Button size="small" danger>حذف</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  const onTableChange = (pag) => {
    setPagination((prev) => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))
    fetchPages(pag.current, pag.pageSize)
  }

  const onNew = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ status: 'published', content: '' })
    setOpen(true)
  }

  const onEdit = (p) => {
    setEditing(p)
    form.setFieldsValue({ title: p.title, slug: p.slug, status: p.status, content: p.content, metaTitle: p.meta?.title, metaDescription: p.meta?.description })
    setOpen(true)
  }

  const onDelete = async (id) => {
    try { await api.delete(`/pages/${id}`); message.success('حذف شد'); fetchPages() } catch (err) { message.error(err?.message || 'حذف انجام نشد') }
  }

  const save = async () => {
    try {
      const values = await form.validateFields()
      // دریافت محتوا از ادیتور TinyMCE
      const content = editorRef.current ? editorRef.current.getContent() : values.content
      setSaving(true)
      const payload = { title: values.title, slug: values.slug, status: values.status, content: content, meta: { title: values.metaTitle, description: values.metaDescription } }
      if (editing) { await api.put(`/pages/${editing._id}`, payload); message.success('ویرایش شد') } else { await api.post('/pages', payload); message.success('ایجاد شد') }
      setOpen(false)
      setEditing(null)
      fetchPages()
    } catch (err) { if (!err?.errorFields) message.error(err?.message || 'ذخیره انجام نشد') } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>مدیریت صفحات</h1>
        <Space>
          <Input placeholder="جستجو" allowClear style={{ width: 200 }} onChange={(e) => setSearch(e.target.value)} onPressEnter={() => fetchPages(1, pagination.pageSize)} onBlur={() => fetchPages(1, pagination.pageSize)} />
          <Select placeholder="وضعیت" allowClear style={{ width: 140 }} onChange={setStatus}>
            <Select.Option value="published">published</Select.Option>
            <Select.Option value="hidden">hidden</Select.Option>
          </Select>
          <Button onClick={() => fetchPages(1, pagination.pageSize)}>اعمال</Button>
          <Button type="primary" onClick={onNew}>صفحه جدید</Button>
        </Space>
      </div>
      <Card>
        <Table columns={columns} dataSource={pages} loading={loading} rowKey="_id" pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true }} onChange={onTableChange} />
      </Card>

      <Modal open={open} onCancel={() => setOpen(false)} onOk={save} okText={editing ? 'ذخیره' : 'ایجاد'} confirmLoading={saving} title={editing ? 'ویرایش صفحه' : 'صفحه جدید'} width={900}>
        <Form layout="vertical" form={form}>
          <Form.Item name="title" label="عنوان" rules={[{ required: true, message: 'عنوان را وارد کنید' }]}><Input /></Form.Item>
          <Form.Item name="slug" label="اسلاگ (اختیاری)"><Input /></Form.Item>
          <Form.Item name="status" label="وضعیت" initialValue="published"><Select><Select.Option value="published">published</Select.Option><Select.Option value="hidden">hidden</Select.Option></Select></Form.Item>
          <Form.Item name="content" label="محتوا" rules={[{ required: true, message: 'محتوا را وارد کنید' }]}>
            <Editor
              apiKey={TINYMCE_API_KEY}
              onInit={(evt, editor) => editorRef.current = editor}
              initialValue={form.getFieldValue('content') || ''}
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
                form.setFieldsValue({ content })
              }}
            />
          </Form.Item>
          <Form.Item name="metaTitle" label="Meta Title"><Input /></Form.Item>
          <Form.Item name="metaDescription" label="Meta Description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PagesManagement
