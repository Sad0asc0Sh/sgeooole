import { useEffect, useRef, useState, useCallback } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import './RichTextEditor.css'

const defaultModules = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    ['blockquote', 'code-block'],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ direction: 'rtl' }],
    [{ size: ['small', false, 'large', 'huge'] }],
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    ['link', 'image', 'video'],
    [{ color: [] }, { background: [] }],
    [{ font: [] }],
    [{ script: 'sub' }, { script: 'super' }],
    ['clean'],
  ],
  clipboard: {
    matchVisual: false,
  },
}

const defaultFormats = [
  'bold', 'italic', 'underline', 'strike',
  'align', 'list', 'indent', 'size', 'header',
  'link', 'image', 'video', 'color', 'background',
  'direction', 'blockquote', 'code-block', 'font',
  'script', 'code',
]

function RichTextEditor({ value, onChange, modules, formats }) {
  const containerRef = useRef(null)
  const quillRef = useRef(null)
  const isApplyingValueRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [isHtmlMode, setIsHtmlMode] = useState(false)
  const [htmlContent, setHtmlContent] = useState('')

  // ساخت Quill فقط یک‌بار
  useEffect(() => {
    if (quillRef.current || !containerRef.current) return
    const q = new Quill(containerRef.current, {
      theme: 'snow',
      modules: { ...defaultModules, ...modules },
      formats: formats || defaultFormats,
    })
    quillRef.current = q
    setReady(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // همگام‌سازی value خارجی با ادیتور (فقط حالت بصری)
  useEffect(() => {
    if (isHtmlMode) return
    const q = quillRef.current
    if (!q || !ready) return
    const nextHtml = value ?? ''
    const currentHtml = q.root.innerHTML
    if (currentHtml === nextHtml) return
    isApplyingValueRef.current = true
    if (nextHtml) {
      q.clipboard.dangerouslyPasteHTML(nextHtml)
    } else {
      q.setText('')
    }
    isApplyingValueRef.current = false
  }, [ready, value, isHtmlMode])

  // ارسال تغییرات ادیتور به بیرون (فقط حالت بصری)
  useEffect(() => {
    const q = quillRef.current
    if (!q || !ready) return
    const handler = () => {
      if (isApplyingValueRef.current) return
      if (!isHtmlMode) {
        onChange?.(q.root.innerHTML)
      }
    }
    q.on('text-change', handler)
    return () => q.off('text-change', handler)
  }, [ready, onChange, isHtmlMode])

  // تغییر حالت بین بصری و HTML
  const toggleHtmlMode = useCallback(() => {
    const q = quillRef.current
    if (!q) return
    if (!isHtmlMode) {
      setHtmlContent(q.root.innerHTML)
      setIsHtmlMode(true)
    } else {
      var confirmed = window.confirm(
        'توجه: با برگشت به حالت ویرایشگر بصری، ممکن است برخی تگ‌های پیشرفته HTML ساده‌سازی شوند.\n\nآیا ادامه می‌دهید؟'
      )
      if (!confirmed) return
      isApplyingValueRef.current = true
      q.clipboard.dangerouslyPasteHTML(htmlContent)
      isApplyingValueRef.current = false
      onChange?.(q.root.innerHTML)
      setIsHtmlMode(false)
    }
  }, [isHtmlMode, htmlContent, onChange])

  // تغییر محتوا در textarea حالت HTML
  var handleHtmlChange = useCallback(function(e) {
    var newHtml = e.target.value
    setHtmlContent(newHtml)
    onChange?.(newHtml)
  }, [onChange])

  return (
    <div className="rte-wrapper">
      <div className="rte-toolbar-row">
        <button type="button" className="rte-toggle-btn" onClick={toggleHtmlMode}>
          {isHtmlMode ? 'بازگشت به ویرایشگر بصری' : 'ویرایش HTML خام'}
        </button>
        {isHtmlMode && (
          <span className="rte-html-badge">حالت HTML فعال است - تگ‌ها بدون تغییر ذخیره می‌شوند</span>
        )}
      </div>
      {isHtmlMode && (
        <textarea
          className="rte-html-textarea"
          value={htmlContent}
          onChange={handleHtmlChange}
          dir="ltr"
          spellCheck={false}
        />
      )}
      <div className={isHtmlMode ? 'rte-visual-hidden' : ''}>
        <div ref={containerRef} className="rich-text-editor" />
      </div>
    </div>
  )
}

export default RichTextEditor
