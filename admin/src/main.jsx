import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import faIR from 'antd/locale/fa_IR'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './jalaliSetup'
import App from './App'
import './index.css'

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
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#f5f5f5',
          fontFamily: 'Tahoma, Arial, sans-serif',
          direction: 'rtl',
          padding: 24,
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 40,
            maxWidth: 600,
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: '#e53935', fontSize: 22, marginBottom: 12 }}>
              خطایی در بارگذاری پنل ادمین رخ داد
            </h2>
            <p style={{ color: '#666', marginBottom: 24, lineHeight: 1.8 }}>
              لطفاً صفحه را رفرش کنید. اگر مشکل ادامه داشت، با پشتیبانی تماس بگیرید.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '12px 32px',
                fontSize: 16,
                cursor: 'pointer',
                marginBottom: 20,
              }}
            >
              🔄 رفرش صفحه
            </button>
            {this.state.error && (
              <details style={{ textAlign: 'left', direction: 'ltr', marginTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: '#999', fontSize: 13 }}>
                  جزئیات خطا (برای توسعه‌دهندگان)
                </summary>
                <pre style={{
                  background: '#f8f8f8',
                  padding: 12,
                  borderRadius: 6,
                  overflow: 'auto',
                  fontSize: 12,
                  color: '#d32f2f',
                  marginTop: 8,
                  maxHeight: 200,
                }}>
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
          <ConfigProvider
            locale={faIR}
            direction="rtl"
            theme={{
              token: {
                colorPrimary: '#1890ff',
                borderRadius: 6,
              },
            }}
          >
            <App />
          </ConfigProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
