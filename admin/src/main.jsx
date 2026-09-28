import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, Button } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import faIR from 'antd/locale/fa_IR'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupViewportHeight } from './utils/viewportHeight'
import { adminTheme } from './theme/antdTheme'
import './jalaliSetup'
import App from './App'
import './theme/tokens.css'
import './index.css'

// Publish the REAL visible viewport height (--app-vh) for mobile browsers
// so fixed-height layouts never hide their bottom behind browser chrome.
setupViewportHeight()

// Create a client for React Query (v5 - cacheTime renamed to gcTime)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      gcTime: 1000 * 60 * 10,    // 10 minutes (was cacheTime in v4)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// =====================================================================
// Error Boundary - جلوگیری از صفحه سفید در صورت خطای ناخواسته
// =====================================================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught an error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="crash-screen">
          <div className="crash-card">
            <span className="crash-icon" aria-hidden="true">
              <WarningOutlined />
            </span>
            <h1 className="crash-title">پنل مدیریت باز نشد</h1>
            <p className="crash-body">
              خطایی هنگام بارگذاری رخ داد. صفحه را تازه کنید؛ اگر مشکل ادامه
              داشت، جزئیات زیر را برای پشتیبانی بفرستید.
            </p>
            <div className="crash-actions">
              <Button type="primary" onClick={() => window.location.reload()}>
                تازه‌سازی صفحه
              </Button>
            </div>
            {this.state.error && (
              <details className="crash-details">
                <summary>جزئیات خطا</summary>
                <pre>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ConfigProvider locale={faIR} direction="rtl" theme={adminTheme}>
            <App />
          </ConfigProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
