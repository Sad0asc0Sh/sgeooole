import './StatusPill.css'

/**
 * StatusPill — one visual language for state.
 *
 * Pages were picking antd Tag colours per page, so the same "Delivered"
 * order looked different on the dashboard and the order list. The tone
 * is a word rather than a colour, and the label always carries the
 * meaning, so the pill is still readable without colour vision.
 */

const TONE_BY_NAME = {
  // orders
  pending: 'warn',
  processing: 'info',
  shipped: 'brand',
  delivered: 'ok',
  cancelled: 'err',
  refunded: 'neutral',
  // generic
  active: 'ok',
  enabled: 'ok',
  published: 'ok',
  paid: 'ok',
  completed: 'ok',
  success: 'ok',
  confirmed: 'ok',
  draft: 'neutral',
  archived: 'neutral',
  expired: 'neutral',
  failed: 'err',
  error: 'err',
  rejected: 'err',
  disabled: 'neutral',
  // review moderation
  approved: 'ok',
  pending_review: 'warn',
  rejected_review: 'err',
  // support
  open: 'warn',
  answered: 'info',
  closed: 'neutral',
}

export default function StatusPill({ status, label, tone, size = 'md' }) {
  const key = String(status || '').trim()
  const resolvedTone = tone || TONE_BY_NAME[key.toLowerCase().replace(/\s+/g, '_')] || 'neutral'
  const text = label || key || '—'

  return (
    <span className={`status-pill tone-${resolvedTone} status-pill-${size}`}>
      <span className="status-pill-dot" aria-hidden="true" />
      {text}
    </span>
  )
}
