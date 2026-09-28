import { Button } from 'antd'
import './EmptyState.css'

/**
 * EmptyState — an empty screen is a prompt, not an apology.
 *
 * Says what is missing and, where there is one, gives the single action
 * that fixes it. Without `action` it stays quiet rather than inventing a
 * button the operator may not have permission to press.
 */
export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact,
}) {
  return (
    <div className={`empty-state${compact ? ' empty-state-compact' : ''}`}>
      {icon && (
        <span className="empty-state-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-body">{description}</p>}
      {(actionLabel || secondaryLabel) && (
        <div className="empty-state-actions">
          {actionLabel && (
            <Button type="primary" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryLabel && (
            <Button onClick={onSecondary}>{secondaryLabel}</Button>
          )}
        </div>
      )}
    </div>
  )
}
