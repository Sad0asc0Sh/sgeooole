import { useState, useEffect, useCallback } from 'react'
import {
    Card,
    Table,
    Button,
    Space,
    Tag,
    message,
    Modal,
    Statistic,
    Row,
    Col,
    Input,
    Select,
    Tooltip,
    Typography,
    Empty,
    Popconfirm,
} from 'antd'
import {
    MailOutlined,
    DeleteOutlined,
    DownloadOutlined,
    ReloadOutlined,
    SearchOutlined,
    UserAddOutlined,
    UserDeleteOutlined,
    CheckCircleOutlined,
    StopOutlined,
} from '@ant-design/icons'
import api from '../../api'

const { Title, Text } = Typography
const { Search } = Input

function NewsletterPage() {
    const [subscribers, setSubscribers] = useState([])
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 })
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
        total: 0,
    })
    const [filters, setFilters] = useState({
        active: undefined,
        search: '',
    })

    const fetchSubscribers = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.set('page', pagination.current)
            params.set('limit', pagination.pageSize)
            if (filters.active !== undefined) {
                params.set('active', filters.active)
            }

            const res = await api.get(`/newsletter/subscribers?${params.toString()}`)

            if (res.data?.success) {
                setSubscribers(res.data.data || [])
                setPagination(prev => ({
                    ...prev,
                    total: res.data.pagination?.total || 0,
                }))
                setStats(res.data.stats || { total: 0, active: 0, inactive: 0 })
            }
        } catch (error) {
            console.error('Error fetching subscribers:', error)
            message.error('خطا در دریافت لیست مشترکین')
        } finally {
            setLoading(false)
        }
    }, [pagination.current, pagination.pageSize, filters.active])

    useEffect(() => {
        fetchSubscribers()
    }, [fetchSubscribers])

    const handleDelete = async (id) => {
        try {
            await api.delete(`/newsletter/subscribers/${id}`)
            message.success('مشترک با موفقیت حذف شد')
            fetchSubscribers()
        } catch (error) {
            console.error('Error deleting subscriber:', error)
            message.error('خطا در حذف مشترک')
        }
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            const params = new URLSearchParams()
            if (filters.active !== undefined) {
                params.set('active', filters.active)
            }

            const res = await api.get(`/newsletter/export?${params.toString()}`, {
                responseType: 'blob',
            })

            // Create download link
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `newsletter-subscribers-${Date.now()}.csv`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)

            message.success('فایل با موفقیت دانلود شد')
        } catch (error) {
            console.error('Error exporting:', error)
            message.error('خطا در خروجی گرفتن')
        } finally {
            setExporting(false)
        }
    }

    const handleTableChange = (paginationConfig) => {
        setPagination(prev => ({
            ...prev,
            current: paginationConfig.current,
            pageSize: paginationConfig.pageSize,
        }))
    }

    const columns = [
        {
            title: 'ایمیل',
            dataIndex: 'email',
            key: 'email',
            render: (email) => (
                <Space>
                    <MailOutlined style={{ color: '#1890ff' }} />
                    <Text copyable={{ text: email }} style={{ direction: 'ltr' }}>
                        {email}
                    </Text>
                </Space>
            ),
        },
        {
            title: 'وضعیت',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 120,
            render: (isActive) => (
                <Tag
                    icon={isActive ? <CheckCircleOutlined /> : <StopOutlined />}
                    color={isActive ? 'success' : 'default'}
                >
                    {isActive ? 'فعال' : 'غیرفعال'}
                </Tag>
            ),
        },
        {
            title: 'منبع',
            dataIndex: 'source',
            key: 'source',
            width: 100,
            render: (source) => {
                const sourceLabels = {
                    footer: 'فوتر',
                    popup: 'پاپ‌آپ',
                    checkout: 'پرداخت',
                    admin: 'ادمین',
                }
                return <Tag>{sourceLabels[source] || source}</Tag>
            },
        },
        {
            title: 'تاریخ عضویت',
            dataIndex: 'subscribedAt',
            key: 'subscribedAt',
            width: 180,
            render: (date) => {
                if (!date) return '-'
                return new Date(date).toLocaleDateString('fa-IR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                })
            },
        },
        {
            title: 'عملیات',
            key: 'actions',
            width: 100,
            render: (_, record) => (
                <Popconfirm
                    title="حذف مشترک"
                    description="آیا از حذف این مشترک اطمینان دارید؟"
                    onConfirm={() => handleDelete(record._id)}
                    okText="حذف"
                    cancelText="لغو"
                    okButtonProps={{ danger: true }}
                >
                    <Tooltip title="حذف">
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                        />
                    </Tooltip>
                </Popconfirm>
            ),
        },
    ]

    return (
        <div style={{ padding: 24 }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
                    <MailOutlined style={{ marginLeft: 12 }} />
                    مدیریت خبرنامه
                </Title>
                <Text type="secondary">
                    مشاهده و مدیریت مشترکین خبرنامه
                </Text>
            </div>

            {/* Stats Cards */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="کل مشترکین"
                            value={stats.total}
                            prefix={<MailOutlined />}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="فعال"
                            value={stats.active}
                            prefix={<UserAddOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="لغو شده"
                            value={stats.inactive}
                            prefix={<UserDeleteOutlined />}
                            valueStyle={{ color: '#8c8c8c' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Filters & Actions */}
            <Card style={{ marginBottom: 24 }}>
                <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space wrap>
                        <Select
                            placeholder="وضعیت"
                            style={{ width: 150 }}
                            allowClear
                            value={filters.active}
                            onChange={(value) => {
                                setFilters(prev => ({ ...prev, active: value }))
                                setPagination(prev => ({ ...prev, current: 1 }))
                            }}
                            options={[
                                { label: 'همه', value: undefined },
                                { label: 'فعال', value: 'true' },
                                { label: 'غیرفعال', value: 'false' },
                            ]}
                        />
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={fetchSubscribers}
                            loading={loading}
                        >
                            بارگذاری مجدد
                        </Button>
                    </Space>

                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleExport}
                        loading={exporting}
                        style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    >
                        خروجی Excel
                    </Button>
                </Space>
            </Card>

            {/* Table */}
            <Card>
                <Table
                    columns={columns}
                    dataSource={subscribers}
                    rowKey="_id"
                    loading={loading}
                    pagination={{
                        ...pagination,
                        showSizeChanger: true,
                        showTotal: (total, range) => `${range[0]}-${range[1]} از ${total} مشترک`,
                        pageSizeOptions: ['10', '20', '50', '100'],
                    }}
                    onChange={handleTableChange}
                    locale={{
                        emptyText: (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description="هنوز مشترکی ثبت نشده است"
                            />
                        ),
                    }}
                />
            </Card>
        </div>
    )
}

export default NewsletterPage
