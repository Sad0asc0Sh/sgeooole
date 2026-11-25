import { useMemo, useRef } from 'react'
import DatePicker from 'react-multi-date-picker'
import persian from 'react-date-object/calendars/persian'
import persian_fa from 'react-date-object/locales/persian_fa'
import DateObject from 'react-date-object'
import { CalendarOutlined, CloseCircleFilled } from '@ant-design/icons'
import useIsMobile from '../hooks/useIsMobile'
import { toSafeDate } from '../utils/dateUtils'
import JalaliDateTimePicker from './JalaliDateTimePicker'
import 'react-multi-date-picker/styles/layouts/mobile.css'
import './JalaliDatePicker.css'

const ANALYTICS_PRESETS = [
  { key: 'today', label: 'امروز', days: 0 },
  { key: '7d', label: '۷ روز', days: 6 },
  { key: '30d', label: '۳۰ روز', days: 29 },
  { key: '90d', label: '۹۰ روز', days: 89 },
  { key: 'year', label: 'امسال', isYear: true },
]

const CAMPAIGN_DURATION_PRESETS = [
  { label: '۲۴ ساعته', hours: 24 },
  { label: '۳ روزه', hours: 24 * 3 },
  { label: '۷ روزه', hours: 24 * 7 },
  { label: '۱۴ روزه', hours: 24 * 14 },
]

function buildAnalyticsRange(preset) {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  if (preset.isYear) {
    try {
      const jalaliStart = new DateObject({
        date: now,
        calendar: persian,
        locale: persian_fa,
      })
        .setMonth(1)
        .setDay(1)
        .toDate()
      jalaliStart.setHours(0, 0, 0, 0)
      return [jalaliStart, end]
    } catch {
      const fallbackStart = new Date(now.getFullYear(), 0, 1)
      return [fallbackStart, end]
    }
  }

  const start = new Date(now)
  start.setDate(start.getDate() - preset.days)
  start.setHours(0, 0, 0, 0)
  return [start, end]
}

/**
 * Unified Responsive Jalali Range Picker.
 * - showTime=false (default): dual-month desktop / single-month mobile calendar range picker for analytics & reports.
 * - showTime=true: paired Start + End JalaliDateTimePicker with cross-validation & duration presets for campaigns.
 */
export default function JalaliRangePicker({
  value,
  onChange,
  showTime = false,
  placeholder = 'انتخاب بازه تاریخ (شمسی)',
  allowClear = true,
  disabled = false,
  presets = false,
  style = {},
  className = '',
}) {
  const isMobile = useIsMobile(768)
  const pickerRef = useRef(null)

  const currentPair = useMemo(() => {
    if (!Array.isArray(value) || value.length === 0) return [null, null]
    return [toSafeDate(value[0]), toSafeDate(value[1])]
  }, [value])

  const dateObjects = useMemo(() => {
    const [s, e] = currentPair
    if (!s && !e) return []
    const arr = []
    try {
      if (s) arr.push(new DateObject({ date: s, calendar: persian, locale: persian_fa }))
      if (e) arr.push(new DateObject({ date: e, calendar: persian, locale: persian_fa }))
    } catch {
      return []
    }
    return arr
  }, [currentPair])

  // ── Mode B: Campaign Date-Time Range (Paired Start + End) ──
  if (showTime) {
    const [startDate, endDate] = currentPair

    const handleStartChange = (nextStart) => {
      if (!nextStart && !endDate) {
        onChange?.(null)
        return
      }
      if (nextStart && endDate && nextStart >= endDate) {
        const autoEnd = new Date(nextStart.getTime() + 24 * 3600 * 1000)
        onChange?.([nextStart, autoEnd])
        return
      }
      onChange?.([nextStart, endDate])
    }

    const handleEndChange = (nextEnd) => {
      if (!startDate && !nextEnd) {
        onChange?.(null)
        return
      }
      onChange?.([startDate, nextEnd])
    }

    const applyDurationPreset = (hours) => {
      const baseStart = startDate && startDate > new Date() ? new Date(startDate) : new Date()
      const nextEnd = new Date(baseStart.getTime() + hours * 3600 * 1000)
      onChange?.([baseStart, nextEnd])
    }

    return (
      <div className={`ekg-jalali-wrap${className ? ` ${className}` : ''}`} style={style}>
        <div className="ekg-jalali-paired-range">
          <div className="ekg-jalali-paired-col">
            <span className="ekg-jalali-paired-label">تاریخ و ساعت شروع</span>
            <JalaliDateTimePicker
              value={startDate}
              onChange={handleStartChange}
              showTime
              allowClear={allowClear}
              disabled={disabled}
              placeholder="انتخاب شروع کمپین"
            />
          </div>
          <div className="ekg-jalali-paired-col">
            <span className="ekg-jalali-paired-label">تاریخ و ساعت پایان</span>
            <JalaliDateTimePicker
              value={endDate}
              onChange={handleEndChange}
              showTime
              allowClear={allowClear}
              disabled={disabled}
              minDate={startDate || undefined}
              placeholder="انتخاب پایان کمپین"
            />
          </div>
        </div>

        {presets && !disabled && (
          <div className="ekg-jalali-presets">
            {CAMPAIGN_DURATION_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="ekg-jalali-preset-btn"
                onClick={() => applyDurationPreset(p.hours)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Mode A: Analytics Date Range Picker ──
  const handleRangeChange = (dates) => {
    if (!onChange) return
    if (!Array.isArray(dates) || dates.length === 0) {
      onChange([])
      return
    }
    if (dates.length === 1) {
      const s = toSafeDate(dates[0])
      if (s) {
        s.setHours(0, 0, 0, 0)
        const e = new Date(s)
        e.setHours(23, 59, 59, 999)
        onChange([s, e])
      }
      return
    }
    const s = toSafeDate(dates[0])
    const e = toSafeDate(dates[1])
    if (s && e) {
      s.setHours(0, 0, 0, 0)
      e.setHours(23, 59, 59, 999)
      onChange([s, e])
    }
  }

  const handleClear = (e) => {
    e.stopPropagation()
    e.preventDefault()
    pickerRef.current?.closeCalendar?.()
    onChange?.([])
  }

  return (
    <div
      className={`ekg-jalali-wrap${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      <div className={`ekg-jalali-field${disabled ? ' is-disabled' : ''}`}>
        <span className="ekg-jalali-icon" aria-hidden="true">
          <CalendarOutlined />
        </span>

        <DatePicker
          ref={pickerRef}
          value={dateObjects}
          onChange={handleRangeChange}
          range
          rangeHover
          dateSeparator=" تا "
          numberOfMonths={isMobile ? 1 : 2}
          calendar={persian}
          locale={persian_fa}
          format="YYYY/MM/DD"
          placeholder={placeholder}
          disabled={disabled}
          editable={false}
          portal={!isMobile}
          portalTarget={typeof document !== 'undefined' ? document.body : undefined}
          calendarPosition="bottom-right"
          className={`ekg-rmdp${isMobile ? ' rmdp-mobile' : ''}`}
          inputClass="ekg-jalali-input"
          containerStyle={{ width: '100%' }}
        />

        {allowClear && !disabled && dateObjects.length > 0 && (
          <button
            type="button"
            className="ekg-jalali-clear"
            onClick={handleClear}
            aria-label="پاک کردن بازه تاریخ"
          >
            <CloseCircleFilled />
          </button>
        )}
      </div>

      {presets === 'analytics' && !disabled && (
        <div className="ekg-jalali-presets">
          {ANALYTICS_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className="ekg-jalali-preset-btn"
              onClick={() => onChange?.(buildAnalyticsRange(p))}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
