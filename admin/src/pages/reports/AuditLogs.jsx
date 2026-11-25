import { useEffect, useState, useCallback } from 'react'
import { Card, Button, Space, Input, Select, Modal, Descriptions } from 'antd'
import { ReloadOutlined, SearchOutlined, EyeOutlined, ClearOutlined } from '@ant-design/icons'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader'
import StatusPill from '../../components/ui/StatusPill'
import ResponsiveTable from '../../components/ResponsiveTable'
import JalaliRangePicker from '../../components/JalaliRangePicker'
import { formatPersianDate, toSafeDate } from '../../utils/dateUtils'
import { formatNumber } from '../../utils/formatters'
import './Reports.css'

const ACTION_META = {
  CREATE: { label: 'ایجاد', tone: 'ok' },
  UPDATE: { label: 'ویرایش', tone: 'info' },
  DELETE: { label: 'حذف', tone: 'err' },
  LOGIN: { label: 'ورود به سیستم', tone: 'brand' },
  LOGOUT: { label: 'خروج از سیستم', tone: 'neutral' },
  STATUS_CHANGE: { label: 'تغییر وضعیت', tone: 'warn' },
}

const ENTITY_LABELS = {
  Product: 'محصول',
  Order: 'سفارش',
  User: 'کاربر',
  Admin: 'ادمین',
  Category: 'دسته‌بندی',
  Brand: 'برند',
  Coupon: 'کد تخفیف',
  Sale: 'تخفیف زمان‌دار',
  Settings: 'تنظیمات',
  Review: 'دیدگاه',
  Ticket: 'تیکت',
  Banner: 'بنر',
}

function resolveActionMeta(action) {
  const key = String(action || '').toUpperCase()
  if (ACTION_META[key]) return ACTION_META[key]
  if (key.includes('DELETE') || key.includes('REMOVE')) return { label: action, tone: 'err' }
  if (key.includes('CREATE') || key.includes('ADD')) return { label: action, tone: 'ok' }
  if (key.includes('UPDATE') || key.includes('EDIT')) return { label: action, tone: 'info' }
  return { label: action || '—', tone: 'neutral' }
}

function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [availableActions, setAvailableActions] = useState([])
  const [availableEntities, setAvailableEntities] = useState([])
  const [detailLog, setDetailLog] = useState(null)
  const [filters, setFilters] = useState({
    search: '',
    action: undefined,
    entity: undefined,
    range: [],
  })
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  })

  const fetchLogs = useCallback(
    async (page = 1, pageSize = pagination.pageSize, override = filters) => {
      setLoading(true)
      try {
        const params = { page, limit: pageSize }
        if (override.search?.trim()) params.search = override.search.trim()
        if (override.action) params.action = override.action
        if (override.entity) params.entity = override.entity
        const [rawStart, rawEnd] = override.range || []
        const s = toSafeDate(rawStart)
        const e = toSafeDate(rawEnd)
        if (s) params.startDate = s.toISOString()
        if (e) params.endDate = e.toISOString()

        const res = await api.get('/audit-logs', { params })
        const list = res?.data?.data || []
        const pg = res?.data?.pagination
        const filterMeta = res?.data?.filters

        setLogs(Array.isArray(list) ? list : [])
        if (Array.isArray(filterMeta?.actions)) setAvailableActions(filterMeta.actions)
        if (Array.isArray(filterMeta?.entities)) setAvailableEntities(filterMeta.entities)

        if (pg) {
          setPagination({
            current: pg.currentPage || page,
            pageSize: pg.itemsPerPage || pageSize,
            total: pg.totalItems || 0,
          })
        }
      } catch (err) {
        console.error('Error fetching audit logs:', err)
      } finally {
        setLoading(false)
      }
    },
    [filters, pagination.pageSize],
  )

  useEffect(() => {
    fetchLogs(1, 20, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyFilterChange = (patch) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    fetchLogs(1, pagination.pageSize, next)
  }

  const clearAllFilters = () => {
    const empty = { search: '', action: undefined, entity: undefined, range: [] }
    setFilters(empty)
    fetchLogs(1, pagination.pageSize, empty)
  }

  const columns = [
    {
      title: 'کاربر',
      dataIndex: ['user', 'name'],
      key: 'user',
      mobileTitle: true,
      render: (name, record) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 600 }}>{name || 'سیستم'}</span>
          {record.user?.email && (
            <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>{record.user.email}</span>
          )}
        </Space>
      ),
    },
    {
      title: 'عملیات',
      dataIndex: 'action',
      key: 'action',
      mobileBadge: true,
      render: (action) => {
        const meta = resolveActionMeta(action)
        return <StatusPill size="sm" tone={meta.tone} label={meta.label} />
      },
    },
    {
      title: 'بخش / موجودیت',
      key: 'entity',
      render: (_, record) => (
        <span>
          <strong>{ENTITY_LABELS[record.entity] || record.entity || '—'}</strong>{' '}
          {record.entityId && (
            <span style={{ fontFamily: 'monospace', color: 'var(--ink-400)', fontSize: 12 }}>
              #{String(record.entityId).slice(-6)}
            </span>
          )}
        </span>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      render: (ip) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12.5 }} dir="ltr">
          {ip || '—'}
        </span>
      ),
    },
    {
      title: 'تاریخ و ساعت',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => formatPersianDate(date, true),
    },
    {
      title: 'جزئیات',
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_, record) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailLog(record)}>
          جزئیات
        </Button>
      ),
    },
  ]

  return (
    <div className="report-page">
      <PageHeader
        title="گزارش عملکرد سیستم (Audit Logs)"
        subtitle="ثبت کامل رخدادهای امنیتی، تغییرات ادمین‌ها و تاریخچه عملیات"
        count={pagination.total}
        actions={
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={() => fetchLogs(pagination.current, pagination.pageSize, filters)}
          >
            به‌روزرسانی
          </Button>
        }
      />

      <div className="filter-bar">
        <Input.Search
          placeholder="جستجو در کاربر، عملیات، بخش یا IP..."
          allowClear
          enterButton={<SearchOutlined />}
          value={filters.search}
          onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
          onSearch={(val) => applyFilterChange({ search: val })}
          style={{ width: 260, maxWidth: '100%' }}
        />
        <Select
          placeholder="نوع عملیات"
          allowClear
          style={{ width: 170 }}
          value={filters.action}
          onChange={(val) => applyFilterChange({ action: val })}
          options={availableActions.map((a) => ({
            value: a,
            label: resolveActionMeta(a).label,
          }))}
        />
        <Select
          placeholder="بخش / موجودیت"
          allowClear
          style={{ width: 170 }}
          value={filters.entity}
          onChange={(val) => applyFilterChange({ entity: val })}
          options={availableEntities.map((en) => ({
            value: en,
            label: ENTITY_LABELS[en] || en,
          }))}
        />
        <div style={{ minWidth: 240, flex: '1 1 260px', maxWidth: 380 }}>
          <JalaliRangePicker
            value={filters.range}
            onChange={(vals) => applyFilterChange({ range: Array.isArray(vals) ? vals : [] })}
            presets="analytics"
            placeholder="بازه تاریخ رخداد"
          />
        </div>
        <Button icon={<ClearOutlined />} onClick={clearAllFilters}>
          پاک‌کردن فیلترها
        </Button>
      </div>

      <Card className="report-card">
        <ResponsiveTable
          columns={columns}
          dataSource={logs}
          loading={loading}
          rowKey="_id"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `${formatNumber(total)} رویداد`,
          }}
          onChange={(pag) => fetchLogs(pag.current, pag.pageSize, filters)}
        />
      </Card>

      <Modal
        open={Boolean(detailLog)}
        onCancel={() => setDetailLog(null)}
        footer={
          <Button type="primary" onClick={() => setDetailLog(null)}>
            بستن
          </Button>
        }
        title="جزئیات کامل رویداد سیستم"
        width={680}
      >
        {detailLog && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="کاربر">
                {detailLog.user?.name || 'سیستم'} ({detailLog.user?.email || '—'})
              </Descriptions.Item>
              <Descriptions.Item label="عملیات">
                <StatusPill
                  size="sm"
                  tone={resolveActionMeta(detailLog.action).tone}
                  label={resolveActionMeta(detailLog.action).label}
                />
              </Descriptions.Item>
              <Descriptions.Item label="موجودیت">
                {ENTITY_LABELS[detailLog.entity] || detailLog.entity} (#{detailLog.entityId || '—'})
              </Descriptions.Item>
              <Descriptions.Item label="تاریخ">
                {formatPersianDate(detailLog.createdAt, true)}
              </Descriptions.Item>
              <Descriptions.Item label="IP" span={2}>
                <span dir="ltr" style={{ fontFamily: 'monospace' }}>
                  {detailLog.ip || '—'}
                </span>
              </Descriptions.Item>
            </Descriptions>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>داده ثبت‌شده:</div>
              <pre className="audit-json-pre">
                {detailLog.details ? JSON.stringify(detailLog.details, null, 2) : 'بدون جزئیات اضافی'}
              </pre>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default AuditLogs
