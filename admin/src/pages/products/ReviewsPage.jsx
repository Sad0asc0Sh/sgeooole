import { useEffect, useState } from 'react'
import {
  Card,
  Table,
  Tag,
  Select,
  Space,
  Button,
  Popconfirm,
  message,
  Rate,
  Typography,
  Form,
  Input,
  Divider,
  Modal,
  Statistic,
  Row,
  Col,
  Avatar,
  Tooltip,
  Image
} from 'antd'
import ResponsiveTable from '../../components/ResponsiveTable'
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
  ExclamationCircleOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'
import { PERMISSIONS } from '../../rbac/permissions'
import { useCan } from '../../rbac/useCan'

dayjs.extend(jalaliday)
dayjs.calendar('jalali')

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const formatPersianDate = (date, includeTime = false) => {
  if (!date) return '-'
  const jalaliDate = dayjs(date).calendar('jalali').locale('fa')
  const year = jalaliDate.format('YYYY')
  const month = jalaliDate.format('MM')
  const day = jalaliDate.format('DD')

  if (includeTime) {
    const time = jalaliDate.format('HH:mm')
    return `${year}/${month}/${day} - ${time}`
  }
  return `${year}/${month}/${day}`
}

function ReviewsPage() {
  const { can } = useCan()
  const canModerate = can(PERMISSIONS.REVIEW_MODERATE)
  const canReply = can(PERMISSIONS.REVIEW_REPLY)
  const canDelete = can(PERMISSIONS.REVIEW_DELETE)

  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ isApproved: null })
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  // Stats
  const [stats, setStats] = useState({ total: 0, pending: 0, avgRating: 0 })

  // Modal State
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

      if (filters.isApproved !== null) {
        params.set('isApproved', String(filters.isApproved))
      }

      const res = await api.get('/reviews/admin', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination

      setReviews(list)
      if (pg) {
        setPagination({
          current: pg.currentPage || page,
          pageSize: pg.itemsPerPage || pageSize,
          total: pg.totalItems || list.length,
        })
        // Update stats roughly based on current fetch (ideal would be separate API)
        setStats({
          total: pg.totalItems || 0,
          pending: filters.isApproved === false ? pg.totalItems : '-', // Placeholder
          avgRating: 4.8 // Placeholder
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

  const handleStatusUpdate = async (reviewId, isApproved) => {
    if (!canModerate) {
      message.error('شما مجوز تغییر وضعیت نظرات را ندارید.')
      return
    }

    setActionLoading(true)
    try {
      await api.put(`/reviews/${reviewId}/status`, { isApproved })
      message.success('وضعیت نظر به‌روزرسانی شد')

      // Update local state
      setReviews(prev => prev.map(r => r._id === reviewId ? { ...r, isApproved } : r))
      if (selectedReview && selectedReview._id === reviewId) {
        setSelectedReview(prev => ({ ...prev, isApproved }))
      }

      // If filtering by status, refresh might be needed, but local update is smoother
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
        adminReply: { message: replyText.trim(), repliedAt: new Date().toISOString() }
      }

      setReviews(prev => prev.map(r => r._id === selectedReview._id ? updatedReview : r))
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
      render: (name, record) => (
        <Space>
          <Avatar
            shape="square"
            size={48}
            src={record.product?.images?.[0]}
            icon={<ShoppingOutlined />}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text strong style={{ maxWidth: 180 }} ellipsis={{ tooltip: name }}>
              {name || 'محصول حذف شده'}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              کد: {record.product?.sku || record.product?._id?.substring(0, 8) || '-'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'کاربر',
      dataIndex: ['user', 'name'],
      key: 'user',
      width: 200,
      render: (name, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#f56a00' }}>
            {name?.[0]}
          </Avatar>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text strong>{name || 'ناشناس'}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.user?.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'امتیاز',
      dataIndex: 'rating',
      key: 'rating',
      width: 150,
      align: 'center',
      render: (rating) => <Rate disabled defaultValue={rating} style={{ fontSize: 14 }} />,
    },
    {
      title: 'وضعیت',
      mobileBadge: true,
      dataIndex: 'isApproved',
      key: 'isApproved',
      width: 120,
      align: 'center',
      render: (isApproved) => (
        <Tag color={isApproved ? 'success' : 'warning'} icon={isApproved ? <CheckOutlined /> : <ExclamationCircleOutlined />}>
          {isApproved ? 'تأیید شده' : 'در انتظار'}
        </Tag>
      ),
    },
    {
      title: 'تاریخ',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      align: 'center',
      render: (date) => <Text type="secondary">{formatPersianDate(date)}</Text>,
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="مشاهده جزئیات و مدیریت">
          <Button
            type="primary"
            shape="circle"
            icon={<EyeOutlined />}
            onClick={() => openModal(record)}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>مدیریت نظرات</Title>
          <Text type="secondary">بررسی و پاسخ‌دهی به نظرات کاربران</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => fetchReviews()}>بروزرسانی</Button>
      </div>

      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card bordered={false}>
            <Statistic
              title="کل نظرات"
              value={pagination.total}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false}>
            <Statistic
              title="در انتظار بررسی"
              value={filters.isApproved === false ? pagination.total : '-'} // Approximate
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false}>
            <Statistic
              title="میانگین امتیاز"
              value={4.8}
              precision={1}
              prefix={<StarFilled style={{ color: '#fadb14' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter & Table */}
      <Card bordered={false} className="shadow-sm">
        <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
          <Select
            style={{ width: 200, maxWidth: '100%' }}
            placeholder="فیلتر وضعیت"
            allowClear
            value={filters.isApproved}
            onChange={(val) => setFilters({ ...filters, isApproved: val })}
          >
            <Select.Option value={true}>تأیید شده</Select.Option>
            <Select.Option value={false}>در انتظار تأیید</Select.Option>
          </Select>
        </div>

        <ResponsiveTable
          columns={columns}
          dataSource={reviews}
          rowKey="_id"
          loading={loading}
          pagination={pagination}
          onChange={(pag) => {
            setPagination(prev => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))
            fetchReviews(pag.current, pag.pageSize)
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={
          <Space>
            <MessageOutlined />
            <span>جزئیات نظر</span>
            {selectedReview?.isApproved ?
              <Tag color="success">تأیید شده</Tag> :
              <Tag color="warning">در انتظار تأیید</Tag>
            }
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={[
          canDelete && (
            <Button key="delete" danger icon={<DeleteOutlined />} onClick={() => handleDelete(selectedReview._id)}>
              حذف
            </Button>
          ),
          canModerate && (
            !selectedReview?.isApproved ? (
              <Button
                key="approve"
                type="primary"
                style={{ backgroundColor: '#52c41a' }}
                icon={<CheckOutlined />}
                loading={actionLoading}
                onClick={() => handleStatusUpdate(selectedReview._id, true)}
              >
                تأیید نظر
              </Button>
            ) : (
              <Button
                key="reject"
                type="default"
                danger
                icon={<CloseOutlined />}
                loading={actionLoading}
                onClick={() => handleStatusUpdate(selectedReview._id, false)}
              >
                رد کردن
              </Button>
            )
          ),
          <Button key="close" onClick={() => setModalVisible(false)}>
            بستن
          </Button>
        ]}
      >
        {selectedReview && (
          <Row gutter={24}>
            {/* Left: Review & Reply */}
            <Col span={14}>
              <Card type="inner" title="متن نظر" size="small" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Rate disabled value={selectedReview.rating} style={{ fontSize: 14 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatPersianDate(selectedReview.createdAt, true)}
                  </Text>
                </div>
                <Paragraph style={{ fontSize: 15, lineHeight: 1.6 }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

            {/* Right: Info */}
            <Col span={10}>
              <Card size="small" style={{ marginBottom: 16, textAlign: 'center' }}>
                <Avatar size={64} style={{ backgroundColor: '#f56a00', marginBottom: 12 }}>
                  {selectedReview.user?.name?.[0]}
                </Avatar>
                <Title level={5} style={{ margin: 0 }}>{selectedReview.user?.name}</Title>
                <Text type="secondary">{selectedReview.user?.email}</Text>
              </Card>

              <Card size="small" title="محصول مرتبط">
                <div style={{ textAlign: 'center' }}>
                  <Image
                    width={120}
                    src={selectedReview.product?.images?.[0]}
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
