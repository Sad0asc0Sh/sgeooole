import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Select, Button, Input, Space, message } from 'antd'
import { ArrowRightOutlined, SendOutlined } from '@ant-design/icons'
import PageHeader from '../../components/ui/PageHeader'
import StatusPill from '../../components/ui/StatusPill'
import { formatPersianDate } from '../../utils/dateUtils'
import api from '../../api'

const { TextArea } = Input

const STATUS_META = {
  open: { label: 'باز', tone: 'warn' },
  pending: { label: 'در انتظار بررسی', tone: 'info' },
  closed: { label: 'بسته‌شده', tone: 'neutral' },
}

const PRIORITY_META = {
  high: { label: 'فوری', tone: 'err' },
  medium: { label: 'متوسط', tone: 'warn' },
  low: { label: 'عادی', tone: 'ok' },
}

function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('open')
  const [sending, setSending] = useState(false)
  const [reply, setReply] = useState('')
  const listRef = useRef(null)

  const fetchTicket = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/tickets/${id}`)
      const t = res?.data?.data
      setTicket(t)
      if (t?.status) setStatus(t.status)
      setTimeout(() => listRef.current?.scrollTo?.(0, 999999), 0)
    } catch (err) {
      message.error(err?.message || 'خطا در دریافت تیکت')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTicket()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const onUpdateStatus = async () => {
    try {
      setSending(true)
      await api.put(`/tickets/${id}/status`, { status })
      message.success('وضعیت تیکت به‌روزرسانی شد')
      fetchTicket()
    } catch (err) {
      message.error(err?.message || 'به‌روزرسانی وضعیت انجام نشد')
    } finally {
      setSending(false)
    }
  }

  const onSendReply = async () => {
    if (!reply.trim()) return
    try {
      setSending(true)
      await api.post(`/tickets/${id}/reply`, { message: reply.trim() })
      setReply('')
      message.success('پاسخ ارسال شد')
      fetchTicket()
    } catch (err) {
      message.error(err?.message || 'ارسال پاسخ انجام نشد')
    } finally {
      setSending(false)
    }
  }

  const stMeta = STATUS_META[ticket?.status] || { label: ticket?.status || '—', tone: 'neutral' }
  const prMeta = PRIORITY_META[ticket?.priority] || { label: ticket?.priority || 'عادی', tone: 'neutral' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <PageHeader
        title="جزئیات تیکت پشتیبانی"
        subtitle={ticket?.subject || ''}
        actions={
          <Button icon={<ArrowRightOutlined />} onClick={() => navigate('/tickets')}>
            بازگشت به تیکت‌ها
          </Button>
        }
      />

      <Card loading={loading}>
        {ticket && (
          <>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="موضوع">{ticket.subject}</Descriptions.Item>
              <Descriptions.Item label="وضعیت">
                <StatusPill tone={stMeta.tone} label={stMeta.label} />
              </Descriptions.Item>
              <Descriptions.Item label="کاربر">
                {ticket.user ? `${ticket.user.name || 'کاربر'} (${ticket.user.email || ticket.user.mobile || '—'})` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="اولویت">
                <StatusPill size="sm" tone={prMeta.tone} label={prMeta.label} />
              </Descriptions.Item>
              <Descriptions.Item label="سفارش مرتبط" span={2}>
                {ticket.order?.orderNumber || ticket.order?.orderCode || '—'}
              </Descriptions.Item>
            </Descriptions>

            <div className="filter-bar" style={{ marginTop: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>تغییر وضعیت تیکت:</span>
              <Select value={status} onChange={setStatus} style={{ width: 190, maxWidth: '100%' }}>
                <Select.Option value="open">باز</Select.Option>
                <Select.Option value="pending">در انتظار بررسی</Select.Option>
                <Select.Option value="closed">بسته‌شده</Select.Option>
              </Select>
              <Button type="primary" onClick={onUpdateStatus} loading={sending}>
                ثبت وضعیت
              </Button>
            </div>

            <div
              ref={listRef}
              style={{
                marginTop: 16,
                maxHeight: 400,
                overflow: 'auto',
                padding: 16,
                background: 'var(--surface-sunken)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {(ticket.messages || []).map((m, idx) => {
                const isAdmin =
                  m.sender?.role && m.sender.role !== 'user'
                return (
                  <div
                    key={idx}
                    style={{
                      alignSelf: isAdmin ? 'flex-start' : 'flex-end',
                      maxWidth: 'min(580px, 92%)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>
                      <strong>{m.sender?.name || 'کاربر'}</strong> •{' '}
                      {formatPersianDate(m.timestamp || m.createdAt, true)}
                    </div>
                    <div
                      style={{
                        background: isAdmin ? 'var(--brand-50)' : '#ffffff',
                        border: isAdmin
                          ? '1px solid var(--brand-200)'
                          : '1px solid var(--line)',
                        padding: '10px 14px',
                        borderRadius: 10,
                        lineHeight: 1.7,
                        color: 'var(--ink-900)',
                      }}
                    >
                      {m.message}
                    </div>
                  </div>
                )
              })}
            </div>

            <Space.Compact style={{ marginTop: 16, width: '100%' }}>
              <TextArea
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="پاسخ خود را برای مشتری بنویسید..."
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={onSendReply}
                loading={sending}
                style={{ height: 'auto' }}
              >
                ارسال پاسخ
              </Button>
            </Space.Compact>
          </>
        )}
      </Card>
    </div>
  )
}

export default TicketDetail
