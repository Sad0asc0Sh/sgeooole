import { Link } from 'react-router-dom'
import { ArrowLeftOutlined } from '@ant-design/icons'
import './AuthShell.css'

/**
 * The shell every signed-out screen sits in: the brand mark, the form,
 * and a route back to sign-in.
 *
 * Three pages used to each paint their own full-screen indigo gradient,
 * so the panel had a second, unrelated visual identity the moment you
 * left it. Sharing this one component — with the saffron mark from the
 * rail — is what makes signing in feel like entering the same product.
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">
            <span className="auth-brand-dot" />
          </span>
          <span className="auth-brand-text">
            <span className="auth-brand-name">ای‌کا کالا</span>
            <span className="auth-brand-sub">پنل مدیریت</span>
          </span>
        </div>

        <div className="auth-head">
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        </div>

        <div className="auth-body">{children}</div>

        <div className="auth-foot">
          {footer}
          <Link to="/login" className="auth-back">
            <ArrowLeftOutlined />
            بازگشت به ورود
          </Link>
        </div>
      </div>
    </div>
  )
}
