import { useEffect, useRef, useState } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import './RichTextEditor.css'

const defaultModules = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ size: ['small', false, 'large', 'huge'] }],
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    ['link', 'image', 'video'],
    [{ color: [] }, { background: [] }],
    ['clean'],
  ],
  clipboard: { matchVisual: false },
}

const defaultFormats = [
  'bold', 'italic', 'underline', 'strike',
  'align', 'list', 'indent', 'size', 'header',
  'link', 'image', 'video', 'color', 'background',
]

function RichTextEditor({ value, onChange, modules, formats }) {
  const containerRef = useRef(null)
  const quillRef = useRef(null)
  const isApplyingValueRef = useRef(false)
  const [ready, setReady] = useState(false)

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

  // همگام‌سازی value خارجی → ادیتور
  useEffect(() => {
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
  }, [ready, value])

  // ارسال تغییرات ادیتور → بیرون
  useEffect(() => {
    const q = quillRef.current
    if (!q || !ready) return

    const handler = () => {
      if (isApplyingValueRef.current) return
      onChange?.(q.root.innerHTML)
    }

    q.on('text-change', handler)
    return () => {
      q.off('text-change', handler)
    }
  }, [ready, onChange])

  return <div ref={containerRef} className="rich-text-editor" />
}

export default RichTextEditor

