"use client";

import { useEffect, useLayoutEffect, useState, Suspense, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { useProductListing } from "@/hooks/useProductListing";
import { useCategoryTree } from "@/hooks/useCategories";
import { motion, AnimatePresence } from "framer-motion";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";
import {
  Loader2,
  SlidersHorizontal,
  X,
  Search,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Tag,
  LayoutGrid,
  Sparkles,
  Flame,
  TrendingUp,
} from "lucide-react";
import ProductCard from "@/components/product/ProductCard";
import { productService, CategoryProperty, CategoryDetails } from "@/services/productService";
import { brandService, Brand } from "@/services/brandService";
import { Category } from "@/services/categoryService";
import { getScrollManager } from "@/lib/scroll/ScrollManager";
import ProductListingSkeleton from "@/components/product/ProductListingSkeleton";
import { useRouteLoadingState } from "@/providers/RouteLoadingProvider";

// ─── Sort Options ────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: "newest", label: "جدیدترین", icon: Sparkles },
  { value: "bestSelling", label: "پرفروش‌ترین", icon: TrendingUp },
  { value: "priceAsc", label: "ارزان‌ترین", icon: ArrowUpDown },
  { value: "priceDesc", label: "گران‌ترین", icon: ArrowUpDown },
  { value: "popularity", label: "محبوب‌ترین", icon: LayoutGrid },
  { value: "discount", label: "بیشترین تخفیف", icon: Flame },
] as const;

// ─── CategoryTreeItem: Accordion drawer for categories ─────────
function CategoryTreeItem({
  category,
  level = 0,
  currentSlug,
  onSelect,
}: {
  category: Category;
  level?: number;
  currentSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const [expanded, setExpanded] = useState(() => {
    // Auto-expand if this category or a child is currently selected
    if (category.slug === currentSlug) return true;
    if (category.children?.some((c) => c.slug === currentSlug)) return true;
    return false;
  });

  const hasChildren = category.children && category.children.length > 0;
  const isActive = category.slug === currentSlug;
  const hasActiveChild = category.children?.some((c) => c.slug === currentSlug);

  return (
    <div className="mb-1">
      <div
        className={`flex items-center justify-between gap-2 rounded-xl cursor-pointer transition-all duration-200 group py-2.5 px-3
          ${isActive
            ? "bg-kala-50 text-kala-700 font-bold border border-kala-200/60 shadow-xs"
            : hasActiveChild
            ? "bg-amber-50/60 text-gray-800 font-semibold"
            : "hover:bg-gray-50 text-gray-700 font-medium"
          }`}
        style={{ paddingRight: `${12 + level * 14}px` }}
        onClick={(e) => {
          if (hasChildren) {
            e.stopPropagation();
            setExpanded(!expanded);
          } else {
            onSelect(category.slug);
          }
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {hasChildren ? (
            <span
              className={`w-6 h-6 rounded-lg bg-gray-100/80 flex items-center justify-center text-gray-500 group-hover:bg-gray-200/80 transition-transform duration-200 flex-shrink-0 ${
                expanded ? "rotate-180 text-kala-600 bg-kala-100/80" : ""
              }`}
            >
              <ChevronDown size={14} />
            </span>
          ) : (
            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <span
                className={`w-2 h-2 rounded-full ${
                  isActive ? "bg-kala-500 scale-125 ring-4 ring-kala-100" : "bg-gray-300"
                }`}
              />
            </span>
          )}
          <span className={`text-sm truncate ${level === 0 ? "font-bold text-gray-900" : "text-gray-700"}`}>
            {category.name}
          </span>
        </div>

        {/* Quick select badge for parent categories */}
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(category.slug);
            }}
            className={`text-[11px] px-2 py-0.5 rounded-lg font-bold transition-all flex-shrink-0 ${
              isActive
                ? "bg-kala-500 text-white shadow-xs"
                : "bg-gray-100 text-gray-500 hover:bg-kala-100 hover:text-kala-700"
            }`}
            title={`فیلتر بر اساس کل ${category.name}`}
          >
            {isActive ? "انتخاب شده" : "همه"}
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mr-3 pr-2 border-r-2 border-kala-200/60 my-1 space-y-1"
          >
            {/* Direct option to select "All products in [Category]" inside accordion */}
            <div
              onClick={() => onSelect(category.slug)}
              className={`flex items-center justify-between py-2 px-3 rounded-xl text-xs cursor-pointer transition-colors ${
                isActive
                  ? "bg-kala-100/80 text-kala-800 font-bold"
                  : "bg-gray-50/70 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-kala-500" />
                <span>همه محصولات {category.name}</span>
              </div>
              {isActive && <Check size={13} className="text-kala-600" />}
            </div>

            {category.children!.map((child) => (
              <CategoryTreeItem
                key={child._id}
                category={child}
                level={level + 1}
                currentSlug={currentSlug}
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Filter Section Wrapper ──────────────────────────────────────
function FilterSection({
  title,
  icon,
  defaultOpen = true,
  children,
  badge,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 p-4 text-right transition-colors hover:bg-gray-50/50"
      >
        {icon && <span className="text-gray-400">{icon}</span>}
        <span className="font-bold text-sm text-gray-800 flex-1">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="bg-kala-100 text-kala-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[18px] text-center">
            {badge}
          </span>
        )}
        <ChevronDown
          className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          size={16}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Desktop Horizontal Sort Bar ─────────────────────────────────
function DesktopSortBar({
  currentSort,
  onSort,
}: {
  currentSort: string;
  onSort: (sort: string) => void;
}) {
  return (
    <div className="hidden lg:flex items-center justify-between bg-white border border-gray-100 p-2 rounded-2xl shadow-sm mb-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 text-xs font-bold border-l border-gray-100 ml-1">
          <ArrowUpDown size={15} className="text-kala-500" />
          <span className="text-gray-600">مرتب‌سازی:</span>
        </div>
        <div className="flex items-center gap-1">
          {SORT_OPTIONS.map((option) => {
            const isActive = currentSort === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => onSort(option.value)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                  isActive
                    ? "bg-kala-500 text-white shadow-md shadow-kala-200 scale-[1.02]"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 font-medium"
                }`}
              >
                <Icon size={13} className={isActive ? "text-white" : "text-gray-400"} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Content Component ──────────────────────────────────────
function ProductListingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { markRoutePending, markRouteReady } = useRouteLoadingState();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

  // URL Params
  const categorySlug = searchParams.get("category");
  const brandSlug = searchParams.get("brand");
  const searchQuery = searchParams.get("search");
  const rawSort = searchParams.get("sort");
  const sortParam = useMemo(() => {
    if (!rawSort) return "newest";
    if (rawSort === "bestseller" || rawSort === "bestSellers") return "bestSelling";
    if (rawSort === "flash" || rawSort === "special") return "discount";
    return rawSort;
  }, [rawSort]);
  const pageParam = parseInt(searchParams.get("page") || "1", 10) || 1;
  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");
  const includeChildrenParam = searchParams.get("includeChildren") === "true";
  const inStockParam = searchParams.get("inStock") === "true";
  const listingScrollKey = useMemo(
    () => `/products${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
    [searchParams],
  );

  // ─── State ──────────────────────────────────────────
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 });
  const [sliderValue, setSliderValue] = useState<[number, number]>([0, 0]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);

  // ─── Freeze underlying page when modals are open ───
  useEffect(() => {
    if (showFilters || showSortSheet) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [showFilters, showSortSheet]);

  // Category/Brand data for filters
  const { categoryTree } = useCategoryTree();
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");

  // Category properties state for dynamic filters
  const [categoryDetails, setCategoryDetails] = useState<CategoryDetails | null>(null);
  const [selectedProperties, setSelectedProperties] = useState<Record<string, string>>({});

  // Brand state
  const [brandDetails, setBrandDetails] = useState<Brand | null>(null);
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({});

  // ─── Data Fetching ──────────────────────────────────
  // Fetch all brands for filter
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const brands = await brandService.getAll({ fields: "name,slug,logo" });
        setAllBrands(brands);
      } catch (error) {
        console.error("Failed to fetch brands for filters:", error);
      }
    };
    fetchBrands();
  }, []);

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

  const listingQuery = useMemo(
    () => ({
      page: pageParam,
      sort: sortParam,
      category: categorySlug || undefined,
      brand: brandSlug || undefined,
      search: searchQuery || undefined,
      minPrice: minPriceParam ? Number(minPriceParam) : undefined,
      maxPrice: maxPriceParam ? Number(maxPriceParam) : undefined,
      includeChildren: includeChildrenParam,
      inStock: inStockParam,
      properties: getPropertyFiltersFromUrl(),
    }),
    [
      pageParam,
      sortParam,
      categorySlug,
      brandSlug,
      searchQuery,
      minPriceParam,
      maxPriceParam,
      includeChildrenParam,
      inStockParam,
      getPropertyFiltersFromUrl,
    ],
  );

  const {
    products,
    total,
    totalPages,
    currentPage,
    priceRange: fetchedPriceRange,
    isReady,
    showSkeleton,
    showError,
    error,
  } = useProductListing(listingQuery);

  const showInitialLoader = showSkeleton;

  useLayoutEffect(() => {
    markRoutePending();
  }, [listingScrollKey, markRoutePending]);

  useEffect(() => {
    if (isReady) markRouteReady();
  }, [isReady, markRouteReady]);

  useScrollRestoration({
    enabled: true,
    key: listingScrollKey,
    restoreOnMount: true,
    saveOnScroll: true,
    observeLayoutShifts: true,
    ready: isReady,
  });

  useEffect(() => {
    if (!fetchedPriceRange) return;

    setPriceRange(fetchedPriceRange);
    if (!minPriceParam && !maxPriceParam) {
      setSliderValue([0, fetchedPriceRange.max]);
      return;
    }

    setSliderValue([
      minPriceParam ? Number(minPriceParam) : fetchedPriceRange.min,
      maxPriceParam ? Number(maxPriceParam) : fetchedPriceRange.max,
    ]);
  }, [fetchedPriceRange, minPriceParam, maxPriceParam]);

  // ─── Handlers ───────────────────────────────────────
  const handleSortChange = useCallback((sort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", sort);
    params.delete("page"); // Reset to page 1 on sort change
    const targetPath = `/products?${params.toString()}`;
    getScrollManager().clear(targetPath);
    router.push(targetPath);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [searchParams, router]);

  const handlePriceFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("minPrice", sliderValue[0].toString());
    params.set("maxPrice", sliderValue[1].toString());
    params.delete("page");
    const targetPath = `/products?${params.toString()}`;
    getScrollManager().clear(targetPath);
    router.push(targetPath);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [searchParams, router, sliderValue]);

  const handleCategorySelect = useCallback((slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug === categorySlug) {
      // Deselect: remove category filter
      params.delete("category");
      params.delete("includeChildren");
    } else {
      params.set("category", slug);
      params.set("includeChildren", "true");
    }
    params.delete("page");
    // Remove property filters when category changes
    const keysToDelete: string[] = [];
    params.forEach((_, key) => {
      if (key.startsWith("prop_")) keysToDelete.push(key);
    });
    keysToDelete.forEach((k) => params.delete(k));

    const targetPath = `/products?${params.toString()}`;
    getScrollManager().clear(targetPath);
    router.push(targetPath);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [searchParams, router, categorySlug]);

  const handleBrandSelect = useCallback((slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug === brandSlug) {
      // Deselect: remove brand filter
      params.delete("brand");
    } else {
      params.set("brand", slug);
    }
    params.delete("page");
    const targetPath = `/products?${params.toString()}`;
    getScrollManager().clear(targetPath);
    router.push(targetPath);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [searchParams, router, brandSlug]);

  const handlePageChange = useCallback((page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", page.toString());
    }
    const targetPath = `/products${params.toString() ? `?${params.toString()}` : ""}`;
    getScrollManager().clear(targetPath);
    router.push(targetPath);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [searchParams, router, totalPages, currentPage]);

  const handleClearFilters = useCallback(() => {
    const params = new URLSearchParams();
    // Keep search query if present
    if (searchQuery) params.set("search", searchQuery);
    const qs = params.toString();
    router.push(`/products${qs ? `?${qs}` : ""}`);
  }, [router, searchQuery]);

  const handlePropertyFilter = useCallback((propertyName: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const key = `prop_${propertyName}`;

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    router.push(`/products?${params.toString()}`);
  }, [searchParams, router]);

  const handleInStockToggle = useCallback((checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) params.set("inStock", "true");
    else params.delete("inStock");
    params.delete("page");
    router.push(`/products?${params.toString()}`);
  }, [searchParams, router]);

  const toggleFilterExpanded = useCallback((name: string) => {
    setExpandedFilters(prev => ({ ...prev, [name]: !prev[name] }));
  }, []);

  // ─── Derived Values ─────────────────────────────────
  const getPageNumbers = (): (number | "...")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "...")[] = [];
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (categorySlug) count++;
    if (brandSlug) count++;
    if (minPriceParam || maxPriceParam) count++;
    if (inStockParam) count++;
    count += Object.keys(selectedProperties).length;
    return count;
  }, [categorySlug, brandSlug, minPriceParam, maxPriceParam, inStockParam, selectedProperties]);

  // Filtered brands for search
  const filteredBrands = useMemo(() => {
    if (!brandSearchQuery.trim()) return allBrands;
    const q = brandSearchQuery.trim().toLowerCase();
    return allBrands.filter((b) => b.name.toLowerCase().includes(q));
  }, [allBrands, brandSearchQuery]);

  // Find active category name for chips
  const activeCategoryName = useMemo(() => {
    if (!categorySlug) return null;
    const findInTree = (cats: Category[]): string | null => {
      for (const cat of cats) {
        if (cat.slug === categorySlug) return cat.name;
        if (cat.children) {
          const found = findInTree(cat.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findInTree(categoryTree) || categorySlug;
  }, [categorySlug, categoryTree]);

  const itemList =
    !showInitialLoader && products.length > 0
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

  // ─── Shared Filter Content (used in both desktop sidebar & mobile drawer) ───
  const renderFilterContent = (isMobile: boolean) => (
    <div className="space-y-4">
      {/* Active Filters Chips */}
      {activeFilterCount > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-500">فیلترهای فعال</span>
            <button
              onClick={() => {
                handleClearFilters();
                if (isMobile) setShowFilters(false);
              }}
              className="text-[10px] text-red-500 hover:text-red-600 font-bold transition-colors"
            >
              حذف همه
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categorySlug && activeCategoryName && (
              <button
                onClick={() => {
                  handleCategorySelect(categorySlug);
                  if (isMobile) setShowFilters(false);
                }}
                className="bg-kala-50 text-kala-700 text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 hover:bg-kala-100 font-medium transition-colors"
              >
                <LayoutGrid size={11} />
                {activeCategoryName}
                <X size={11} />
              </button>
            )}
            {brandSlug && brandDetails && (
              <button
                onClick={() => {
                  handleBrandSelect(brandSlug);
                  if (isMobile) setShowFilters(false);
                }}
                className="bg-kala-50 text-kala-700 text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 hover:bg-kala-100 font-medium transition-colors"
              >
                <Tag size={11} />
                {brandDetails.name}
                <X size={11} />
              </button>
            )}
            {minPriceParam && (
              <span className="bg-gray-100 text-gray-600 text-[11px] px-2.5 py-1 rounded-lg font-medium">
                از {Number(minPriceParam).toLocaleString()} تومان
              </span>
            )}
            {maxPriceParam && (
              <span className="bg-gray-100 text-gray-600 text-[11px] px-2.5 py-1 rounded-lg font-medium">
                تا {Number(maxPriceParam).toLocaleString()} تومان
              </span>
            )}
            {inStockParam && (
              <span className="bg-emerald-50 text-emerald-700 text-[11px] px-2.5 py-1 rounded-lg font-medium">
                فقط موجود
              </span>
            )}
            {Object.entries(selectedProperties).map(([key, value]) => (
              <button
                key={key}
                onClick={() => {
                  handlePropertyFilter(key, '');
                  if (isMobile) setShowFilters(false);
                }}
                className="bg-kala-50 text-kala-700 text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 hover:bg-kala-100 font-medium transition-colors"
              >
                {key}: {value}
                <X size={11} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter */}
      {categoryTree.length > 0 && (
        <FilterSection
          title="دسته‌بندی"
          icon={<LayoutGrid size={16} />}
          defaultOpen={true}
          badge={categorySlug ? 1 : 0}
        >
          <div className="max-h-[320px] overflow-y-auto -mx-1 px-1 custom-scrollbar">
            {categoryTree.map((cat) => (
              <CategoryTreeItem
                key={cat._id}
                category={cat}
                currentSlug={categorySlug}
                onSelect={(slug) => {
                  handleCategorySelect(slug);
                }}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Brand Filter */}
      {allBrands.length > 0 && (
        <FilterSection
          title="برند"
          icon={<Tag size={16} />}
          defaultOpen={!!brandSlug}
          badge={brandSlug ? 1 : 0}
        >
          {/* Brand Search */}
          {allBrands.length > 6 && (
            <div className="relative mb-3">
              <Search
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="جستجوی برند..."
                value={brandSearchQuery}
                onChange={(e) => setBrandSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kala-200 focus:border-kala-300 transition-all"
              />
            </div>
          )}
          <div className="max-h-[240px] overflow-y-auto space-y-1 custom-scrollbar">
            {filteredBrands.map((brand) => {
              const isActive = brandSlug === brand.slug;
              return (
                <button
                  key={brand._id}
                  onClick={() => {
                    handleBrandSelect(brand.slug);
                    if (isMobile) setShowFilters(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200
                    ${isActive
                      ? "bg-kala-50 text-kala-700 font-bold"
                      : "hover:bg-gray-50 text-gray-700 font-medium"
                    }`}
                >
                  {brand.logo?.url ? (
                    <img
                      src={brand.logo.url}
                      alt={brand.name}
                      className="w-6 h-6 object-contain rounded-md flex-shrink-0"
                    />
                  ) : (
                    <span className="w-6 h-6 bg-gray-100 rounded-md flex items-center justify-center text-[10px] text-gray-400 font-bold flex-shrink-0">
                      {brand.name.charAt(0)}
                    </span>
                  )}
                  <span className="flex-1 text-right">{brand.name}</span>
                  {isActive && (
                    <Check size={14} className="text-kala-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
            {filteredBrands.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-3">برندی یافت نشد</p>
            )}
          </div>
        </FilterSection>
      )}

      {/* Price Range */}
      <FilterSection
        title="بازه قیمت (تومان)"
        icon={<Sparkles size={16} />}
        defaultOpen={!!(minPriceParam || maxPriceParam)}
        badge={minPriceParam || maxPriceParam ? 1 : 0}
      >
        <div className="px-1 mb-5" dir="ltr">
          <Slider
            range
            min={0}
            max={priceRange.max}
            value={sliderValue}
            onChange={(val) => setSliderValue(val as [number, number])}
            reverse={true}
            trackStyle={[{ backgroundColor: "#f59e0b", height: 5 }]}
            handleStyle={[
              { borderColor: "#f59e0b", backgroundColor: "#fff", opacity: 1, width: 18, height: 18, marginTop: -7, boxShadow: "0 2px 6px rgba(245,158,11,0.3)" },
              { borderColor: "#f59e0b", backgroundColor: "#fff", opacity: 1, width: 18, height: 18, marginTop: -7, boxShadow: "0 2px 6px rgba(245,158,11,0.3)" },
            ]}
            railStyle={{ backgroundColor: "#e5e7eb", height: 5, borderRadius: 4 }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-600 mb-4 font-bold">
          <span>{sliderValue[0].toLocaleString()}</span>
          <span className="text-gray-300">—</span>
          <span>{sliderValue[1].toLocaleString()}</span>
        </div>
        <button
          onClick={() => {
            handlePriceFilter();
            if (isMobile) setShowFilters(false);
          }}
          className="w-full bg-gray-900 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-gray-800 transition-colors active:scale-[0.98]"
        >
          اعمال بازه قیمت
        </button>
      </FilterSection>

      {/* Availability Toggle */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">فقط کالاهای موجود</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={inStockParam}
            onChange={(e) => {
              handleInStockToggle(e.target.checked);
              if (isMobile) setShowFilters(false);
            }}
          />
          <div className="w-10 h-[22px] bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[18px] after:w-[18px] after:transition-all after:shadow-sm peer-checked:bg-kala-500"></div>
        </label>
      </div>

      {/* Dynamic Category Properties Filters */}
      {categoryDetails && categoryDetails.properties.length > 0 && (
        <div className="space-y-3">
          {categoryDetails.properties.map((prop) => (
            <div key={prop.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleFilterExpanded(prop.name)}
                className="w-full flex items-center justify-between p-4 text-right transition-colors hover:bg-gray-50/50"
              >
                <span className="font-bold text-sm text-gray-800">
                  {prop.name}
                  {prop.unit && <span className="font-normal text-gray-500 text-xs mr-1">({prop.unit})</span>}
                </span>
                <ChevronDown
                  className={`text-gray-400 transition-transform duration-200 ${expandedFilters[prop.name] ? 'rotate-180' : ''}`}
                  size={16}
                />
              </button>

              <AnimatePresence initial={false}>
                {expandedFilters[prop.name] && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
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
                                  if (isMobile) setShowFilters(false);
                                }}
                                className={`
                                  px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                                  ${isSelected
                                    ? 'bg-kala-500 text-white shadow-sm shadow-kala-200'
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
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kala-200 focus:border-kala-300 transition-all"
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─── Render ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8 pt-6">
      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>

      <div className="max-w-[1440px] mx-auto px-4">
        {/* Search Results Header */}
        {searchQuery && !brandDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-gradient-to-l from-white via-white to-[#faf8f0] rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden relative"
          >
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
                  {showInitialLoader ? (
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

       {/* Main Grid Layout */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
          {itemList && (
            <script
              type="application/ld+json"
              suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
            />
          )}

        {/* Desktop Sidebar - Sticky on lg+ */}
         <aside className="hidden lg:block lg:col-span-3 sticky self-start overflow-y-auto custom-scrollbar" style={{ top: 'calc(var(--header-height, 136px) + 1rem)', maxHeight: 'calc(100vh - var(--header-height, 136px) - 1.5rem)', transition: 'top 0.3s ease-in-out, max-height 0.3s ease-in-out' }}>
            {renderFilterContent(false)}
          </aside>

          {/* Mobile Filter Bottom Sheet */}
          <AnimatePresence>
            {showFilters && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-bottom-backdrop lg:hidden"
                  onClick={() => setShowFilters(false)}
                />
                {/* Full-height Sheet Modal */}
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 300 }}
                  className="fixed inset-x-0 bottom-0 top-12 sm:top-16 z-bottom-drawer lg:hidden bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden overscroll-contain"
                >
                  {/* Drag Handle */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-200 rounded-full" />
                  </div>
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal size={18} className="text-gray-600" />
                      <span className="font-bold text-lg text-gray-800">فیلترها</span>
                      {activeFilterCount > 0 && (
                        <span className="bg-kala-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          {activeFilterCount}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <X size={18} className="text-gray-600" />
                    </button>
                  </div>
                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    {renderFilterContent(true)}
                  </div>
                  {/* Bottom Actions */}
                  <div className="border-t border-gray-100 px-6 py-4 flex items-center gap-3 bg-white">
                    <button
                      onClick={() => {
                        handleClearFilters();
                        setShowFilters(false);
                      }}
                      className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      حذف همه فیلترها
                    </button>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors active:scale-[0.98]"
                    >
                      مشاهده {total} محصول
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Main Content (Grid) - 9 cols on desktop */}
          <main className="lg:col-span-9">
            {/* Desktop Sort Bar */}
            <DesktopSortBar currentSort={sortParam} onSort={handleSortChange} />

            {/* Mobile Filter & Sort Bar */}
            <div className="lg:hidden flex items-center justify-between mb-4 gap-2">
              <div className="flex items-center gap-2">
                {/* Mobile Sort Button */}
                <button
                  onClick={() => setShowSortSheet(true)}
                  className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-800 px-3 py-2 rounded-xl text-xs font-bold transition-colors hover:border-gray-300"
                  aria-label="مرتب‌سازی"
                >
                  <ArrowUpDown size={15} className="text-kala-500 flex-shrink-0" />
                  <span className="text-kala-600">
                    {SORT_OPTIONS.find((o) => o.value === sortParam)?.label || "جدیدترین"}
                  </span>
                </button>

                {/* Mobile Filter Button */}
                <button
                  onClick={() => setShowFilters(true)}
                  className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-800 px-3 py-2 rounded-xl text-xs font-bold transition-colors hover:border-gray-300 relative"
                >
                  <SlidersHorizontal size={15} className="text-gray-600 flex-shrink-0" />
                  فیلترها
                  {activeFilterCount > 0 && (
                    <span className="bg-kala-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                <span className="font-bold text-gray-800">{total}</span> محصول
              </div>
            </div>

            {/* Products Grid */}
            {showInitialLoader ? (
              <ProductListingSkeleton />
            ) : showError ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-white py-20 text-center text-gray-500">
                <p className="text-lg font-bold text-gray-800">بارگذاری محصولات انجام نشد</p>
                <p className="mt-2 text-sm">لطفاً اتصال اینترنت را بررسی کرده و دوباره تلاش کنید.</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-gray-800"
                >
                  تلاش مجدد
                </button>
                {process.env.NODE_ENV === "development" && error instanceof Error && (
                  <p className="mt-3 text-xs text-red-500">{error.message}</p>
                )}
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
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 sm:gap-5"
                data-scroll-anchor="product-grid"
              >
                <AnimatePresence mode="popLayout">
                  {products.map((product, index) => (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ProductCard product={product} priority={index < 4} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Pagination */}
            {!showInitialLoader && totalPages > 1 && (
              <div className="mt-10 mb-6">
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {/* First Page */}
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all text-sm ${currentPage === 1
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      }`}
                    aria-label="صفحه اول"
                  >
                    <ChevronsLeft size={18} />
                  </button>

                  {/* Previous Page */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all text-sm ${currentPage === 1
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      }`}
                    aria-label="صفحه قبل"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {/* Page Numbers */}
                  {getPageNumbers().map((pageNum, idx) =>
                    pageNum === "..." ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="w-9 h-9 flex items-center justify-center text-gray-400 text-sm select-none"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all text-sm font-bold ${pageNum === currentPage
                          ? "bg-kala-500 text-white shadow-md shadow-kala-200"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                          }`}
                        aria-label={`صفحه ${pageNum}`}
                        aria-current={pageNum === currentPage ? "page" : undefined}
                      >
                        {pageNum}
                      </button>
                    )
                  )}

                  {/* Next Page */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all text-sm ${currentPage === totalPages
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      }`}
                    aria-label="صفحه بعد"
                  >
                    <ChevronRight size={18} />
                  </button>

                  {/* Last Page */}
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all text-sm ${currentPage === totalPages
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      }`}
                    aria-label="صفحه آخر"
                  >
                    <ChevronsRight size={18} />
                  </button>
                </div>

                {/* Page Info */}
                <div className="text-center mt-4 text-xs text-gray-400">
                  صفحه <span className="font-bold text-gray-600">{currentPage}</span> از <span className="font-bold text-gray-600">{totalPages}</span>
                  <span className="mx-2">•</span>
                  <span className="font-bold text-gray-600">{total}</span> محصول
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Sort Bottom Sheet (Mobile Only) */}
      <AnimatePresence>
        {showSortSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-bottom-backdrop"
              onClick={() => setShowSortSheet(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-bottom-drawer shadow-2xl overflow-hidden overscroll-contain"
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <ArrowUpDown size={18} className="text-kala-500" />
                  <h3 className="font-bold text-lg text-gray-800">مرتب‌سازی بر اساس</h3>
                </div>
                <button
                  onClick={() => setShowSortSheet(false)}
                  className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <X size={18} className="text-gray-600" />
                </button>
              </div>
              <div className="p-4 pb-8 space-y-2">
                {SORT_OPTIONS.map((option) => {
                  const isActive = sortParam === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleSortChange(option.value);
                        setShowSortSheet(false);
                      }}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
                        isActive
                          ? "bg-kala-50 text-kala-700 border border-kala-200 shadow-xs"
                          : "bg-gray-50/80 text-gray-700 hover:bg-gray-100 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            isActive ? "bg-kala-500 text-white shadow-xs" : "bg-gray-200/70 text-gray-500"
                          }`}
                        >
                          <Icon size={15} />
                        </span>
                        <span>{option.label}</span>
                      </div>
                      {isActive && <Check size={18} className="text-kala-600" />}
                    </button>
                  );
                })}
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
          <Loader2 className="w-8 h-8 animate-spin text-kala-500" />
        </div>
      }
    >
      <ProductListingContent />
    </Suspense>
  );
}
