import { useEffect, useMemo, useRef } from 'react'
import { useQuill } from 'react-quilljs'
import 'quill/dist/quill.snow.css'
import './RichTextEditor.css'

function RichTextEditor({ value, onChange, modules, formats }) {
  const options = useMemo(() => {
    return {
      theme: 'snow',
      modules,
      formats,
    }
  }, [modules, formats])

  const { quill, quillRef } = useQuill(options)
  const isApplyingValueRef = useRef(false)

  useEffect(() => {
    if (!quill) return

    const nextHtml = value ?? ''
    const currentHtml = quill.root.innerHTML
    if (currentHtml === nextHtml) return

    isApplyingValueRef.current = true
    if (nextHtml) {
      quill.clipboard.dangerouslyPasteHTML(nextHtml)
    } else {
      quill.setText('')
    }
    isApplyingValueRef.current = false
  }, [quill, value])

  useEffect(() => {
    if (!quill) return

    const handler = () => {
      if (isApplyingValueRef.current) return
      onChange?.(quill.root.innerHTML)
    }

    quill.on('text-change', handler)
    return () => {
      quill.off('text-change', handler)
    }
  }, [quill, onChange])

  return <div ref={quillRef} className="rich-text-editor" />
}

export default RichTextEditor
