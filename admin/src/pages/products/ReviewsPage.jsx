import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Select,
  Space,
  Button,
  message,
  Rate,
  Typography,
  Input,
  Modal,
  Row,
  Col,
  Avatar,
  Tooltip,
  Image,
} from 'antd'
import {
  ReloadOutlined,
  DeleteOutlined,
  SendOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  MessageOutlined,
  UserOutlined,
  ShoppingOutlined,
  StarFilled,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import ResponsiveTable from '../../components/ResponsiveTable'
import PageHeader from '../../components/ui/PageHeader'
import StatTile from '../../components/ui/StatTile'
import StatusPill from '../../components/ui/StatusPill'
import { formatPersianDate } from '../../utils/dateUtils'
import { formatNumber } from '../../utils/formatters'
import { PERMISSIONS } from '../../rbac/permissions'
import { useCan } from '../../rbac/useCan'
import api from '../../api'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

function ReviewsPage() {
  const { can } = useCan()
  const canModerate = can(PERMISSIONS.REVIEW_MODERATE)
  const canReply = can(PERMISSIONS.REVIEW_REPLY)
  const canDelete = can(PERMISSIONS.REVIEW_DELETE)

  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ isApproved: null })
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  const [modalVisible, setModalVisible] = useState(false)
  const [selectedReview, setSelectedReview] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchReviews = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageSize))

      if (filters.isApproved !== null && filters.isApproved !== undefined) {
        params.set('isApproved', String(filters.isApproved))
      }

      const res = await api.get('/reviews/admin', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination

      setReviews(Array.isArray(list) ? list : [])
      if (pg) {
        setPagination({
          current: pg.currentPage || page,
          pageSize: pg.itemsPerPage || pageSize,
          total: pg.totalItems || list.length,
        })
      }
    } catch (err) {
      message.error('خطا در دریافت نظرات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews(1, pagination.pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.isApproved])

  const stats = useMemo(() => {
    const pendingInPage = reviews.filter((r) => !r.isApproved).length
    const rated = reviews.filter((r) => Number(r.rating) > 0)
    const avg = rated.length
      ? (rated.reduce((sum, r) => sum + Number(r.rating), 0) / rated.length).toFixed(1)
      : '۰'
    return {
      total: pagination.total || reviews.length,
      pending: filters.isApproved === false ? pagination.total : pendingInPage,
      avgRating: avg,
    }
  }, [reviews, pagination.total, filters.isApproved])

  const handleStatusUpdate = async (reviewId, isApproved) => {
    if (!canModerate) {
      message.error('شما مجوز تغییر وضعیت نظرات را ندارید.')
      return
    }

    setActionLoading(true)
    try {
      await api.put(`/reviews/${reviewId}/status`, { isApproved })
      message.success('وضعیت نظر به‌روزرسانی شد')

      setReviews((prev) => prev.map((r) => (r._id === reviewId ? { ...r, isApproved } : r)))
      if (selectedReview && selectedReview._id === reviewId) {
        setSelectedReview((prev) => ({ ...prev, isApproved }))
      }

      if (filters.isApproved !== null) {
        fetchReviews(pagination.current)
      }
    } catch (err) {
      message.error('خطا در تغییر وضعیت')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (reviewId) => {
    if (!canDelete) {
      message.error('شما مجوز حذف نظرات را ندارید.')
      return
    }

    try {
      await api.delete(`/reviews/${reviewId}`)
      message.success('نظر حذف شد')
      setModalVisible(false)
      fetchReviews(pagination.current)
    } catch (err) {
      message.error('خطا در حذف نظر')
    }
  }

  const openModal = (review) => {
    setSelectedReview(review)
    setReplyText(review.adminReply?.message || '')
    setModalVisible(true)
  }

  const handleReplySubmit = async () => {
    if (!canReply) {
      message.error('شما مجوز ثبت پاسخ برای نظرات را ندارید.')
      return
    }
    if (!replyText.trim()) return message.warning('متن پاسخ نمی‌تواند خالی باشد')

    setReplyLoading(true)
    try {
      await api.put(`/reviews/${selectedReview._id}/reply`, { replyMessage: replyText.trim() })
      message.success('پاسخ ثبت شد')

      const updatedReview = {
        ...selectedReview,
        adminReply: { message: replyText.trim(), repliedAt: new Date().toISOString() },
      }

      setReviews((prev) => prev.map((r) => (r._id === selectedReview._id ? updatedReview : r)))
      setSelectedReview(updatedReview)
    } catch (err) {
      message.error('خطا در ثبت پاسخ')
    } finally {
      setReplyLoading(false)
    }
  }

  const columns = [
    {
      title: 'محصول',
      dataIndex: ['product', 'name'],
      key: 'product',
      width: 250,
      mobileTitle: true,
      render: (name, record) => {
        const img = record.product?.images?.[0]
        const src = typeof img === 'string' ? img : img?.url
        return (
          <Space>
            <Avatar shape="square" size={44} src={src} icon={<ShoppingOutlined />} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text strong style={{ maxWidth: 180 }} ellipsis={{ tooltip: name }}>
                {name || 'محصول حذف شده'}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                کد: {record.product?.sku || record.product?._id?.substring(0, 8) || '—'}
              </Text>
            </div>
          </Space>
        )
      },
    },
    {
      title: 'کاربر',
      dataIndex: ['user', 'name'],
      key: 'user',
      width: 200,
      mobileSubtitle: true,
      render: (name, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: 'var(--brand-600)' }}>
            {name?.[0]}
          </Avatar>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text strong>{name || 'ناشناس'}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.user?.email || record.user?.mobile || '—'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'امتیاز',
      dataIndex: 'rating',
      key: 'rating',
      width: 145,
      align: 'center',
      render: (rating) => <Rate disabled value={rating} style={{ fontSize: 14 }} />,
    },
    {
      title: 'وضعیت',
      mobileBadge: true,
      dataIndex: 'isApproved',
      key: 'isApproved',
      width: 125,
      align: 'center',
      render: (isApproved) => (
        <StatusPill
          tone={isApproved ? 'ok' : 'warn'}
          label={isApproved ? 'تأیید شده' : 'در انتظار تأیید'}
        />
      ),
    },
    {
      title: 'تاریخ ثبت',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      align: 'center',
      render: (date) => <Text type="secondary">{formatPersianDate(date)}</Text>,
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="مشاهده جزئیات و پاسخ">
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openModal(record)}
          >
            بررسی
          </Button>
        </Tooltip>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <PageHeader
        title="مدیریت دیدگاه‌ها و نظرات"
        subtitle="بررسی، تأیید و پاسخ‌گویی به نظرات ثبت‌شده کاربران"
        count={pagination.total}
        actions={
          <Button icon={<ReloadOutlined spin={loading} />} onClick={() => fetchReviews()}>
            به‌روزرسانی
          </Button>
        }
      />

      <div className="kpi-grid-3">
        <StatTile label="کل نظرات" value={formatNumber(stats.total)} icon={<MessageOutlined />} tone="brand" />
        <StatTile label="در انتظار تأیید" value={formatNumber(stats.pending)} icon={<ExclamationCircleOutlined />} tone={stats.pending > 0 ? 'warn' : 'ok'} />
        <StatTile label="میانگین امتیاز (صفحه)" value={`${stats.avgRating} از ۵`} icon={<StarFilled />} tone="info" />
      </div>

      <div className="filter-bar">
        <Select
          style={{ width: 200, maxWidth: '100%' }}
          placeholder="فیلتر وضعیت"
          allowClear
          value={filters.isApproved}
          onChange={(val) => setFilters({ ...filters, isApproved: val ?? null })}
        >
          <Select.Option value={true}>تأیید شده</Select.Option>
          <Select.Option value={false}>در انتظار تأیید</Select.Option>
        </Select>
      </div>

      <Card>
        <ResponsiveTable
          columns={columns}
          dataSource={reviews}
          rowKey="_id"
          loading={loading}
          pagination={pagination}
          onChange={(pag) => {
            setPagination((prev) => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))
            fetchReviews(pag.current, pag.pageSize)
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <MessageOutlined />
            <span>جزئیات نظر</span>
            {selectedReview && (
              <StatusPill
                size="sm"
                tone={selectedReview.isApproved ? 'ok' : 'warn'}
                label={selectedReview.isApproved ? 'تأیید شده' : 'در انتظار تأیید'}
              />
            )}
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={[
          canDelete && (
            <Button
              key="delete"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(selectedReview._id)}
            >
              حذف
            </Button>
          ),
          canModerate &&
            (!selectedReview?.isApproved ? (
              <Button
                key="approve"
                type="primary"
                style={{ backgroundColor: '#0f6b33', borderColor: '#0f6b33' }}
                icon={<CheckOutlined />}
                loading={actionLoading}
                onClick={() => handleStatusUpdate(selectedReview._id, true)}
              >
                تأیید نظر
              </Button>
            ) : (
              <Button
                key="reject"
                danger
                icon={<CloseOutlined />}
                loading={actionLoading}
                onClick={() => handleStatusUpdate(selectedReview._id, false)}
              >
                رد کردن
              </Button>
            )),
          <Button key="close" onClick={() => setModalVisible(false)}>
            بستن
          </Button>,
        ]}
      >
        {selectedReview && (
          <Row gutter={[20, 16]}>
            <Col xs={24} md={14}>
              <Card type="inner" title="متن نظر" size="small" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Rate disabled value={selectedReview.rating} style={{ fontSize: 14 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatPersianDate(selectedReview.createdAt, true)}
                  </Text>
                </div>
                <Paragraph style={{ fontSize: 14.5, lineHeight: 1.7 }}>
                  {selectedReview.comment}
                </Paragraph>
              </Card>

              <Card type="inner" title="پاسخ ادمین" size="small">
                <TextArea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="پاسخ خود را اینجا بنویسید..."
                  style={{ marginBottom: 12 }}
                  disabled={!canReply}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  {selectedReview.adminReply?.repliedAt && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      آخرین پاسخ: {formatPersianDate(selectedReview.adminReply.repliedAt, true)}
                    </Text>
                  )}
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleReplySubmit}
                    loading={replyLoading}
                    disabled={!canReply}
                  >
                    ثبت پاسخ
                  </Button>
                </div>
              </Card>
            </Col>

            <Col xs={24} md={10}>
              <Card size="small" style={{ marginBottom: 16, textAlign: 'center' }}>
                <Avatar size={60} style={{ backgroundColor: 'var(--brand-600)', marginBottom: 10 }}>
                  {selectedReview.user?.name?.[0]}
                </Avatar>
                <Title level={5} style={{ margin: 0 }}>
                  {selectedReview.user?.name || 'ناشناس'}
                </Title>
                <Text type="secondary">{selectedReview.user?.email || selectedReview.user?.mobile || '—'}</Text>
              </Card>

              <Card size="small" title="محصول مرتبط">
                <div style={{ textAlign: 'center' }}>
                  <Image
                    width={110}
                    src={
                      typeof selectedReview.product?.images?.[0] === 'string'
                        ? selectedReview.product.images[0]
                        : selectedReview.product?.images?.[0]?.url
                    }
                    fallback="https://via.placeholder.com/150"
                    style={{ borderRadius: 8, marginBottom: 8 }}
                  />
                  <Paragraph ellipsis={{ rows: 2 }} strong style={{ marginBottom: 0 }}>
                    {selectedReview.product?.name}
                  </Paragraph>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    کد محصول: {selectedReview.product?.sku || selectedReview.product?._id}
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>
        )}
      </Modal>
    </div>
  )
}

export default ReviewsPage
