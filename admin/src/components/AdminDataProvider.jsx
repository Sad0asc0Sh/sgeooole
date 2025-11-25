import { useEffect } from 'react'
import { useCategoryStore, useBrandStore } from '../stores'

/**
 * AdminDataProvider - Preloads Categories and Brands on mount
 *
 * This component ensures that Categories and Brands are fetched immediately
 * when the admin panel loads, making them available to all components
 * (especially ProductForm) without requiring individual fetches.
 *
 * Uses Zustand stores as the single source of truth.
 */
export default function AdminDataProvider({ children }) {
  const fetchCategoriesTree = useCategoryStore((state) => state.fetchCategoriesTree)
  const fetchBrands = useBrandStore((state) => state.fetchBrands)

  useEffect(() => {
    // Fetch both categories and brands in parallel when admin panel loads
    const loadGlobalData = async () => {
      try {
        await Promise.all([
          fetchCategoriesTree(),
          fetchBrands(),
        ])
        console.log('[AdminDataProvider] Global data loaded successfully')
      } catch (error) {
        console.error('[AdminDataProvider] Error loading global data:', error)
      }
    }

    loadGlobalData()
  }, [fetchCategoriesTree, fetchBrands])

  // Simply render children - data is managed by Zustand stores
  return children
}
