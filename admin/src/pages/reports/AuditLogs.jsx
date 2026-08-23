import { useEffect, useState } from 'react'
import { Table, Card, Tag, Button, Space } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'

dayjs.extend(jalaliday)
dayjs.calendar('jalali')

function AuditLogs() {
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(false)
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
        total: 0,
    })

    const fetchLogs = async (page = pagination.current, pageSize = pagination.pageSize) => {
        setLoading(true)
        try {
            const res = await api.get(`/audit-logs?page=${page}&limit=${pageSize}`)
            const list = res?.data?.data || []
            const pg = res?.data?.pagination

            setLogs(list)
            if (pg) {
                setPagination({
                    current: pg.currentPage,
                    pageSize: pageSize,
                    total: pg.totalItems,
                })
            }
        } catch (err) {
            console.error('Error fetching audit logs:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLogs()
    }, [])

    const columns = [
        {
            title: 'کاربر',
            dataIndex: ['user', 'name'],
            key: 'user',
            render: (name, record) => (
                <Space direction="vertical" size={0}>
                    <span style={{ fontWeight: 'bold' }}>{name || 'سیستم'}</span>
                    <span style={{ fontSize: '0.8em', color: '#888' }}>{record.user?.email}</span>
                </Space>
            ),
        },
        {
            title: 'عملیات',
            dataIndex: 'action',
            key: 'action',
            render: (action) => <Tag color="blue">{action}</Tag>,
        },
        {
            title: 'موجودیت',
            key: 'entity',
            render: (_, record) => (
                <span>
                    {record.entity} <span style={{ fontFamily: 'monospace', color: '#888' }}>#{record.entityId?.slice(-6)}</span>
                </span>
            ),
        },
        {
            title: 'جزئیات',
            dataIndex: 'details',
            key: 'details',
            render: (details) => (
                <div style={{ fontSize: '0.85em', color: '#555', maxWidth: 300 }}>
                    {details ? JSON.stringify(details).slice(0, 50) + (JSON.stringify(details).length > 50 ? '...' : '') : '-'}
                </div>
            ),
        },
        {
            title: 'IP',
            dataIndex: 'ip',
            key: 'ip',
            render: (ip) => <span style={{ fontFamily: 'monospace' }}>{ip || '-'}</span>,
        },
        {
            title: 'تاریخ',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => dayjs(date).calendar('jalali').locale('fa').format('YYYY/MM/DD HH:mm'),
        },
    ]

    const onTableChange = (pag) => {
        fetchLogs(pag.current, pag.pageSize)
    }

    return (
        <div>
            <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
marginBottom: 16,
        }}>
                <h1>گزارش عملکرد سیستم (Audit Logs)</h1>
                <Button icon={<ReloadOutlined />} onClick={() => fetchLogs(1, pagination.pageSize)}>
                    بروزرسانی
                </Button>
            </div>

            <Card>
                <Table
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
                    }}
                    onChange={onTableChange}
                />
            </Card>
        </div>
    )
}

export default AuditLogs
