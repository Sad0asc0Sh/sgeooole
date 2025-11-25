import { useEffect, useState, useRef } from 'react'
import DatePicker from 'react-multi-date-picker'
import TimePicker from 'react-multi-date-picker/plugins/time_picker'
import persian from 'react-date-object/calendars/persian'
import persian_fa from 'react-date-object/locales/persian_fa'
import DateObject from 'react-date-object'
// تم آبی در نسخه فعلی بسته وجود ندارد؛ از تم teal استفاده می‌کنیم
import 'react-multi-date-picker/styles/colors/teal.css'

/**
 * Jalali (Shamsi) DateTime Picker Component
 */
export default function JalaliDateTimePicker({
  value,
  onChange,
  placeholder,
  style = {},
  borderColor = '#d9d9d9',
  focusColor = '#1890ff',
}) {
  const [dateValue, setDateValue] = useState(null)
  const effectivePlaceholder = placeholder ?? 'تاریخ و ساعت را انتخاب کنید'
  const mounted = useRef(false)

  // Convert ISO string to DateObject when value changes (edit mode)
  useEffect(() => {
    mounted.current = true
    if (value) {
      try {
        const jsDate = new Date(value)
        const persianDate = new DateObject({
          date: jsDate,
          calendar: persian,
          locale: persian_fa,
        })
        setDateValue(persianDate)
      } catch (error) {
        console.error('Error converting date:', error)
        setDateValue(null)
      }
    } else {
      setDateValue(null)
    }
    return () => {
      mounted.current = false
    }
  }, [value])

  const handleChange = (dateObject) => {
    if (!dateObject) {
      setDateValue(null)
      onChange(null)
      return
    }

    // Convert Persian DateObject to JavaScript Date
    const jsDate = dateObject.toDate()

    onChange(jsDate)
    setDateValue(dateObject)
  }

  return (
    <div style={{ position: 'relative', ...style }}>
      <DatePicker
        value={dateValue}
        onChange={handleChange}
        calendar={persian}
        locale={persian_fa}
        format="YYYY/MM/DD HH:mm"
        placeholder={effectivePlaceholder}
        calendarPosition="bottom-right"
        className="teal"
        plugins={[<TimePicker key="time" position="bottom" hideSeconds />]}
        containerStyle={{
          width: '100%',
        }}
        style={{
          width: '100%',
          height: '40px',
          padding: '8px 12px',
          border: `1px solid ${borderColor}`,
          borderRadius: '6px',
          fontSize: '14px',
          outline: 'none',
          transition: 'border-color 0.3s',
          fontFamily: 'inherit',
        }}
        inputClass="custom-jalali-input"
        calendarStyle={{
          fontFamily: 'inherit',
        }}
      />

      <style jsx>{`
        :global(.custom-jalali-input:focus) {
          border-color: ${focusColor} !important;
          box-shadow: 0 0 0 2px ${focusColor}20;
        }
        :global(.custom-jalali-input:hover) {
          border-color: ${focusColor};
        }
        :global(.rmdp-container) {
          direction: rtl;
        }
      `}</style>
    </div>
  )
}
