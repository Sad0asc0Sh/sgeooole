import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import faIR from 'antd/locale/fa_IR'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupViewportHeight } from './utils/viewportHeight'
import './jalaliSetup'
import App from './App'
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
                // ── Professional Indigo Palette ──
                colorPrimary: '#4f46e5',
                colorInfo: '#4f46e5',
                colorSuccess: '#16a34a',
                colorWarning: '#d97706',
                colorError: '#dc2626',
                colorLink: '#4f46e5',
                colorTextBase: '#1e293b',
                colorBgLayout: '#f1f5f9',
                colorBgContainer: '#ffffff',

                // ── Shape & Typography ──
                borderRadius: 10,
                borderRadiusLG: 14,
                fontSize: 13.5,
                fontFamily:
                  "'Vazirmatn', 'IRANSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif",

                // ── Elevation & Borders ──
                boxShadow:
                  '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
                boxShadowSecondary:
                  '0 4px 12px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04)',
                controlHeight: 36,
              },
              components: {
                Layout: {
                  headerBg: '#ffffff',
                  siderBg: '#0f172a',
                  bodyBg: '#f1f5f9',
                },
                Menu: {
                  darkItemBg: 'transparent',
                  darkSubMenuItemBg: 'transparent',
                  darkItemSelectedBg: '#4f46e5',
                  darkItemSelectedColor: '#ffffff',
                  darkItemColor: 'rgba(226, 232, 240, 0.82)',
                  darkItemHoverColor: '#ffffff',
                  darkItemHoverBg: 'rgba(255, 255, 255, 0.06)',
                  itemBorderRadius: 8,
                  itemMarginInline: 10,
                  itemHeight: 40,
                  iconSize: 16,
                },
                Table: {
                  headerBg: '#f8fafc',
                  headerColor: '#475569',
                  headerSplitColor: 'transparent',
                  rowHoverBg: '#f5f3ff',
                  borderColor: '#e2e8f0',
                  cellPaddingBlockMD: 12,
                  cellPaddingInlineMD: 12,
                  fontSizeSM: 12.5,
                },
                Card: {
                  paddingLG: 20,
                },
                Button: {
                  controlHeight: 36,
                  fontWeight: 500,
                  primaryShadow: '0 2px 6px rgba(79, 70, 229, 0.35)',
                },
                Input: { controlHeight: 36 },
                Select: { controlHeight: 36 },
                DatePicker: { controlHeight: 36 },
                Modal: {
                  borderRadiusLG: 16,
                  titleFontSize: 16,
                },
                Tag: { borderRadiusSM: 6 },
                Segmented: { itemSelectedBg: '#eef2ff' },
                Pagination: { itemSize: 32 },
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
