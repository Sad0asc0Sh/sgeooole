import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Descriptions,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Upload,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  InboxOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UnlockOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import api from '../../api'
import { useAuthStore, useBrandStore, useCategoryStore } from '../../stores'
import { formatNumber } from '../../utils/formatters'
import { formatPersianDate, formatRelativeTime } from '../../utils/dateUtils'
import StatTile from '../ui/StatTile'
import StatusPill from '../ui/StatusPill'
import EmptyState from '../ui/EmptyState'
import ResponsiveTable from '../ResponsiveTable'
import './BackupSection.css'

const { Dragger } = Upload

const WEEKDAY_OPTIONS = [
  { value: 6, label: 'شنبه' },
  { value: 0, label: 'یکشنبه' },
  { value: 1, label: 'دوشنبه' },
  { value: 2, label: 'سه‌شنبه' },
  { value: 3, label: 'چهارشنبه' },
  { value: 4, label: 'پنج‌شنبه' },
  { value: 5, label: 'جمعه' },
]

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: `${String(hour).padStart(2, '0')}:۰۰ (به‌وقت تهران)`,
}))

const TRIGGER_META = {
  manual: { label: 'دستی', tone: 'info' },
  auto: { label: 'خودکار', tone: 'ok' },
  'pre-restore': { label: 'ایمنی پیش از بازیابی', tone: 'warn' },
  cli: { label: 'خط فرمان (CLI)', tone: 'neutral' },
}

function formatBytes(bytes) {
  const n = Number(bytes || 0)
  if (!Number.isFinite(n) || n <= 0) return '۰ بایت'
  if (n < 1024) return `${formatNumber(n)} بایت`
  if (n < 1024 * 1024) return `${formatNumber((n / 1024).toFixed(1))} کیلوبایت`
  if (n < 1024 * 1024 * 1024) return `${formatNumber((n / (1024 * 1024)).toFixed(2))} مگابایت`
  return `${formatNumber((n / (1024 * 1024 * 1024)).toFixed(2))} گیگابایت`
}

function extractFilenameFromHeaders(headers, fallbackName) {
  const headerName = headers?.['x-backup-filename']
  if (headerName) return headerName
  const disposition = headers?.['content-disposition'] || ''
  const match = /filename="?([^";]+)"?/i.exec(disposition)
  return match ? match[1] : fallbackName
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}

async function extractErrorMessage(err, fallback) {
  const data = err?.response?.data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const parsed = JSON.parse(text)
      if (parsed?.message) return parsed.message
    } catch {
      // ignore blob parse error
    }
  }
  return err?.response?.data?.message || err?.userMessage || err?.message || fallback
}

export default function BackupSection({ embedded = false }) {
  const logout = useAuthStore((s) => s.logout)
  const fetchCategoriesTree = useCategoryStore((s) => s.fetchCategoriesTree)
  const fetchBrands = useBrandStore((s) => s.fetchBrands)

  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState(null)
  const [serverBackups, setServerBackups] = useState([])
  const [scheduleForm, setScheduleForm] = useState({
    autoBackupEnabled: false,
    frequency: 'daily',
    hour: 3,
    dayOfWeek: 5,
    retentionCount: 7,
    lastAutoBackupAt: null,
    lastAutoBackupStatus: null,
    lastAutoBackupFile: null,
    lastAutoBackupError: null,
    lastManualBackupAt: null,
  })

  // Backup creation controls
  const [backupNote, setBackupNote] = useState('')
  const [encryptBackup, setEncryptBackup] = useState(false)
  const [backupPassword, setBackupPassword] = useState('')
  const [backupPasswordConfirm, setBackupPasswordConfirm] = useState('')
  const [saveOnServer, setSaveOnServer] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [creatingServer, setCreatingServer] = useState(false)
  const [downloadingName, setDownloadingName] = useState(null)
  const [savingSchedule, setSavingSchedule] = useState(false)

  // Inspect / Restore controls
  const [inspectingUpload, setInspectingUpload] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [inspectingServerName, setInspectingServerName] = useState(null)
  const [passwordPrompt, setPasswordPrompt] = useState({
    open: false,
    stagedToken: null,
    serverFilename: null,
    filename: '',
    password: '',
    submitting: false,
  })
  const [restoreModal, setRestoreModal] = useState({
    open: false,
    restoreToken: null,
    filename: '',
    sizeBytes: 0,
    inspection: null,
    password: '',
    confirmPhrase: '',
    createSafetyBackup: true,
    dropUnlistedCollections: true,
    restoring: false,
  })
  const [restoreResult, setRestoreResult] = useState(null)

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/backup/overview')
      const data = res?.data?.data || {}
      setOverview(data.overview || null)
      setServerBackups(Array.isArray(data.serverBackups) ? data.serverBackups : [])
      if (data.backupSettings) {
        setScheduleForm((prev) => ({ ...prev, ...data.backupSettings }))
      }
    } catch (err) {
      const msg = await extractErrorMessage(err, 'خطا در دریافت اطلاعات بکاپ و بازیابی')
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  const readiness = useMemo(() => {
    const latest = serverBackups[0]?.createdAt || scheduleForm.lastManualBackupAt || scheduleForm.lastAutoBackupAt
    if (!latest) {
      return {
        tone: 'warn',
        title: 'هنوز هیچ نسخه پشتیبانی روی سرور ثبت نشده است',
        sub: 'توصیه می‌شود همین الان یک بکاپ کامل تهیه و دانلود کنید تا در صورت بروز حادثه تمام داده‌ها قابل بازگشت باشند.',
      }
    }
    const ageDays = (Date.now() - new Date(latest).getTime()) / (1000 * 60 * 60 * 24)
    if (ageDays > 7) {
      return {
        tone: 'warn',
        title: `آخرین بکاپ مربوط به ${formatRelativeTime(latest)} است`,
        sub: 'بیش از ۷ روز از آخرین بکاپ گذشته است. برای حفظ آخرین تغییرات محصولات و سفارش‌ها بکاپ جدید تهیه کنید.',
      }
    }
    return {
      tone: 'ok',
      title: `وضعیت بکاپ‌گیری به‌روز است (${formatRelativeTime(latest)})`,
      sub: `${formatNumber(serverBackups.length)} نسخه پشتیبان در آرشیو سرور آماده بازیابی فوری وجود دارد.`,
    }
  }, [serverBackups, scheduleForm.lastAutoBackupAt, scheduleForm.lastManualBackupAt])

  const validateCreatePassword = () => {
    if (!encryptBackup) return true
    if (!backupPassword || backupPassword.length < 6) {
      message.warning('رمز عبور فایل بکاپ باید حداقل ۶ کاراکتر باشد')
      return false
    }
    if (backupPassword !== backupPasswordConfirm) {
      message.warning('رمز عبور و تکرار آن یکسان نیستند')
      return false
    }
    return true
  }

  const resetPasswordInputs = () => {
    setBackupPassword('')
    setBackupPasswordConfirm('')
  }

  const handleExportAndDownload = async () => {
    if (!validateCreatePassword()) return
    setExporting(true)
    try {
      const res = await api.post(
        '/backup/export',
        {
          password: encryptBackup ? backupPassword : '',
          note: backupNote,
          saveOnServer,
        },
        {
          responseType: 'blob',
          timeout: 10 * 60 * 1000,
        },
      )
      const fallbackExt = encryptBackup ? 'ekg.enc' : 'ekg.gz'
      const filename = extractFilenameFromHeaders(
        res.headers,
        `ekgkala-manual.${fallbackExt}`,
      )
      triggerBlobDownload(res.data, filename)
      message.success('فایل بکاپ کامل با موفقیت ساخته و دانلود شد')
      resetPasswordInputs()
      setBackupNote('')
      if (saveOnServer) {
        fetchOverview()
      }
    } catch (err) {
      const msg = await extractErrorMessage(err, 'خطا در تهیه و دانلود فایل بکاپ')
      message.error(msg)
    } finally {
      setExporting(false)
    }
  }

  const handleCreateOnServer = async () => {
    if (!validateCreatePassword()) return
    setCreatingServer(true)
    try {
      const res = await api.post(
        '/backup/create',
        {
          password: encryptBackup ? backupPassword : '',
          note: backupNote,
        },
        { timeout: 10 * 60 * 1000 },
      )
      message.success(res?.data?.message || 'نسخه پشتیبان روی سرور ذخیره شد')
      resetPasswordInputs()
      setBackupNote('')
      fetchOverview()
    } catch (err) {
      const msg = await extractErrorMessage(err, 'خطا در ذخیره بکاپ روی سرور')
      message.error(msg)
    } finally {
      setCreatingServer(false)
    }
  }

  const handleDownloadServerBackup = async (filename) => {
    setDownloadingName(filename)
    try {
      const res = await api.get(
        `/backup/server/${encodeURIComponent(filename)}/download`,
        {
          responseType: 'blob',
          timeout: 10 * 60 * 1000,
        },
      )
      triggerBlobDownload(res.data, filename)
      message.success('دانلود فایل بکاپ آغاز شد')
    } catch (err) {
      const msg = await extractErrorMessage(err, 'خطا در دانلود فایل بکاپ')
      message.error(msg)
    } finally {
      setDownloadingName(null)
    }
  }

  const handleDeleteServerBackup = async (filename) => {
    try {
      await api.delete(`/backup/server/${encodeURIComponent(filename)}`)
      message.success('فایل بکاپ از سرور حذف شد')
      fetchOverview()
    } catch (err) {
      const msg = await extractErrorMessage(err, 'خطا در حذف فایل بکاپ')
      message.error(msg)
    }
  }

  const openRestoreModalFromPayload = (payload, password = '') => {
    setRestoreModal({
      open: true,
      restoreToken: payload.restoreToken,
      filename: payload.filename,
      sizeBytes: payload.sizeBytes || 0,
      inspection: payload.inspection,
      password,
      confirmPhrase: '',
      createSafetyBackup: true,
      dropUnlistedCollections: true,
      restoring: false,
    })
  }

  const handleInspectUpload = async (file) => {
    const lower = String(file?.name || '').toLowerCase()
    if (!lower.endsWith('.ekg.gz') && !lower.endsWith('.ekg.enc')) {
      message.error('لطفاً فقط فایل بکاپ معتبر با پسوند .ekg.gz یا .ekg.enc انتخاب کنید')
      return
    }

    const formData = new FormData()
    formData.append('backup', file)

    setInspectingUpload(true)
    setUploadPercent(0)
    try {
      const res = await api.post('/backup/inspect', formData, {
        timeout: 10 * 60 * 1000,
        onUploadProgress: (evt) => {
          if (evt.total) {
            setUploadPercent(Math.min(100, Math.round((evt.loaded / evt.total) * 100)))
          }
        },
      })

      const data = res?.data || {}
      if (data.requiresPassword) {
        setPasswordPrompt({
          open: true,
          stagedToken: data.stagedToken,
          serverFilename: null,
          filename: data.filename || file.name,
          password: '',
          submitting: false,
        })
      } else {
        openRestoreModalFromPayload(data, '')
      }
    } catch (err) {
      const msg = await extractErrorMessage(err, 'فایل بکاپ معتبر نیست یا آسیب دیده است')
      message.error(msg)
    } finally {
      setInspectingUpload(false)
      setUploadPercent(0)
    }
  }

  const handleInspectServerBackup = async (filename) => {
    setInspectingServerName(filename)
    try {
      const res = await api.post(
        '/backup/inspect-staged',
        { serverFilename: filename },
        { timeout: 10 * 60 * 1000 },
      )
      const data = res?.data || {}
      if (data.requiresPassword) {
        setPasswordPrompt({
          open: true,
          stagedToken: null,
          serverFilename: filename,
          filename,
          password: '',
          submitting: false,
        })
      } else {
        openRestoreModalFromPayload(data, '')
      }
    } catch (err) {
      const msg = await extractErrorMessage(err, 'خطا در بررسی فایل بکاپ')
      message.error(msg)
    } finally {
      setInspectingServerName(null)
    }
  }

  const handleSubmitPasswordPrompt = async () => {
    if (!passwordPrompt.password) {
      message.warning('لطفاً رمز عبور فایل بکاپ را وارد کنید')
      return
    }
    setPasswordPrompt((p) => ({ ...p, submitting: true }))
    try {
      const res = await api.post(
        '/backup/inspect-staged',
        {
          stagedToken: passwordPrompt.stagedToken || undefined,
          serverFilename: passwordPrompt.serverFilename || undefined,
          password: passwordPrompt.password,
        },
        { timeout: 10 * 60 * 1000 },
      )
      const enteredPassword = passwordPrompt.password
      setPasswordPrompt({
        open: false,
        stagedToken: null,
        serverFilename: null,
        filename: '',
        password: '',
        submitting: false,
      })
      openRestoreModalFromPayload(res.data, enteredPassword)
    } catch (err) {
      const msg = await extractErrorMessage(err, 'رمز عبور اشتباه است یا فایل معتبر نیست')
      message.error(msg)
      setPasswordPrompt((p) => ({ ...p, submitting: false }))
    }
  }

  const handleExecuteRestore = async () => {
    const trimmed = String(restoreModal.confirmPhrase || '').trim()
    if (trimmed !== 'بازیابی' && trimmed.toUpperCase() !== 'RESTORE') {
      message.warning('برای تایید نهایی عبارت «بازیابی» را تایپ کنید')
      return
    }

    setRestoreModal((m) => ({ ...m, restoring: true }))
    try {
      const res = await api.post(
        '/backup/restore',
        {
          restoreToken: restoreModal.restoreToken,
          confirmPhrase: trimmed,
          password: restoreModal.password,
          createSafetyBackup: restoreModal.createSafetyBackup,
          dropUnlistedCollections: restoreModal.dropUnlistedCollections,
        },
        { timeout: 15 * 60 * 1000 },
      )

      const resultData = res?.data?.data || {}
      setRestoreModal((m) => ({ ...m, open: false, restoring: false }))
      setRestoreResult(resultData)
      message.success('بازیابی کامل دیتابیس با موفقیت انجام شد')

      // Refresh global admin stores & settings listeners
      window.dispatchEvent(new Event('settings:updated'))
      await Promise.allSettled([fetchCategoriesTree(), fetchBrands(), fetchOverview()])
    } catch (err) {
      const msg = await extractErrorMessage(err, 'خطا در بازیابی دیتابیس')
      message.error(msg)
      setRestoreModal((m) => ({ ...m, restoring: false }))
    }
  }

  const handleSaveSchedule = async () => {
    setSavingSchedule(true)
    try {
      const res = await api.put('/backup/settings', {
        autoBackupEnabled: scheduleForm.autoBackupEnabled,
        frequency: scheduleForm.frequency,
        hour: scheduleForm.hour,
        dayOfWeek: scheduleForm.dayOfWeek,
        retentionCount: scheduleForm.retentionCount,
      })
      if (res?.data?.data) {
        setScheduleForm((prev) => ({ ...prev, ...res.data.data }))
      }
      message.success('تنظیمات بکاپ‌گیری خودکار ذخیره شد')
    } catch (err) {
      const msg = await extractErrorMessage(err, 'خطا در ذخیره تنظیمات زمان‌بندی')
      message.error(msg)
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleCopyCli = async (cmd) => {
    try {
      await navigator.clipboard.writeText(cmd)
      message.success('دستور در کلیپ‌بورد کپی شد')
    } catch {
      message.info('لطفاً دستور را به صورت دستی کپی کنید')
    }
  }

  const summary = overview?.summary || {}
  const serverColumns = [
    {
      title: 'فایل بکاپ',
      dataIndex: 'filename',
      key: 'filename',
      mobileTitle: true,
      render: (filename, record) => (
        <div className="backup-filename-cell">
          <span className="backup-filename-code">{filename}</span>
          {record.note && <span className="backup-note-sub">{record.note}</span>}
        </div>
      ),
    },
    {
      title: 'نوع',
      dataIndex: 'trigger',
      key: 'trigger',
      mobileBadge: true,
      render: (trigger) => {
        const meta = TRIGGER_META[trigger] || { label: trigger || 'دستی', tone: 'neutral' }
        return <StatusPill size="sm" tone={meta.tone} label={meta.label} />
      },
    },
    {
      title: 'تاریخ ایجاد',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => (
        <div>
          <div>{formatPersianDate(date, true)}</div>
          <div className="backup-note-sub">{formatRelativeTime(date)}</div>
        </div>
      ),
    },
    {
      title: 'حجم',
      dataIndex: 'sizeBytes',
      key: 'sizeBytes',
      render: (bytes) => <span className="money-cell">{formatBytes(bytes)}</span>,
    },
    {
      title: 'محتوا',
      key: 'contents',
      render: (_, record) =>
        record.totalDocuments != null ? (
          <span className="money-cell">
            {formatNumber(record.totalCollections)} مجموعه / {formatNumber(record.totalDocuments)} رکورد
          </span>
        ) : (
          <span className="backup-note-sub">—</span>
        ),
    },
    {
      title: 'امنیت',
      dataIndex: 'encrypted',
      key: 'encrypted',
      render: (isEnc) =>
        isEnc ? (
          <Tag icon={<LockOutlined />} color="gold">
            رمزنگاری AES-256
          </Tag>
        ) : (
          <Tag icon={<UnlockOutlined />}>استاندارد (.ekg.gz)</Tag>
        ),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="دانلود فایل بکاپ">
            <Button
              size="small"
              icon={<CloudDownloadOutlined />}
              loading={downloadingName === record.filename}
              onClick={() => handleDownloadServerBackup(record.filename)}
            >
              دانلود
            </Button>
          </Tooltip>
          <Tooltip title="بررسی یکپارچگی و بازیابی از این نسخه">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<HistoryOutlined />}
              loading={inspectingServerName === record.filename}
              onClick={() => handleInspectServerBackup(record.filename)}
            >
              بازیابی
            </Button>
          </Tooltip>
          <Popconfirm
            title="حذف فایل بکاپ از سرور"
            description="آیا از حذف دائمی این نسخه پشتیبان از سرور مطمئن هستید؟"
            onConfirm={() => handleDeleteServerBackup(record.filename)}
            okText="حذف"
            cancelText="انصراف"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} aria-label="حذف بکاپ" />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const comparisonColumns = [
    {
      title: 'بخش / مجموعه',
      dataIndex: 'label',
      key: 'label',
      render: (label, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-400)', fontFamily: 'monospace' }}>
            {r.name}
          </div>
        </div>
      ),
    },
    {
      title: 'موجود در سایت فعلی',
      dataIndex: 'currentCount',
      key: 'currentCount',
      align: 'center',
      render: (v) => <span className="money-cell">{v == null ? '—' : formatNumber(v)}</span>,
    },
    {
      title: 'داخل فایل بکاپ',
      dataIndex: 'backupCount',
      key: 'backupCount',
      align: 'center',
      render: (v) => (
        <span className="money-cell" style={{ fontWeight: 700 }}>
          {formatNumber(v)}
        </span>
      ),
    },
    {
      title: 'تغییر پس از بازیابی',
      dataIndex: 'delta',
      key: 'delta',
      align: 'center',
      render: (delta) => {
        if (delta == null || delta === 0) {
          return <span className="backup-delta-zero">بدون تغییر</span>
        }
        if (delta > 0) {
          return <span className="backup-delta-pos">+{formatNumber(delta)}</span>
        }
        return <span className="backup-delta-neg">-{formatNumber(Math.abs(delta))}</span>
      },
    },
  ]

  const restorePhraseValid = useMemo(() => {
    const t = String(restoreModal.confirmPhrase || '').trim()
    return t === 'بازیابی' || t.toUpperCase() === 'RESTORE'
  }, [restoreModal.confirmPhrase])

  return (
    <div className="backup-section">
      {/* 1. Readiness Bar */}
      <div className={`backup-readiness-bar tone-${readiness.tone}`}>
        <div className="backup-readiness-main">
          {readiness.tone === 'ok' ? (
            <CheckCircleOutlined className="backup-readiness-icon" />
          ) : (
            <WarningOutlined className="backup-readiness-icon" />
          )}
          <div>
            <div className="backup-readiness-title">{readiness.title}</div>
            <div className="backup-readiness-sub">{readiness.sub}</div>
          </div>
        </div>
        <Button icon={<ReloadOutlined spin={loading} />} onClick={fetchOverview}>
          به‌روزرسانی وضعیت
        </Button>
      </div>

      {/* 2. KPI Strip */}
      <div className="backup-kpi-grid">
        <StatTile
          loading={loading}
          icon={<DatabaseOutlined />}
          tone="brand"
          label="کل رکوردهای قابل بکاپ"
          value={formatNumber(summary.totalDocuments || 0)}
          foot={`${formatNumber(summary.totalCollections || 0)} مجموعه و ${formatNumber(summary.totalIndexes || 0)} ایندکس`}
        />
        <StatTile
          loading={loading}
          icon={<SafetyCertificateOutlined />}
          tone="info"
          label="محصولات ثبت‌شده"
          value={formatNumber(summary.productsCount || 0)}
          foot={`${formatNumber(summary.categoriesCount || 0)} دسته و ${formatNumber(summary.brandsCount || 0)} برند`}
        />
        <StatTile
          loading={loading}
          icon={<CheckCircleOutlined />}
          tone="ok"
          label="سفارش‌ها و مشتریان"
          value={formatNumber((summary.ordersCount || 0) + (summary.usersCount || 0))}
          foot={`${formatNumber(summary.ordersCount || 0)} سفارش · ${formatNumber(summary.usersCount || 0)} کاربر`}
        />
        <StatTile
          loading={loading}
          icon={<ClockCircleOutlined />}
          tone={serverBackups.length > 0 ? 'ok' : 'warn'}
          label="نسخه‌های روی سرور"
          value={formatNumber(serverBackups.length)}
          foot={
            serverBackups[0]
              ? `آخرین نسخه: ${formatRelativeTime(serverBackups[0].createdAt)}`
              : 'هنوز بکاپ سرور ساخته نشده'
          }
        />
      </div>

      {/* 3. Primary Two-Column Action Grid */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            className="backup-action-card"
            title={
              <Space>
                <CloudDownloadOutlined style={{ color: 'var(--brand-600)' }} />
                <span>تهیه نسخه پشتیبان کامل (Backup)</span>
              </Space>
            }
          >
            <p className="backup-card-desc">
              یک فایل یکپارچه و فشرده از{' '}
              <strong>
                تمام محصولات، واریانت‌ها، قیمت‌های محرمانه و خرید، دسته‌بندی‌ها، برندها، سفارش‌ها،
                مشتریان، کدهای تخفیف، صفحات، مقالات، تنظیمات درگاه و پیامک، ارائه‌دهندگان هوش
                مصنوعی، ایندکس‌ها و لینک تصاویر
              </strong>{' '}
              تهیه می‌شود تا در صورت حذف کامل اطلاعات، سایت عیناً به همین حالت برگردد.
            </p>

            <div className="backup-field-group">
              <div>
                <label className="backup-field-label" htmlFor="backup-note-input">
                  توضیح یا برچسب این نسخه (اختیاری)
                </label>
                <Input
                  id="backup-note-input"
                  value={backupNote}
                  onChange={(e) => setBackupNote(e.target.value)}
                  maxLength={200}
                  placeholder="مثلاً: پیش از به‌روزرسانی قیمت‌ها یا تغییر دسته‌بندی‌ها"
                />
              </div>

              <div className="backup-encrypt-box">
                <div className="backup-encrypt-toggle">
                  <Space>
                    <LockOutlined style={{ color: 'var(--brand-600)' }} />
                    <span style={{ fontWeight: 600 }}>رمزنگاری فایل با رمز عبور (AES-256-GCM)</span>
                  </Space>
                  <Switch
                    checked={encryptBackup}
                    onChange={(val) => {
                      setEncryptBackup(val)
                      if (!val) resetPasswordInputs()
                    }}
                  />
                </div>

                {encryptBackup && (
                  <>
                    <div className="backup-encrypt-hint">
                      توصیه می‌شود برای نگهداری فایل بیرون از سرور فعال باشد. توجه: در صورت فراموشی
                      رمز عبور، هیچ راهی برای باز کردن فایل وجود نخواهد داشت.
                    </div>
                    <Row gutter={[12, 12]}>
                      <Col xs={24} sm={12}>
                        <Input.Password
                          value={backupPassword}
                          onChange={(e) => setBackupPassword(e.target.value)}
                          placeholder="رمز عبور (حداقل ۶ کاراکتر)"
                          autoComplete="new-password"
                        />
                      </Col>
                      <Col xs={24} sm={12}>
                        <Input.Password
                          value={backupPasswordConfirm}
                          onChange={(e) => setBackupPasswordConfirm(e.target.value)}
                          placeholder="تکرار رمز عبور"
                          autoComplete="new-password"
                        />
                      </Col>
                    </Row>
                  </>
                )}
              </div>

              <Checkbox
                checked={saveOnServer}
                onChange={(e) => setSaveOnServer(e.target.checked)}
              >
                هم‌زمان یک نسخه در آرشیو بکاپ‌های سرور نیز نگهداری شود
              </Checkbox>
            </div>

            <div className="backup-actions-row">
              <Button
                type="primary"
                size="large"
                icon={<CloudDownloadOutlined />}
                loading={exporting}
                disabled={creatingServer}
                onClick={handleExportAndDownload}
              >
                تهیه بکاپ کامل و دانلود فایل
              </Button>
              <Button
                size="large"
                icon={<DatabaseOutlined />}
                loading={creatingServer}
                disabled={exporting}
                onClick={handleCreateOnServer}
              >
                فقط ذخیره در سرور
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            className="backup-action-card"
            title={
              <Space>
                <CloudUploadOutlined style={{ color: 'var(--brand-600)' }} />
                <span>بازیابی کامل از فایل بکاپ (Restore)</span>
              </Space>
            }
          >
            <p className="backup-card-desc">
              فایل بکاپ با پسوند <code>.ekg.gz</code> یا <code>.ekg.enc</code> را انتخاب کنید. سیستم
              ابتدا بدون دست‌زدن به دیتابیس فعلی، سلامت فایل و امضای SHA-256 را بررسی کرده و گزارش
              مقایسه‌ای دقیق به شما نمایش می‌دهد.
            </p>

            <Dragger
              className="backup-upload-dragger"
              accept=".gz,.enc"
              multiple={false}
              showUploadList={false}
              disabled={inspectingUpload}
              beforeUpload={(file) => {
                handleInspectUpload(file)
                return false
              }}
            >
              <p className="backup-upload-icon">
                <InboxOutlined />
              </p>
              <p style={{ fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>
                {inspectingUpload
                  ? 'در حال ارسال و بررسی صحت فایل بکاپ...'
                  : 'فایل بکاپ را اینجا رها کنید یا برای انتخاب کلیک کنید'}
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--ink-500)', margin: 0 }}>
                پشتیبانی از فایل‌های استاندارد (<code>.ekg.gz</code>) و رمزنگاری‌شده (
                <code>.ekg.enc</code>)
              </p>
            </Dragger>

            {inspectingUpload && (
              <Progress
                percent={uploadPercent}
                status="active"
                style={{ marginTop: 12 }}
                strokeColor="#b45309"
              />
            )}

            <div className="backup-restore-checklist">
              <strong>تضمین ایمنی هنگام بازیابی:</strong>
              <ul>
                <li>پیش از اعمال تغییر، یک بکاپ ایمنی خودکار از وضعیت فعلی ذخیره می‌شود.</li>
                <li>تمام داده‌ها ابتدا در جداول موقت ساخته و تایید شده و سپس یکجا جایگزین می‌شوند.</li>
                <li>در صورت کوچک‌ترین خطا، وضعیت قبلی به‌صورت خودکار و کامل برگردانده می‌شود.</li>
                <li>تمام کش‌های سرور و Redis پس از بازیابی به‌طور خودکار پاک‌سازی می‌شوند.</li>
              </ul>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 4. Server Backup Archive */}
      <Card
        title={
          <Space>
            <HistoryOutlined style={{ color: 'var(--brand-600)' }} />
            <span>آرشیو بکاپ‌های ذخیره‌شده روی سرور</span>
            <Tag>{formatNumber(serverBackups.length)} نسخه</Tag>
          </Space>
        }
      >
        {serverBackups.length === 0 && !loading ? (
          <EmptyState
            icon={<DatabaseOutlined />}
            title="هنوز نسخه پشتیبانی روی سرور ذخیره نشده است"
            description="با زدن دکمه «فقط ذخیره در سرور» یا فعال‌سازی گزینه نگهداری در سرور هنگام دانلود، نسخه‌های بکاپ اینجا نگهداری می‌شوند."
            actionLabel="ساخت اولین بکاپ سرور"
            onAction={handleCreateOnServer}
            compact
          />
        ) : (
          <ResponsiveTable
            columns={serverColumns}
            dataSource={serverBackups}
            rowKey="filename"
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
          />
        )}
      </Card>

      {/* 5. Scheduled Auto Backups */}
      <Card
        title={
          <Space>
            <ClockCircleOutlined style={{ color: 'var(--brand-600)' }} />
            <span>بکاپ‌گیری خودکار زمان‌بندی‌شده</span>
            {scheduleForm.autoBackupEnabled ? (
              <StatusPill size="sm" tone="ok" label="فعال" />
            ) : (
              <StatusPill size="sm" tone="neutral" label="غیرفعال" />
            )}
          </Space>
        }
        extra={
          <Button
            type="primary"
            loading={savingSchedule}
            onClick={handleSaveSchedule}
          >
            ذخیره تنظیمات زمان‌بندی
          </Button>
        }
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={6}>
            <div className="backup-field-label">وضعیت بکاپ خودکار</div>
            <Space>
              <Switch
                checked={scheduleForm.autoBackupEnabled}
                onChange={(checked) =>
                  setScheduleForm((p) => ({ ...p, autoBackupEnabled: checked }))
                }
                checkedChildren="فعال"
                unCheckedChildren="غیرفعال"
              />
              <span style={{ fontSize: 12.5, color: 'var(--ink-600)' }}>
                {scheduleForm.autoBackupEnabled
                  ? 'طبق زمان‌بندی به‌صورت خودکار اجرا می‌شود'
                  : 'فقط بکاپ دستی انجام می‌شود'}
              </span>
            </Space>
          </Col>

          <Col xs={24} sm={12} md={5}>
            <div className="backup-field-label">بازه تکرار</div>
            <Select
              style={{ width: '100%' }}
              value={scheduleForm.frequency}
              disabled={!scheduleForm.autoBackupEnabled}
              onChange={(val) => setScheduleForm((p) => ({ ...p, frequency: val }))}
              options={[
                { value: 'every_12h', label: 'هر ۱۲ ساعت یک‌بار' },
                { value: 'daily', label: 'روزانه' },
                { value: 'weekly', label: 'هفتگی' },
              ]}
            />
          </Col>

          <Col xs={24} sm={12} md={5}>
            <div className="backup-field-label">ساعت اجرا</div>
            <Select
              style={{ width: '100%' }}
              value={scheduleForm.hour}
              disabled={!scheduleForm.autoBackupEnabled}
              onChange={(val) => setScheduleForm((p) => ({ ...p, hour: val }))}
              options={HOUR_OPTIONS}
            />
          </Col>

          {scheduleForm.frequency === 'weekly' && (
            <Col xs={24} sm={12} md={4}>
              <div className="backup-field-label">روز هفته</div>
              <Select
                style={{ width: '100%' }}
                value={scheduleForm.dayOfWeek}
                disabled={!scheduleForm.autoBackupEnabled}
                onChange={(val) => setScheduleForm((p) => ({ ...p, dayOfWeek: val }))}
                options={WEEKDAY_OPTIONS}
              />
            </Col>
          )}

          <Col xs={24} sm={12} md={4}>
            <div className="backup-field-label">تعداد نگهداری روی سرور</div>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={30}
              value={scheduleForm.retentionCount}
              disabled={!scheduleForm.autoBackupEnabled}
              onChange={(val) => setScheduleForm((p) => ({ ...p, retentionCount: val || 7 }))}
              addonAfter="نسخه"
            />
          </Col>
        </Row>

        {scheduleForm.lastAutoBackupAt && (
          <Alert
            style={{ marginTop: 16 }}
            type={scheduleForm.lastAutoBackupStatus === 'failed' ? 'error' : 'info'}
            showIcon
            message={
              scheduleForm.lastAutoBackupStatus === 'failed'
                ? `آخرین اجرای خودکار (${formatPersianDate(scheduleForm.lastAutoBackupAt, true)}) با خطا مواجه شد`
                : `آخرین بکاپ خودکار: ${formatPersianDate(scheduleForm.lastAutoBackupAt, true)}`
            }
            description={
              scheduleForm.lastAutoBackupStatus === 'failed'
                ? scheduleForm.lastAutoBackupError
                : scheduleForm.lastAutoBackupFile
                  ? `فایل ذخیره‌شده: ${scheduleForm.lastAutoBackupFile}`
                  : null
            }
          />
        )}
      </Card>

      {/* 6. Coverage & Emergency Disaster Recovery Guide */}
      <Collapse
        items={[
          {
            key: 'coverage',
            label: (
              <Space>
                <SafetyCertificateOutlined style={{ color: 'var(--brand-600)' }} />
                <span>
                  پوشش کامل اطلاعات ({formatNumber((overview?.collections || []).length)} مجموعه زنده) و
                  راهنمای بازیابی اضطراری
                </span>
              </Space>
            ),
            children: (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  message="نکته درباره تصاویر محصولات و بنرها (ParsPack S3)"
                  description="تمامی آدرس‌ها و شناسه‌های تصاویر محصولات، واریانت‌ها، برندها، دسته‌بندی‌ها و بنرها به‌طور کامل در فایل بکاپ ذخیره و بازیابی می‌شوند. خود فایل‌های تصویر در فضای ابری ParsPack S3 نگهداری می‌شوند و با پاک شدن دیتابیس MongoDB از بین نمی‌روند."
                />

                <Table
                  size="small"
                  pagination={false}
                  rowKey="name"
                  dataSource={overview?.collections || []}
                  scroll={{ x: 'max-content' }}
                  columns={[
                    { title: 'عنوان بخش', dataIndex: 'label', key: 'label' },
                    {
                      title: 'نام در دیتابیس',
                      dataIndex: 'name',
                      key: 'name',
                      render: (v) => (
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>
                      ),
                    },
                    {
                      title: 'تعداد رکورد',
                      dataIndex: 'documentCount',
                      key: 'documentCount',
                      align: 'center',
                      render: (v) => <span className="money-cell">{formatNumber(v)}</span>,
                    },
                    {
                      title: 'تعداد ایندکس',
                      dataIndex: 'indexCount',
                      key: 'indexCount',
                      align: 'center',
                      render: (v) => <span className="money-cell">{formatNumber(v)}</span>,
                    },
                  ]}
                />

                <div>
                  <div className="backup-field-label">
                    بازیابی اضطراری از طریق سرور (در صورتی که کل پنل و دیتابیس خالی شده باشد):
                  </div>
                  <div className="backup-cli-box">
                    <code>
                      cd ekgkala-backend && node scripts/restore-backup.js /path/to/backup.ekg.gz --yes
                    </code>
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() =>
                        handleCopyCli(
                          'cd ekgkala-backend && node scripts/restore-backup.js /path/to/backup.ekg.gz --yes',
                        )
                      }
                    >
                      کپی
                    </Button>
                  </div>
                </div>
              </Space>
            ),
          },
        ]}
      />

      {/* Password Prompt Modal (for encrypted backups) */}
      <Modal
        open={passwordPrompt.open}
        title={
          <Space>
            <LockOutlined style={{ color: 'var(--brand-600)' }} />
            <span>رمزگشایی فایل بکاپ رمزنگاری‌شده</span>
          </Space>
        }
        onCancel={() =>
          setPasswordPrompt({
            open: false,
            stagedToken: null,
            serverFilename: null,
            filename: '',
            password: '',
            submitting: false,
          })
        }
        onOk={handleSubmitPasswordPrompt}
        okText="بررسی و رمزگشایی"
        cancelText="انصراف"
        confirmLoading={passwordPrompt.submitting}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size="middle">
          <Alert
            type="info"
            showIcon
            message={`فایل «${passwordPrompt.filename}» با رمز عبور محافظت شده است.`}
            description="رمز عبوری که هنگام ساخت این بکاپ تعیین کرده بودید را وارد کنید."
          />
          <Input.Password
            size="large"
            placeholder="رمز عبور فایل بکاپ"
            value={passwordPrompt.password}
            onChange={(e) =>
              setPasswordPrompt((p) => ({ ...p, password: e.target.value }))
            }
            onPressEnter={handleSubmitPasswordPrompt}
            autoFocus
          />
        </Space>
      </Modal>

      {/* Verification & Final Restore Confirmation Modal */}
      <Modal
        open={restoreModal.open}
        width={760}
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: 'var(--err)' }} />
            <span>بررسی نهایی و تایید بازیابی کامل دیتابیس</span>
          </Space>
        }
        onCancel={() => {
          if (!restoreModal.restoring) {
            setRestoreModal((m) => ({ ...m, open: false }))
          }
        }}
        maskClosable={!restoreModal.restoring}
        closable={!restoreModal.restoring}
        footer={[
          <Button
            key="cancel"
            disabled={restoreModal.restoring}
            onClick={() => setRestoreModal((m) => ({ ...m, open: false }))}
          >
            انصراف
          </Button>,
          <Button
            key="restore"
            type="primary"
            danger
            loading={restoreModal.restoring}
            disabled={!restorePhraseValid}
            onClick={handleExecuteRestore}
          >
            تایید و شروع بازیابی کامل
          </Button>,
        ]}
      >
        {restoreModal.inspection && (
          <div className="backup-modal-summary">
            <Alert
              type="success"
              showIcon
              icon={<SafetyCertificateOutlined />}
              message="فایل بکاپ سالم و تاییدشده است (SHA-256 معتبر)"
              description={
                <span>
                  فایل <strong>{restoreModal.filename}</strong> ({formatBytes(restoreModal.sizeBytes)})
                  با موفقیت رمزگشایی و اعتبارسنجی شد.
                </span>
              }
            />

            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="تاریخ ساخت بکاپ">
                {formatPersianDate(restoreModal.inspection.header?.createdAt, true)}
              </Descriptions.Item>
              <Descriptions.Item label="نام فروشگاه در بکاپ">
                {restoreModal.inspection.header?.storeName || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="محتوای فایل">
                {formatNumber(restoreModal.inspection.footer?.totalCollections || 0)} مجموعه ·{' '}
                {formatNumber(restoreModal.inspection.footer?.totalDocuments || 0)} رکورد ·{' '}
                {formatNumber(restoreModal.inspection.footer?.totalIndexes || 0)} ایندکس
              </Descriptions.Item>
              <Descriptions.Item label="لینک تصاویر ثبت‌شده">
                {formatNumber(
                  restoreModal.inspection.footer?.mediaSummary?.totalMediaUrls || 0,
                )}{' '}
                لینک تصویر
              </Descriptions.Item>
              <Descriptions.Item label="امضای یکپارچگی" span={2}>
                <span className="backup-sha-chip">
                  {restoreModal.inspection.footer?.payloadSha256}
                </span>
              </Descriptions.Item>
            </Descriptions>

            {restoreModal.inspection.adminCheck?.willRequireRelogin && (
              <Alert
                type="warning"
                showIcon
                message="توجه: نشست فعلی شما در این بکاپ وجود ندارد"
                description={
                  <div>
                    پس از اتمام بازیابی، لازم است با یکی از حساب‌های مدیر ارشد موجود در فایل بکاپ وارد
                    شوید:{' '}
                    <strong>
                      {(restoreModal.inspection.adminCheck.restoredSuperadmins || []).join(' ، ') ||
                        'حساب مدیر موجود در بکاپ'}
                    </strong>
                  </div>
                }
              />
            )}

            {(restoreModal.inspection.extraLiveCollections || []).length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="مجموعه‌های جدیدتر در دیتابیس فعلی"
                description={`مجموعه‌های ${restoreModal.inspection.extraLiveCollections
                  .map((c) => `${c.label} (${formatNumber(c.currentCount)})`)
                  .join('، ')} پس از این بکاپ ساخته شده‌اند و در صورت فعال بودن گزینه جایگزینی دقیق حذف خواهند شد.`}
              />
            )}

            <Table
              size="small"
              rowKey="name"
              columns={comparisonColumns}
              dataSource={restoreModal.inspection.comparison || []}
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              scroll={{ x: 'max-content' }}
            />

            <Space direction="vertical" size="small">
              <Checkbox
                checked={restoreModal.createSafetyBackup}
                onChange={(e) =>
                  setRestoreModal((m) => ({ ...m, createSafetyBackup: e.target.checked }))
                }
              >
                تهیه بکاپ ایمنی خودکار از وضعیت فعلی قبل از شروع بازیابی (توصیه می‌شود)
              </Checkbox>
              <Checkbox
                checked={restoreModal.dropUnlistedCollections}
                onChange={(e) =>
                  setRestoreModal((m) => ({
                    ...m,
                    dropUnlistedCollections: e.target.checked,
                  }))
                }
              >
                جایگزینی دقیق و کامل مطابق بکاپ (حذف مجموعه‌های اضافه‌ای که در فایل بکاپ نیستند)
              </Checkbox>
            </Space>

            <div className="backup-confirm-box">
              <div style={{ fontWeight: 700, color: 'var(--err)' }}>
                برای تایید بازگردانی کل اطلاعات سایت به وضعیت این بکاپ، کلمه «بازیابی» را بنویسید:
              </div>
              <Input
                value={restoreModal.confirmPhrase}
                onChange={(e) =>
                  setRestoreModal((m) => ({ ...m, confirmPhrase: e.target.value }))
                }
                placeholder="بازیابی"
                disabled={restoreModal.restoring}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Post-Restore Result Modal */}
      <Modal
        open={Boolean(restoreResult)}
        title={
          <Space>
            <CheckCircleOutlined style={{ color: 'var(--ok)' }} />
            <span>بازیابی کامل با موفقیت انجام شد</span>
          </Space>
        }
        onCancel={() => setRestoreResult(null)}
        footer={
          restoreResult?.sessionPreserved === false
            ? [
                <Button
                  key="relogin"
                  type="primary"
                  onClick={() => {
                    setRestoreResult(null)
                    logout()
                  }}
                >
                  ورود مجدد با حساب بکاپ
                </Button>,
              ]
            : [
                <Button key="ok" type="primary" onClick={() => setRestoreResult(null)}>
                  بستن
                </Button>,
              ]
        }
      >
        {restoreResult && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="success"
              showIcon
              message="اطلاعات سایت با موفقیت و بدون خطا بازیابی شد"
              description="تمام کش‌های سرور و Redis به‌روزرسانی شدند تا تغییرات بلافاصله در فروشگاه و پنل دیده شوند."
            />
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="مجموعه‌های بازیابی‌شده">
                {formatNumber(restoreResult.restoredCollections || 0)}
              </Descriptions.Item>
              <Descriptions.Item label="رکوردهای بازیابی‌شده">
                {formatNumber(restoreResult.restoredDocuments || 0)}
              </Descriptions.Item>
              <Descriptions.Item label="ایندکس‌های بازسازی‌شده">
                {formatNumber(restoreResult.restoredIndexes || 0)}
              </Descriptions.Item>
              {restoreResult.safetyBackupFile && (
                <Descriptions.Item label="بکاپ ایمنی پیش از بازیابی">
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {restoreResult.safetyBackupFile}
                  </span>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="زمان اجرا">
                {formatNumber(((restoreResult.durationMs || 0) / 1000).toFixed(2))} ثانیه
              </Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Modal>
    </div>
  )
}
