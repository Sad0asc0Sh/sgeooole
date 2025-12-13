"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import { Loader2, SlidersHorizontal, X, Search, ArrowUpDown, Check, ChevronDown } from "lucide-react";
import ProductCard from "@/components/product/ProductCard";
import { Product, productService, CategoryProperty, CategoryDetails } from "@/services/productService";
import { brandService, Brand } from "@/services/brandService";

function ProductListingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

  // URL Params
  const categorySlug = searchParams.get("category");
  const brandSlug = searchParams.get("brand");
  const searchQuery = searchParams.get("search");
  const sortParam = searchParams.get("sort") || "newest";
  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");
  const includeChildrenParam = searchParams.get("includeChildren") === "true";

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 });
  const [sliderValue, setSliderValue] = useState<[number, number]>([0, 0]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);

  // Category properties state for dynamic filters
  const [categoryDetails, setCategoryDetails] = useState<CategoryDetails | null>(null);
  const [selectedProperties, setSelectedProperties] = useState<Record<string, string>>({});

  // Brand state
  const [brandDetails, setBrandDetails] = useState<Brand | null>(null);
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({});

  // Parse property filters from URL
  const getPropertyFiltersFromUrl = useCallback(() => {
    const props: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith('prop_')) {
        const propName = key.replace('prop_', '');
        props[propName] = value;
      }
    });
    return props;
  }, [searchParams]);

  // Fetch category details when category changes
  useEffect(() => {
    const fetchCategoryDetails = async () => {
      if (categorySlug) {
        const details = await productService.getCategoryBySlug(categorySlug);
        setCategoryDetails(details);
        if (details?.properties) {
          const expanded: Record<string, boolean> = {};
          details.properties.forEach((p: CategoryProperty, i: number) => {
            expanded[p.name] = i < 3;
          });
          setExpandedFilters(expanded);
        }
      } else {
        setCategoryDetails(null);
      }
    };
    fetchCategoryDetails();
  }, [categorySlug]);

  // Fetch brand details when brand changes
  useEffect(() => {
    const fetchBrandDetails = async () => {
      if (brandSlug) {
        try {
          const brand = await brandService.getBySlug(brandSlug);
          setBrandDetails(brand);
        } catch (error) {
          console.error("Failed to fetch brand:", error);
          setBrandDetails(null);
        }
      } else {
        setBrandDetails(null);
      }
    };
    fetchBrandDetails();
  }, [brandSlug]);

  // Sync URL property filters to state
  useEffect(() => {
    setSelectedProperties(getPropertyFiltersFromUrl());
  }, [getPropertyFiltersFromUrl]);

  // Load Products
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const propertyFilters = getPropertyFiltersFromUrl();

        const data = await productService.getProducts({
          page: 1,
          limit: 20,
          sort: sortParam,
          category: categorySlug || undefined,
          brand: brandSlug || undefined,
          search: searchQuery || undefined,
          minPrice: minPriceParam ? Number(minPriceParam) : undefined,
          maxPrice: maxPriceParam ? Number(maxPriceParam) : undefined,
          includeChildren: includeChildrenParam,
          properties: Object.keys(propertyFilters).length > 0 ? propertyFilters : undefined,
        });

        let finalProducts = data.products;
        if (searchParams.get("inStock") === "true") {
          finalProducts = finalProducts.filter((p) => p.countInStock > 0);
        }

        setProducts(finalProducts);
        setTotal(data.total);

        if (data.priceRange) {
          setPriceRange(data.priceRange);
          if (!minPriceParam && !maxPriceParam) {
            // User requested range to start from 0
            setSliderValue([0, data.priceRange.max]);
          } else {
            setSliderValue([
              minPriceParam ? Number(minPriceParam) : data.priceRange.min,
              maxPriceParam ? Number(maxPriceParam) : data.priceRange.max,
            ]);
          }
        }
      } catch (error) {
        console.error("Failed to load products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [categorySlug, brandSlug, searchQuery, sortParam, minPriceParam, maxPriceParam, includeChildrenParam, searchParams, getPropertyFiltersFromUrl]);

  // Handlers
  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", sort);
    router.push(`/products?${params.toString()}`);
  };

  const handlePriceFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("minPrice", sliderValue[0].toString());
    params.set("maxPrice", sliderValue[1].toString());
    router.push(`/products?${params.toString()}`);
  };

  const handleClearFilters = () => {
    if (brandSlug) {
      router.push(`/products?brand=${brandSlug}`);
    } else if (categorySlug) {
      router.push(`/products?category=${categorySlug}&includeChildren=true`);
    } else {
      router.push("/products");
    }
  };

  const handlePropertyFilter = (propertyName: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const key = `prop_${propertyName}`;

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    router.push(`/products?${params.toString()}`);
  };

  const toggleFilterExpanded = (name: string) => {
    setExpandedFilters(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const itemList =
    !loading && products.length > 0
      ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: products.map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${siteUrl || ""}/product/${product.slug || product.id}`,
          name: product.title || product.name,
        })),
      }
      : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 pt-6">
      <div className="container mx-auto max-w-7xl px-4">
        {/* Search Results Header */}
        {searchQuery && !brandDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-gradient-to-l from-white via-white to-[#faf8f0] rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden relative"
          >
            {/* Decorative Pattern */}
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#D4AF37]/5 to-transparent" />

            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#C9A033] flex items-center justify-center shadow-lg shadow-[#D4AF37]/20">
                <Search className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-bold text-gray-900">
                  نتایج جستجو برای{" "}
                  <span className="text-[#D4AF37]">«{searchQuery}»</span>
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {loading ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      در حال جستجو...
                    </span>
                  ) : (
                    <>
                      <span className="font-bold text-gray-700">{total}</span> محصول پیدا شد
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => router.push('/products')}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                حذف جستجو
              </button>
            </div>
          </motion.div>
        )}

        {/* Brand Header */}
        {brandDetails && (
          <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-4">
              {brandDetails.logo?.url && (
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
                  <img
                    src={brandDetails.logo.url}
                    alt={brandDetails.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">محصولات {brandDetails.name}</h1>
                {brandDetails.description && (
                  <p className="text-sm text-gray-500 mt-1">{brandDetails.description}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-6">
          {itemList && (
            <script
              type="application/ld+json"
              suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
            />
          )}
          {/* Sidebar (Filters) */}
          <aside
            className={`
          fixed inset-0 z-[100] bg-white lg:static lg:bg-transparent lg:z-auto lg:w-64 lg:block
          ${showFilters ? "block" : "hidden"}
        `}
          >
            <div className="h-full lg:h-auto overflow-y-auto p-5 lg:p-0 bg-white lg:bg-transparent">
              <div className="flex items-center justify-between lg:hidden mb-6">
                <span className="font-bold text-lg">فیلترها</span>
                <button onClick={() => setShowFilters(false)}>
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Active Filters Summary */}
                {(minPriceParam || maxPriceParam || Object.keys(selectedProperties).length > 0) && (
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-500">فیلترهای فعال</span>
                      <button onClick={handleClearFilters} className="text-[10px] text-red-500 hover:underline">
                        حذف همه
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {minPriceParam && (
                        <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded-md">
                          از {Number(minPriceParam).toLocaleString()} تومان
                        </span>
                      )}
                      {maxPriceParam && (
                        <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded-md">
                          تا {Number(maxPriceParam).toLocaleString()} تومان
                        </span>
                      )}
                      {Object.entries(selectedProperties).map(([key, value]) => (
                        <button
                          key={key}
                          onClick={() => handlePropertyFilter(key, '')}
                          className="bg-vita-100 text-vita-700 text-[10px] px-2 py-1 rounded-md flex items-center gap-1 hover:bg-vita-200"
                        >
                          {key}: {value}
                          <X size={10} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Range */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-sm text-gray-800 mb-4">بازه قیمت (تومان)</h3>
                  <div className="px-2 mb-6" dir="ltr">
                    <Slider
                      range
                      min={0}
                      max={priceRange.max}
                      value={sliderValue}
                      onChange={(val) => setSliderValue(val as [number, number])}
                      reverse={true}
                      trackStyle={[{ backgroundColor: "#f97316" }]}
                      handleStyle={[
                        { borderColor: "#f97316", backgroundColor: "#fff", opacity: 1 },
                        { borderColor: "#f97316", backgroundColor: "#fff", opacity: 1 },
                      ]}
                      railStyle={{ backgroundColor: "#e5e7eb" }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-4 font-medium">
                    <span>{sliderValue[0].toLocaleString()}</span>
                    <span>{sliderValue[1].toLocaleString()}</span>
                  </div>
                  <button
                    onClick={() => {
                      handlePriceFilter();
                      setShowFilters(false);
                    }}
                    className="w-full bg-gray-900 text-white text-xs font-bold py-2 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    اعمال بازه قیمت
                  </button>
                </div>

                {/* Mobile Availability Toggle */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700">فقط کالاهای موجود</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={searchParams.get("inStock") === "true"}
                      onChange={(e) => {
                        const params = new URLSearchParams(searchParams.toString());
                        if (e.target.checked) params.set("inStock", "true");
                        else params.delete("inStock");
                        router.push(`/products?${params.toString()}`);
                      }}
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-vita-500"></div>
                  </label>
                </div>

                {/* Dynamic Category Properties Filters */}
                {categoryDetails && categoryDetails.properties.length > 0 && (
                  <div className="space-y-3">
                    {categoryDetails.properties.map((prop) => (
                      <div key={prop.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <button
                          onClick={() => toggleFilterExpanded(prop.name)}
                          className="w-full flex items-center justify-between p-4 text-right"
                        >
                          <span className="font-bold text-sm text-gray-800">
                            {prop.name}
                            {prop.unit && <span className="font-normal text-gray-500 text-xs mr-1">({prop.unit})</span>}
                          </span>
                          <ChevronDown
                            className={`text-gray-400 transition-transform ${expandedFilters[prop.name] ? 'rotate-180' : ''}`}
                            size={18}
                          />
                        </button>

                        {expandedFilters[prop.name] && (
                          <div className="px-4 pb-4">
                            {prop.type === 'select' && prop.options && prop.options.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {prop.options.map((option) => {
                                  const isSelected = selectedProperties[prop.name] === option;
                                  return (
                                    <button
                                      key={option}
                                      onClick={() => {
                                        handlePropertyFilter(prop.name, isSelected ? '' : option);
                                        setShowFilters(false);
                                      }}
                                      className={`
                                      px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                      ${isSelected
                                          ? 'bg-vita-500 text-white shadow-sm'
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }
                                    `}
                                    >
                                      {option}
                                      {isSelected && <Check size={12} className="inline mr-1" />}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <input
                                type={prop.type === 'number' ? 'number' : 'text'}
                                placeholder={`جستجو در ${prop.name}...`}
                                value={selectedProperties[prop.name] || ''}
                                onChange={(e) => handlePropertyFilter(prop.name, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-vita-200 focus:border-vita-400"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Main Content (Grid) */}
          <main className="flex-1">
            {/* Filter & Sort Bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSortSheet(true)}
                  className="flex items-center gap-2 bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                >
                  <ArrowUpDown size={16} />
                  <span className="hidden sm:inline">مرتب‌سازی بر اساس:</span>
                  <span className="text-vita-600">
                    {{
                      newest: "جدیدترین",
                      priceAsc: "ارزان‌ترین",
                      priceDesc: "گران‌ترین",
                      popularity: "محبوب‌ترین",
                      bestSelling: "پرفروش‌ترین",
                      discount: "بیشترین تخفیف",
                    }[sortParam] || "جدیدترین"}
                  </span>
                </button>

                <button
                  onClick={() => setShowFilters(true)}
                  className="lg:hidden flex items-center gap-2 bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                >
                  <SlidersHorizontal size={16} />
                  فیلترها
                </button>
              </div>

              <div className="text-xs text-gray-500">
                <span className="font-bold text-gray-800">{total}</span> محصول
              </div>
            </div>

            {/* Products Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-vita-500" />
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Search size={48} className="mb-4" />
                <p className="text-lg font-bold">محصولی یافت نشد</p>
                <p className="text-sm">فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید</p>
              </div>
            ) : (
              <motion.div
                layout
                className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4"
              >
                <AnimatePresence mode="popLayout">
                  {products.map((product) => (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </main>
        </div>
      </div>

      {/* Sort Bottom Sheet (Mobile) */}
      <AnimatePresence>
        {showSortSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[199]"
              onClick={() => setShowSortSheet(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[200] p-6 pb-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg">مرتب‌سازی</h3>
                <button onClick={() => setShowSortSheet(false)}>
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {[
                  { value: "newest", label: "جدیدترین" },
                  { value: "priceAsc", label: "ارزان‌ترین" },
                  { value: "priceDesc", label: "گران‌ترین" },
                  { value: "popularity", label: "محبوب‌ترین" },
                  { value: "bestSelling", label: "پرفروش‌ترین" },
                  { value: "discount", label: "بیشترین تخفیف" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      handleSortChange(option.value);
                      setShowSortSheet(false);
                    }}
                    className={`w-full flex items-center justify-between p-4 rounded-xl text-sm font-bold transition-colors ${sortParam === option.value
                      ? "bg-vita-50 text-vita-600"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                      }`}
                  >
                    {option.label}
                    {sortParam === option.value && <Check size={18} />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProductsPageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-vita-500" />
        </div>
      }
    >
      <ProductListingContent />
    </Suspense>
  );
}
