import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from './stores'
import MainLayout from './components/layout/MainLayout'
import AdminDataProvider from './components/AdminDataProvider'
import AuthSessionWatcher from './components/AuthSessionWatcher'
import RequirePermission from './components/rbac/RequirePermission'
import { PERMISSIONS } from './rbac/permissions'

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
const CreateOrder = lazy(() => import('./pages/orders/CreateOrder'))
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
  <Spin size="large" tip="در حال بارگذاری..." spinning>
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}
    />
  </Spin>
)

function App() {
  const { isAuthenticated, user } = useAuthStore()

  return (
    <>
      <AuthSessionWatcher />
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
                    <Route
                      path="/"
                      element={
                        <RequirePermission permission={PERMISSIONS.DASHBOARD_VIEW}>
                          <Dashboard />
                        </RequirePermission>
                      }
                    />

                    {/* Products */}
                    <Route
                      path="/products"
                      element={
                        <RequirePermission permission={PERMISSIONS.PRODUCT_READ}>
                          <ProductsList />
                        </RequirePermission>
                      }
                    />
                    {/* لیست محصولات متغیر (فقط productType=variable) */}
                    <Route
                      path="/products/variable"
                      element={
                        <RequirePermission permission={PERMISSIONS.PRODUCT_READ}>
                          <ProductsList mode="variable" />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/products/new"
                      element={
                        <RequirePermission permission={PERMISSIONS.PRODUCT_CREATE}>
                          <ProductForm />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/products/edit/:id"
                      element={
                        <RequirePermission permission={PERMISSIONS.PRODUCT_UPDATE}>
                          <ProductForm />
                        </RequirePermission>
                      }
                    />
                    {/* صفحه جانبی (در حال حاضر فقط اطلاع‌رسانی) برای واریانت‌ها */}
                    <Route
                      path="/products/:id/variants"
                      element={
                        <RequirePermission permission={PERMISSIONS.PRODUCT_READ}>
                          <ProductVariants />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/categories"
                      element={
                        <RequirePermission permission={PERMISSIONS.CATEGORY_READ}>
                          <CategoriesPage />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/brands"
                      element={
                        <RequirePermission permission={PERMISSIONS.BRAND_READ}>
                          <BrandsPage />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/inventory"
                      element={
                        <RequirePermission permission={PERMISSIONS.PRODUCT_MANAGE_STOCK}>
                          <InventoryPage />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/reviews"
                      element={
                        <RequirePermission permission={PERMISSIONS.REVIEW_READ}>
                          <ReviewsPage />
                        </RequirePermission>
                      }
                    />

                    {/* Orders */}
                    <Route
                      path="/orders"
                      element={
                        <RequirePermission permission={PERMISSIONS.ORDER_READ_ALL}>
                          <OrdersList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/orders/create"
                      element={
                        <RequirePermission permission={PERMISSIONS.ORDER_CREATE}>
                          <CreateOrder />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/orders/:id"
                      element={
                        <RequirePermission permission={PERMISSIONS.ORDER_READ_ALL}>
                          <OrderDetail />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/abandoned-carts"
                      element={
                        <RequirePermission permission={PERMISSIONS.CART_READ}>
                          <AbandonedCartsPage />
                        </RequirePermission>
                      }
                    />

                    {/* Customers */}
                    <Route
                      path="/customers"
                      element={
                        <RequirePermission permission={PERMISSIONS.USER_READ_ALL}>
                          <CustomersList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/customers/:id"
                      element={
                        <RequirePermission permission={PERMISSIONS.USER_READ}>
                          <CustomerProfile />
                        </RequirePermission>
                      }
                    />

                    {/* Finance */}
                    <Route
                      path="/coupons"
                      element={
                        <RequirePermission permission={PERMISSIONS.COUPON_READ}>
                          <CouponsPage />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/sales"
                      element={
                        <RequirePermission permission={PERMISSIONS.SALE_READ}>
                          <SalesPage />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/shipping"
                      element={
                        <RequirePermission permission={PERMISSIONS.SHIPPING_READ}>
                          <ShippingPage />
                        </RequirePermission>
                      }
                    />

                    {/* Content */}
                    <Route
                      path="/pages"
                      element={
                        <RequirePermission permission={PERMISSIONS.PAGE_READ}>
                          <PagesManagement />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/blog/posts"
                      element={
                        <RequirePermission permission={PERMISSIONS.BLOG_READ}>
                          <BlogPosts />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/banners"
                      element={
                        <RequirePermission permission={PERMISSIONS.BANNER_READ}>
                          <BannersPage />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/announcements"
                      element={
                        <RequirePermission permission={PERMISSIONS.ANNOUNCEMENT_READ}>
                          <AnnouncementsPage />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/newsletter"
                      element={
                        user?.role === 'admin' || user?.role === 'manager' || user?.role === 'superadmin'
                          ? <NewsletterPage />
                          : <Navigate to="/" />
                      }
                    />

                    {/* Tickets */}
                    <Route
                      path="/tickets"
                      element={
                        <RequirePermission permission={PERMISSIONS.TICKET_READ_ALL}>
                          <TicketsList />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/tickets/:id"
                      element={
                        <RequirePermission permission={PERMISSIONS.TICKET_READ_ALL}>
                          <TicketDetail />
                        </RequirePermission>
                      }
                    />

                    {/* Settings */}
                    <Route
                      path="/settings"
                      element={
                        <RequirePermission permission={PERMISSIONS.SETTINGS_READ}>
                          <SettingsPage />
                        </RequirePermission>
                      }
                    />

                    {/* Reports */}
                    <Route
                      path="/reports/sales"
                      element={
                        <RequirePermission permission={PERMISSIONS.REPORT_READ_SALES}>
                          <SalesReports />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/reports/products"
                      element={
                        <RequirePermission permission={PERMISSIONS.REPORT_READ_PRODUCTS}>
                          <ProductsReports />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/reports/customers"
                      element={
                        <RequirePermission permission={PERMISSIONS.REPORT_READ_CUSTOMERS}>
                          <CustomersReports />
                        </RequirePermission>
                      }
                    />
                    <Route
                      path="/reports/audit-logs"
                      element={
                        <RequirePermission permission={PERMISSIONS.ADMIN_READ}>
                          <AuditLogs />
                        </RequirePermission>
                      }
                    />

                    {/* Admins */}
                    <Route
                      path="/admins"
                      element={
                        <RequirePermission permission={PERMISSIONS.ADMIN_READ}>
                          <AdminsPage />
                        </RequirePermission>
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
    </>
  )
}

export default App
