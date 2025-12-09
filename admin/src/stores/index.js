import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ========================
// Auth store (persisted)
// ========================
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) =>
        set({ user, token, isAuthenticated: Boolean(user && token) }),

      setUser: (user) => set({ user }),

      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    { name: 'auth-storage' },
  ),
)

// ========================
// Dashboard store
// ========================
export const useDashboardStore = create((set) => ({
  widgetLayout: [
    { id: '1', title: 'Today Sales', component: 'TodaySales' },
    { id: '2', title: 'Pending Orders', component: 'PendingOrders' },
    { id: '3', title: 'Low Stock', component: 'LowStock' },
    { id: '4', title: 'Abandoned Carts', component: 'AbandonedCarts' },
    { id: '5', title: 'Sales Chart', component: 'SalesChart' },
    { id: '6', title: 'Recent Orders', component: 'RecentOrders' },
    { id: '7', title: 'New Customers', component: 'NewCustomers' },
    { id: '8', title: 'Conversion Rate', component: 'ConversionRate' },
  ],

  reorderWidgets: (newLayout) => set({ widgetLayout: newLayout }),
}))

// ========================
// Notification store (persisted)
// ========================
export const useNotificationStore = create(
  persist(
    (set) => ({
      notifications: [],

      // افزودن نوتیفیکیشن جدید (مثلاً برای یادداشت ادمین روی سفارش)
      addNotification: (notification) =>
        set((state) => {
          const id = notification.id || String(Date.now())
          const createdAt = notification.createdAt || Date.now()

          const newNotification = {
            id,
            read: false,
            ...notification,
            createdAt,
          }

          return {
            notifications: [newNotification, ...state.notifications],
          }
        }),

      // حذف یک نوتیفیکیشن
      deleteNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        })),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
    }),
    { name: 'notification-storage' },
  ),
)

// ============================================
// Category Store - Single Source of Truth
// ============================================
export const useCategoryStore = create((set, get) => ({
  categoriesTree: [],
  categoriesFlat: [],
  loading: false,
  error: null,

  fetchCategoriesTree: async () => {
    if (get().loading) return

    set({ loading: true, error: null })
    try {
      const api = (await import('../api')).default
      // Cache busting: add timestamp to bypass browser cache
      const response = await api.get(`/categories/tree?_t=${Date.now()}`)
      const rawData = response?.data?.data || []

      const getImageUrl = (img) => {
        if (!img) return null
        if (typeof img === 'string') return img
        if (typeof img === 'object' && img.url) return img.url
        return null
      }

      const toAntTree = (nodes = []) =>
        nodes.map((n) => ({
          title: n.name,
          key: n._id,
          value: n._id,
          _id: n._id, // Also include _id for compatibility
          parent: n.parent || null,
          description: n.description || '',
          isFeatured: !!n.isFeatured,
          isPopular: !!n.isPopular,
          icon: n.icon || null,
          image: n.image || null,
          iconUrl: getImageUrl(n.icon),
          imageUrl: getImageUrl(n.image),
          properties: n.properties || [], // CRITICAL: Include properties for category specs
          children: n.children ? toAntTree(n.children) : [],
        }))

      const treeData = toAntTree(rawData)

      const flatten = (nodes = [], parentName = '') => {
        let result = []
        nodes.forEach((n) => {
          const displayName = parentName ? `${parentName} > ${n.title}` : n.title
          result.push({ _id: n.value, name: displayName, title: n.title })
          if (n.children && n.children.length > 0) {
            result = result.concat(flatten(n.children, displayName))
          }
        })
        return result
      }

      set({
        categoriesTree: treeData,
        categoriesFlat: flatten(treeData),
        loading: false,
      })
      // eslint-disable-next-line no-console
      console.log(
        'Categories tree loaded successfully:',
        treeData.length,
        'root nodes',
      )
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch categories:', error)
      set({
        error:
          error?.message ||
          'خطا در دریافت لیست دسته‌بندی‌ها. لطفاً دوباره تلاش کنید.',
        loading: false,
        categoriesTree: [],
        categoriesFlat: [],
      })
    }
  },

  clearCategories: () => set({ categoriesTree: [], categoriesFlat: [] }),
}))

// ============================================
// Brand Store - Single Source of Truth
// ============================================
export const useBrandStore = create((set, get) => ({
  brands: [],
  loading: false,
  error: null,

  fetchBrands: async () => {
    if (get().loading) return

    set({ loading: true, error: null })
    try {
      const api = (await import('../api')).default
      const response = await api.get('/brands')
      const rawData = response?.data?.data || []

      set({
        brands: rawData,
        loading: false,
      })
      // eslint-disable-next-line no-console
      console.log('Brands loaded successfully:', rawData.length, 'brands')
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch brands:', error)
      set({
        error:
          error?.message ||
          'خطا در دریافت لیست برندها. لطفاً دوباره تلاش کنید.',
        loading: false,
        brands: [],
      })
    }
  },

  clearBrands: () => set({ brands: [] }),
}))

