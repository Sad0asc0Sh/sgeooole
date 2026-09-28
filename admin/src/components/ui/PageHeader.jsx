/**
 * PageHeader — the opening block every page shares.
 *
 * Thirty-odd pages each used to open with their own hand-written flex
 * row, which is why titles sat at different sizes and actions landed at
 * different heights. One component makes them line up, and gives every
 * page the same answer to "where am I and what can I do here".
 */
import './PageHeader.css'

export default function PageHeader({ title, subtitle, count, actions, children }) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1>
          {title}
          {count != null && <span className="page-header-count">{count}</span>}
        </h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  )
}
