import { Skeleton } from 'antd'
import './StatTile.css'

/**
 * StatTile — one number with its label and optional footnote.
 *
 * `tone` is a status word, not a colour: it decides the icon wash and is
 * also passed to the screen reader, so "this is the one that needs
 * attention" survives without colour vision. Pass `onClick` to turn the
 * tile into the jump-off point for that number.
 */
const TONES = {
  brand: 'tone-brand',
  ok: 'tone-ok',
  warn: 'tone-warn',
  err: 'tone-err',
  info: 'tone-info',
  neutral: 'tone-neutral',
}

const TONE_WORDS = {
  brand: '',
  ok: 'وضعیت خوب',
  warn: 'نیازمند توجه',
  err: 'بحرانی',
  info: '',
  neutral: '',
}

export default function StatTile({
  loading,
  label,
  value,
  icon,
  tone = 'neutral',
  foot,
  onClick,
  ariaLabel,
}) {
  if (loading) {
    return (
      <div className="stat-tile" aria-busy="true">
        <Skeleton active paragraph={{ rows: 1, width: '60%' }} />
      </div>
    )
  }

  const toneClass = TONES[tone] || TONES.neutral
  const toneWord = TONE_WORDS[tone] || ''
  const content = (
    <>
      {icon && (
        <span className={`stat-tile-icon ${toneClass}`} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="stat-tile-body">
        <span className="stat-tile-label">{label}</span>
        <span className="stat-tile-value">
          {toneWord && <span className="sr-only">{toneWord}: </span>}
          {value}
        </span>
        {foot && <span className="stat-tile-foot">{foot}</span>}
      </span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className="stat-tile stat-tile-action"
        onClick={onClick}
        aria-label={ariaLabel || `${label}: ${value}`}
      >
        {content}
      </button>
    )
  }

  return (
    <div className="stat-tile" aria-label={ariaLabel || `${label}: ${value}`}>
      {content}
    </div>
  )
}
