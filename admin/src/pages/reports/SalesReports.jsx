import { useEffect, useState } from 'react'
import { Card, DatePicker, Row, Col, Statistic, Spin, message } from 'antd'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader'

const { RangePicker } = DatePicker

dayjs.extend(jalaliday)
dayjs.calendar('jalali')

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

const formatPersianDate = (value, granularity = 'day') => {
  if (!value) return '-'

  const baseDate = dayjs(value)
  if (!baseDate.isValid()) return '-'

  const jalaliDate = baseDate.calendar('jalali').locale('fa')
  const year = jalaliDate.format('YYYY')
  const monthIndex = parseInt(jalaliDate.format('M'), 10) - 1
  const month = persianMonths[monthIndex] || jalaliDate.format('MM')

  if (granularity === 'month') {
    return `${month} ${year}`
  }

  const day = jalaliDate.format('DD')
  return `${day} ${month} ${year}`
}

function SalesReports() {
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState([])
  const [summary, setSummary] = useState({
    totalSales: 0,
    ordersCount: 0,
  })
  const [series, setSeries] = useState([])
  const [granularity, setGranularity] = useState('day')

  const fetchReports = async (params = {}) => {
    setLoading(true)
    try {
      const res = await api.get('/reports/sales', { params })
      const data = res?.data?.data || {}

      setSummary({
        totalSales: data.summary?.totalSales || 0,
        ordersCount: data.summary?.ordersCount || 0,
      })
      setSeries(Array.isArray(data.series) ? data.series : [])
      setGranularity(data.granularity === 'month' ? 'month' : 'day')
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'خطا در دریافت گزارش فروش'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const handleRangeChange = (values) => {
    setRange(values || [])

    if (!values || values.length !== 2) {
      fetchReports()
      return
    }

    const [start, end] = values
    fetchReports({
      startDate: start?.toISOString(),
      endDate: end?.toISOString(),
    })
  }

  return (
    <div>
      <PageHeader
         title="گزارش فروش"
         actions={
           <>
<RangePicker
                       value={range}
                       onChange={handleRangeChange}
                       allowClear
                       style={{ maxWidth: 320 }}
                     />
           </>
         }
       />

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Card>
              <Statistic
                title="مجموع فروش (پرداخت‌شده)"
                value={summary.totalSales}
                precision={0}
                valueStyle={{ color: '#3f8600' }}
                suffix="تومان"
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card>
              <Statistic
                title="تعداد سفارش‌ها"
                value={summary.ordersCount}
                valueStyle={{ color: '#b45309' }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="نمودار فروش">
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="bucket"
                  tickFormatter={(value) => formatPersianDate(value, granularity)}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => formatPersianDate(value, granularity)}
                />
                <Line
                  type="monotone"
                  dataKey="totalSales"
                  stroke="#b45309"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Spin>
    </div>
  )
}

export default SalesReports

