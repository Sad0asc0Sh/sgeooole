import { useMemo, useRef } from 'react'
import DatePicker from 'react-multi-date-picker'
import TimePicker from 'react-multi-date-picker/plugins/time_picker'
import persian from 'react-date-object/calendars/persian'
import persian_fa from 'react-date-object/locales/persian_fa'
import DateObject from 'react-date-object'
import { CalendarOutlined, CloseCircleFilled } from '@ant-design/icons'
import useIsMobile from '../hooks/useIsMobile'
import { toSafeDate } from '../utils/dateUtils'
import 'react-multi-date-picker/styles/layouts/mobile.css'
import './JalaliDatePicker.css'

const FUTURE_PRESETS = [
  { label: '۲۴ ساعت آینده', hours: 24 },
  { label: '۳ روز آینده', hours: 24 * 3 },
  { label: '۷ روز آینده', hours: 24 * 7 },
  { label: '۱ ماه آینده', hours: 24 * 30 },
]

/**
 * Responsive Jalali (Shamsi) Date / DateTime Picker Component.
 * Branded in saffron/warm-stone, portal-rendered on desktop, touch-modal on mobile.
 */
export default function JalaliDateTimePicker({
  value,
  onChange,
  placeholder,
  showTime = true,
  allowClear = true,
  disabled = false,
  minDate,
  maxDate,
  presets = false,
  id,
  style = {},
  className = '',
}) {
  const isMobile = useIsMobile(768)
  const pickerRef = useRef(null)

  const effectivePlaceholder =
    placeholder ?? (showTime ? 'انتخاب تاریخ و ساعت (شمسی)' : 'انتخاب تاریخ (شمسی)')

  const dateValue = useMemo(() => {
    const safe = toSafeDate(value)
    if (!safe) return null
    try {
      return new DateObject({
        date: safe,
        calendar: persian,
        locale: persian_fa,
      })
    } catch {
      return null
    }
  }, [value])

  const minDateObj = useMemo(() => {
    const safe = toSafeDate(minDate)
    if (!safe) return undefined
    try {
      return new DateObject({ date: safe, calendar: persian, locale: persian_fa })
    } catch {
      return undefined
    }
  }, [minDate])

  const maxDateObj = useMemo(() => {
    const safe = toSafeDate(maxDate)
    if (!safe) return undefined
    try {
      return new DateObject({ date: safe, calendar: persian, locale: persian_fa })
    } catch {
      return undefined
    }
  }, [maxDate])

  const handleChange = (dateObject) => {
    if (!onChange) return
    if (!dateObject) {
      onChange(null)
      return
    }
    const jsDate = toSafeDate(dateObject)
    onChange(jsDate)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    e.preventDefault()
    pickerRef.current?.closeCalendar?.()
    onChange?.(null)
  }

  const presetItems = useMemo(() => {
    if (!presets || disabled) return []
    if (Array.isArray(presets)) return presets
    if (presets === 'future') {
      return FUTURE_PRESETS.map((p) => ({
        label: p.label,
        getDate: () => new Date(Date.now() + p.hours * 3600 * 1000),
      }))
    }
    return []
  }, [presets, disabled])

  const plugins = useMemo(
    () => (showTime ? [<TimePicker key="time" position="bottom" hideSeconds />] : []),
    [showTime],
  )

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
          id={id}
          value={dateValue}
          onChange={handleChange}
          calendar={persian}
          locale={persian_fa}
          format={showTime ? 'YYYY/MM/DD - HH:mm' : 'YYYY/MM/DD'}
          placeholder={effectivePlaceholder}
          disabled={disabled}
          minDate={minDateObj}
          maxDate={maxDateObj}
          editable={false}
          portal={!isMobile}
          portalTarget={typeof document !== 'undefined' ? document.body : undefined}
          calendarPosition="bottom-right"
          className={`ekg-rmdp${isMobile ? ' rmdp-mobile' : ''}`}
          plugins={plugins}
          inputClass="ekg-jalali-input"
          containerStyle={{ width: '100%' }}
        />

        {allowClear && !disabled && dateValue && (
          <button
            type="button"
            className="ekg-jalali-clear"
            onClick={handleClear}
            aria-label="پاک کردن تاریخ"
          >
            <CloseCircleFilled />
          </button>
        )}
      </div>

      {presetItems.length > 0 && (
        <div className="ekg-jalali-presets">
          {presetItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className="ekg-jalali-preset-btn"
              onClick={() => onChange?.(item.getDate())}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
