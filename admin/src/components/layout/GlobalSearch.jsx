import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { NAV_PAGES } from '../../theme/navConfig'
import { hasPermission } from '../../rbac/access'
import { useAuthStore } from '../../stores'
import './GlobalSearch.css'

/**
 * Command palette (Ctrl/⌘ + K).
 *
 * The panel has ~30 destinations. Reaching them by scrolling the rail
 * is fine once you know where they are and tedious while you don't, so
 * this jumps straight to a page. It only indexes pages the operator is
 * actually allowed to open — a result you cannot use is worse than no
 * result at all.
 */

/** Cheap relevance: prefix > word-start > substring, then shorter wins. */
function score(query, haystack) {
  if (!query) return 1
  const q = query.trim().toLowerCase()
  if (!q) return 1
  const h = haystack.toLowerCase()

  if (h.startsWith(q)) return 100 - h.length
  const wordStart = h.split(/\s+/).some((w) => w.startsWith(q))
  if (wordStart) return 70 - h.length
  if (h.includes(q)) return 40 - h.length
  return 0
}

function normalize(text) {
  // Persian and Arabic letter forms differ only in the ی/ي and ک/ك
  // positions; folding them means a Persian keyboard finds what it typed.
  return String(text || '')
    .replace(/[يی]/g, 'ی')
    .replace(/[كک]/g, 'ک')
    .replace(/‌/g, ' ')
    .toLowerCase()
}

export function GlobalSearch({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const navigate = useNavigate()
  const { role, permissions } = useAuthStore()
  const listRef = useRef(null)

  const resolvedPermissions = useMemo(
    () => (Array.isArray(permissions) ? permissions : []),
    [permissions]
  )

  // Only pages this operator can actually open.
  const searchable = useMemo(
    () =>
      NAV_PAGES.filter((page) => {
        if (page.roles && !page.roles.includes(role)) return false
        if (page.permission && !hasPermission(resolvedPermissions, page.permission)) {
          return false
        }
        return true
      }),
    [resolvedPermissions, role]
  )

  const results = useMemo(() => {
    const q = normalize(query)
    if (!q) return searchable.slice(0, 8)

    return searchable
      .map((page) => {
        const labelScore = score(q, normalize(page.label))
        const keywordScore = score(q, normalize(page.keywords || ''))
        const parentScore = page.parent ? score(q, normalize(page.parent.label)) * 0.6 : 0
        return { page, total: Math.max(labelScore, keywordScore, parentScore) }
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map((r) => r.page)
  }, [query, searchable])

  // Reset the dialog each time it opens so it never reopens mid-query.
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Keep the highlighted row in view during keyboard traversal.
  useEffect(() => {
    if (!open) return
    const node = listRef.current?.querySelector('[data-active="true"]')
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const go = (page) => {
    if (!page) return
    onClose()
    navigate(page.path)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[activeIndex])
    }
  }

  if (!open) return null

  return (
    <div
      className="gsearch-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="gsearch"
        role="dialog"
        aria-modal="true"
        aria-label="جستجو در پنل"
        onKeyDown={onKeyDown}
      >
        <div className="gsearch-field">
          <span className="gsearch-glyph" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="m20 20-3.2-3.2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            className="gsearch-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="برو به… (نام صفحه یا کلیدواژه)"
            aria-label="جستجوی صفحه"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <kbd className="gsearch-esc">Esc</kbd>
        </div>

        <div className="gsearch-results" ref={listRef} role="listbox">
          {results.length === 0 ? (
            <div className="gsearch-empty">
              <p className="gsearch-empty-title">نتیجه‌ای پیدا نشد</p>
              <p className="gsearch-empty-hint">
                عبارت دیگری را امتحان کنید یا از منوی کناری استفاده کنید.
              </p>
            </div>
          ) : (
            results.map((page, i) => (
              <button
                key={page.path}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                data-active={i === activeIndex}
                className={`gsearch-row${i === activeIndex ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => go(page)}
              >
                <span className="gsearch-row-icon" aria-hidden="true">
                  <page.icon />
                </span>
                <span className="gsearch-row-label">{page.label}</span>
                {page.parent && <span className="gsearch-row-parent">{page.parent.label}</span>}
              </button>
            ))
          )}
        </div>

        <div className="gsearch-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> جابه‌جایی
          </span>
          <span>
            <kbd>Enter</kbd> باز کردن
          </span>
          <span>
            <kbd>Esc</kbd> بستن
          </span>
        </div>
      </div>
    </div>
  )
}

export default GlobalSearch
