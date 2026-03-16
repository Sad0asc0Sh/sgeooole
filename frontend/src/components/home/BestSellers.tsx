/**
 * 🏆 کامپوننت پرفروش‌ترین‌ها
 * 
 * نمایش لیستی از پرفروش‌ترین محصولات با:
 * - Badge های نمایشی (پرفروش، ترند، جدید)
 * - Impression Tracking
 * - Responsive Design
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TrendingUp, ShoppingCart, Star, AlertCircle } from 'lucide-react'

// Types
interface BestsellerScore {
  decayed_score: number
  final_score: number
  trend_score: number
  is_new: boolean
  trend_up: boolean
}

interface Product {
  _id: string
  name: string
  slug: string
  image?: { url: string }
  price: number
  discount: number
  average_rating: number
  review_count: number
  stock: number
  category?: { name: string }
  bestsellers_score: BestsellerScore
}

interface BestsellersResponse {
  success: boolean
  data: Product[]
}

// API Service
const API_BASE = typeof window === 'undefined' ? (process.env.INTERNAL_API_URL || 'http://localhost:5000/api') : (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api')

const bestsellersService = {
  getBestsellers: async (limit: number = 8, category: string | null = null, inStock: boolean = true): Promise<BestsellersResponse> => {
    const params = new URLSearchParams({
      limit: String(limit),
      in_stock: String(inStock),
    })

    if (category) {
      params.append('category', category)
    }

    const response = await fetch(`${API_BASE}/bestsellers?${params}`)
    if (!response.ok) throw new Error('Failed to fetch bestsellers')
    return response.json()
  },

  trackImpression: async (productId: string, section: string = 'bestsellers', position: number = 0): Promise<void> => {
    try {
      await fetch(`${API_BASE}/tracking/impression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          section,
          position,
        }),
      })
    } catch (error) {
      console.error('[BestSellers] Impression tracking failed:', error)
    }
  },
}

export default function BestSellers({
  title = '🏆 پرفروش‌ترین‌ها',
  subtitle = 'محصولات منتخب برای شما',
  limit = 8,
  category = null,
  showBadge = true,
  showTrendArrow = true,
}: {
  title?: string
  subtitle?: string
  limit?: number
  category?: string | null
  showBadge?: boolean
  showTrendArrow?: boolean
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const productsRef = useRef<(HTMLDivElement | null)[]>([])

  // دریافت پرفروش‌ترین‌ها
  useEffect(() => {
    const fetchBestsellers = async () => {
      try {
        setLoading(true)
        const response = await bestsellersService.getBestsellers(limit, category)
        setProducts(response.data || [])
        setError(null)
      } catch (err) {
        console.error('[BestSellers] Error:', err)
        setError('خطا در بارگذاری پرفروش‌ترین‌ها')
        setProducts([])
      } finally {
        setLoading(false)
      }
    }

    fetchBestsellers()

    // بروزرسانی هر 5 دقیقه
    const interval = setInterval(fetchBestsellers, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [limit, category])

  // Intersection Observer برای Impression Tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const productId = entry.target.getAttribute('data-product-id')
            const positionStr = entry.target.getAttribute('data-position')
            const position = positionStr ? parseInt(positionStr, 10) : 0
            if (productId) {
              bestsellersService.trackImpression(productId, 'bestsellers', position)
            }
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.5 }
    )

    productsRef.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [products])

  if (error) {
    return (
      <section className="py-8 px-4 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="py-12 px-4">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">{title}</h2>
        <p className="text-gray-600 mb-6">{subtitle}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="bg-gray-200 h-60 rounded-lg animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (products.length === 0) {
    return null
  }

  return (
    <section className="py-12 px-4 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
          <p className="text-lg text-gray-600">{subtitle}</p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((product, index) => {
            const { bestsellers_score } = product
            const isTrending = bestsellers_score && bestsellers_score.trend_up
            const isNew = bestsellers_score && bestsellers_score.is_new
            const isPremium = bestsellers_score && bestsellers_score.decayed_score > 0.8

            return (
              <div
                key={product._id}
                ref={(el) => {
                  if (el) {
                    productsRef.current[index] = el
                  }
                }}
                data-product-id={product._id}
                data-position={index + 1}
                className="group relative rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-blue-300"
              >
                {/* Badges */}
                <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
                  {showBadge && (
                    <>
                      {isPremium && (
                        <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                          ⭐ پرفروش
                        </span>
                      )}
                      {isTrending && showTrendArrow && (
                        <span className="bg-orange-400 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> ترند
                        </span>
                      )}
                      {isNew && (
                        <span className="bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                          🆕 جدید
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Image */}
                <Link href={`/product/${product.slug}`}>
                  <div className="relative w-full bg-gray-100 overflow-hidden" style={{ aspectRatio: '1' }}>
                    {product.image?.url ? (
                      <Image
                        src={product.image.url}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-400">بدون تصویر</span>
                      </div>
                    )}

                    {/* Discount Badge */}
                    {product.discount > 0 && (
                      <div className="absolute bottom-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                        {product.discount}٪
                      </div>
                    )}
                  </div>
                </Link>

                {/* Content */}
                <div className="p-3">
                  {/* Category */}
                  {product.category && (
                    <p className="text-xs text-gray-500 mb-1">{product.category.name}</p>
                  )}

                  {/* Product Name */}
                  <Link href={`/product/${product.slug}`}>
                    <h3 className="font-semibold text-gray-900 line-clamp-2 hover:text-blue-600 transition">
                      {product.name}
                    </h3>
                  </Link>

                  {/* Rating */}
                  {product.review_count > 0 && (
                    <div className="flex items-center gap-1 mt-2 mb-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${i < Math.round(product.average_rating)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                              }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-600">({product.review_count})</span>
                    </div>
                  )}

                  {/* Price */}
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-lg font-bold text-blue-600">
                      {product.price?.toLocaleString('fa-IR')}
                    </span>
                    {product.discount > 0 && (
                      <span className="text-xs text-gray-500 line-through">
                        {(product.price / (1 - product.discount / 100))?.toLocaleString('fa-IR')}
                      </span>
                    )}
                  </div>

                  {/* Stock Status */}
                  {product.stock > 0 ? (
                    <p className="text-xs text-green-600 font-medium mb-3">✓ موجود</p>
                  ) : (
                    <p className="text-xs text-red-600 font-medium mb-3">✗ ناموجود</p>
                  )}

                  {/* Add to Cart Button */}
                  <button
                    onClick={() => router.push(`/product/${product.slug}`)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>مشاهده</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* View More Link */}
        <div className="mt-8 text-center">
          <Link
            href="/products?sort=bestseller"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition"
          >
            مشاهده تمام پرفروش‌ترین‌ها
          </Link>
        </div>
      </div>
    </section>
  )
}
