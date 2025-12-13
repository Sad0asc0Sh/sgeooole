import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from './stores'
import MainLayout from './components/layout/MainLayout'
import AdminDataProvider from './components/AdminDataProvider'

// LoginPage - not lazy (needed immediately)
import LoginPage from './pages/LoginPage'

// Lazy-loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'))

// Products
const ProductsList = lazy(() => import('./pages/products/ProductsList'))
const ProductForm = lazy(() => import('./pages/products/ProductForm'))
const ProductVariants = lazy(() => import('./pages/products/ProductVariants'))
const CategoriesPage = lazy(() => import('./pages/products/CategoriesPage'))
const BrandsPage = lazy(() => import('./pages/products/BrandsPage'))
const InventoryPage = lazy(() => import('./pages/products/InventoryPage'))
const ReviewsPage = lazy(() => import('./pages/products/ReviewsPage'))

// Orders
const OrdersList = lazy(() => import('./pages/orders/OrdersList'))
const OrderDetail = lazy(() => import('./pages/orders/OrderDetail'))
const AbandonedCartsPage = lazy(() => import('./pages/orders/AbandonedCartsPage'))

// Customers
const CustomersList = lazy(() => import('./pages/customers/CustomersList'))
const CustomerProfile = lazy(() => import('./pages/customers/CustomerProfile'))

// Finance
const CouponsPage = lazy(() => import('./pages/finance/CouponsPage'))
const SalesPage = lazy(() => import('./pages/finance/SalesPage'))
const ShippingPage = lazy(() => import('./pages/finance/ShippingPage'))

// Content
const PagesManagement = lazy(() => import('./pages/content/PagesManagement'))
const BlogPosts = lazy(() => import('./pages/content/BlogPosts'))
const BannersPage = lazy(() => import('./pages/content/BannersPage'))
const AnnouncementsPage = lazy(() => import('./pages/content/AnnouncementsPage'))
const NewsletterPage = lazy(() => import('./pages/content/NewsletterPage'))

// Tickets
const TicketsList = lazy(() => import('./pages/tickets/TicketsList'))
const TicketDetail = lazy(() => import('./pages/tickets/TicketDetail'))

// Settings
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'))

// Reports
const SalesReports = lazy(() => import('./pages/reports/SalesReports'))
const ProductsReports = lazy(() => import('./pages/reports/ProductsReports'))
const CustomersReports = lazy(() => import('./pages/reports/CustomersReports'))
const AuditLogs = lazy(() => import('./pages/reports/AuditLogs'))

// Admins
const AdminsPage = lazy(() => import('./pages/admins/AdminsPage'))

// Profile
const AdminProfilePage = lazy(() => import('./pages/profile/AdminProfilePage'))

// Auth Pages (Password Reset)
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))

// Loading fallback component
const LoadingFallback = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
    }}
  >
    <Spin size="large" tip="در حال بارگذاری..." />
  </div>
)

function App() {
  const { isAuthenticated, user } = useAuthStore()

  return (
    <Routes>
      {/* Login */}
      <Route
        path="/login"
        element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />}
      />

      {/* Password Reset Pages - Public Routes */}
      <Route
        path="/forgot-password"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <ForgotPasswordPage />
          </Suspense>
        }
      />
      <Route
        path="/reset-password/:token"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <ResetPasswordPage />
          </Suspense>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <AdminDataProvider>
              <MainLayout>
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                    {/* Dashboard */}
                    <Route path="/" element={<Dashboard />} />

                    {/* Products */}
                    <Route path="/products" element={<ProductsList />} />
                    {/* لیست محصولات متغیر (فقط productType=variable) */}
                    <Route
                      path="/products/variable"
                      element={<ProductsList mode="variable" />}
                    />
                    <Route path="/products/new" element={<ProductForm />} />
                    <Route path="/products/edit/:id" element={<ProductForm />} />
                    {/* صفحه جانبی (در حال حاضر فقط اطلاع‌رسانی) برای واریانت‌ها */}
                    <Route
                      path="/products/:id/variants"
                      element={<ProductVariants />}
                    />
                    <Route path="/categories" element={<CategoriesPage />} />
                    <Route path="/brands" element={<BrandsPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/reviews" element={<ReviewsPage />} />

                    {/* Orders */}
                    <Route path="/orders" element={<OrdersList />} />
                    <Route path="/orders/:id" element={<OrderDetail />} />
                    <Route path="/abandoned-carts" element={<AbandonedCartsPage />} />

                    {/* Customers */}
                    <Route path="/customers" element={<CustomersList />} />
                    <Route path="/customers/:id" element={<CustomerProfile />} />

                    {/* Finance */}
                    <Route path="/coupons" element={<CouponsPage />} />
                    <Route path="/sales" element={<SalesPage />} />
                    <Route path="/shipping" element={<ShippingPage />} />

                    {/* Content */}
                    <Route path="/pages" element={<PagesManagement />} />
                    <Route path="/blog/posts" element={<BlogPosts />} />
                    <Route path="/banners" element={<BannersPage />} />
                    <Route path="/announcements" element={<AnnouncementsPage />} />
                    <Route path="/newsletter" element={<NewsletterPage />} />

                    {/* Tickets */}
                    <Route path="/tickets" element={<TicketsList />} />
                    <Route path="/tickets/:id" element={<TicketDetail />} />

                    {/* Settings */}
                    <Route
                      path="/settings"
                      element={
                        user?.role === 'manager' || user?.role === 'superadmin'
                          ? <SettingsPage />
                          : <Navigate to="/" />
                      }
                    />

                    {/* Reports */}
                    <Route path="/reports/sales" element={<SalesReports />} />
                    <Route path="/reports/products" element={<ProductsReports />} />
                    <Route path="/reports/customers" element={<CustomersReports />} />
                    <Route path="/reports/audit-logs" element={<AuditLogs />} />

                    {/* Admins */}
                    <Route
                      path="/admins"
                      element={
                        user?.role === 'superadmin' ? <AdminsPage /> : <Navigate to="/" />
                      }
                    />

                    {/* Profile */}
                    <Route path="/profile" element={<AdminProfilePage />} />

                    {/* 404 */}
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </Suspense>
              </MainLayout>
            </AdminDataProvider>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  )
}

export default App
