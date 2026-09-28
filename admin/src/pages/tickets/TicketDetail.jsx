import PageHeader from '../../components/ui/PageHeader'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Descriptions, Tag, Select, Button, Input, message } from 'antd'
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

const { TextArea } = Input

function TicketDetail() {
  const { id } = useParams()
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

  useEffect(() => { fetchTicket() }, [id])

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
      fetchTicket()
    } catch (err) {
      message.error(err?.message || 'ارسال پاسخ انجام نشد')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
            <PageHeader title={"جزئیات تیکت"} />
      <Card loading={loading}>
        {ticket && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="موضوع">{ticket.subject}</Descriptions.Item>
              <Descriptions.Item label="وضعیت"><Tag color={ticket.status==='closed'?'red':ticket.status==='pending'?'blue':'green'}>{ticket.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="کاربر" span={2}>{ticket.user ? `${ticket.user.name} (${ticket.user.email})` : '-'}</Descriptions.Item>
              <Descriptions.Item label="سفارش" span={2}>{ticket.order?.orderNumber || '-'}</Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>تغییر وضعیت:</span>
              <Select value={status} onChange={setStatus} style={{ width: 180, maxWidth: '100%' }}>
                {['open','pending','closed'].map(s => (
                  <Select.Option key={s} value={s}>{s}</Select.Option>
                ))}
              </Select>
              <Button type="primary" onClick={onUpdateStatus} loading={sending}>ثبت وضعیت</Button>
            </div>

            <div ref={listRef} style={{ marginTop: 24, maxHeight: 360, overflow: 'auto', padding: 12, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8 }}>
              {(ticket.messages || []).map((m, idx) => (
                <div key={idx} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {m.sender?.name || 'کاربر'} • {formatPersianDate(m.timestamp, true)}
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #eee', padding: '8px 12px', borderRadius: 8 }}>
                    {m.message}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <TextArea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پاسخ خود را بنویسید..." />
              <Button type="primary" onClick={onSendReply} loading={sending}>ارسال</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

export default TicketDetail

