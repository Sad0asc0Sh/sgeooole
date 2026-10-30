"use client";

import { useEffect, useLayoutEffect, useState, Suspense, useCallback, useMemo, useRef, useId } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { useProductListing } from "@/hooks/useProductListing";
import { useCategoryFilterNavigation } from "@/hooks/useCategoryFilterNavigation";
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
  Star,
} from "lucide-react";
import ProductCard from "@/components/product/ProductCard";
import { productService, CategoryDetails } from "@/services/productService";
import { brandService, Brand } from "@/services/brandService";
import { Category } from "@/services/categoryService";
import { getScrollManager } from "@/lib/scroll/ScrollManager";
import ProductListingSkeleton from "@/components/product/ProductListingSkeleton";
import { useRouteLoadingState } from "@/providers/RouteLoadingProvider";
import { parsePriceInput, parseProductFilters } from "@/lib/productFilters";

// ─── Sort Options ────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: "newest", label: "جدیدترین", icon: Sparkles },
  { value: "priceAsc", label: "ارزان‌ترین", icon: ArrowUpDown },
  { value: "priceDesc", label: "گران‌ترین", icon: ArrowUpDown },
  { value: "bestSelling", label: "پرفروش‌ترین", icon: TrendingUp },
  { value: "popularity", label: "محبوب‌ترین", icon: LayoutGrid },
  { value: "discount", label: "بیشترین تخفیف", icon: Flame },
] as const;

function containsCategory(category: Category, slug: string | null): boolean {
  return category.slug === slug || !!category.children?.some((child) => containsCategory(child, slug));
}

// ─── رنگ‌ها (Color Swatches) — Phase 4.2 ─────────────────────────
const COLOR_PROPERTY_HINTS = ["رنگ", "colour", "color"];
const COLOR_HEX: Record<string, string> = {
  "مشکی": "#111827", "سیاه": "#111827",
  "سفید": "#f9fafb", "شیری": "#f9fafb",
  "خاکستری": "#6b7280", "طوسی": "#9ca3af", "خاکستری تیره": "#4b5563",
  "نقره‌ای": "#cbd5e1", "نقره ای": "#cbd5e1",
  "آبی": "#2563eb", "سرمه‌ای": "#1e3a8a", "فیروزه‌ای": "#06b6d4",
  "قرمز": "#dc2626", "زرشکی": "#7f1d1d", "صورتی": "#ec4899",
  "صورتی روشن": "#f9a8d4", "بنفش": "#7c3aed", "ارغوانی": "#6d28d9",
  "سبز": "#16a34a", "سبز روشن": "#4ade80", "زیتونی": "#4d7c0f",
  "زرد": "#facc15", "طلایی": "#d4af37", "نارنجی": "#ea580c",
  "قهوه‌ای": "#78350f", "کرم": "#f5e6c8", "بژ": "#e7d8b1",
  "مسی": "#b45309", "برنزی": "#a16207", "تیتانیوم": "#8b8f94",
  "مشکی تیتانیوم": "#3f3f46", "خاکستری تیتانیوم": "#71717a",
};

const isColorProperty = (name: string) =>
  COLOR_PROPERTY_HINTS.some((hint) => name.toLowerCase().includes(hint));

const swatchFor = (value: string): string | null => COLOR_HEX[value.trim()] ?? null;


// Each sheet owns keyboard focus without interfering with route scroll restoration.
function useSheetDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
    ) || []).filter((element) => element.getClientRects().length > 0);
    const focusFirst = () => (focusable()[0] || ref.current)?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(focusFirst);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        ref.current?.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleFocus = (event: FocusEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) focusFirst();
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const handleResize = () => { if (desktop.matches) onClose(); };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("focusin", handleFocus);
    desktop.addEventListener("change", handleResize);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("focusin", handleFocus);
      desktop.removeEventListener("change", handleResize);
      document.body.style.overflow = originalOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open, onClose]);
  return ref;
}

// ─── CategoryTreeItem: Accordion drawer for categories ─────────
function CategoryTreeItem({
  category,
  currentSlug,
  onSelect,
}: {
  category: Category;
  currentSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const hasActiveChild = !!category.children?.some((child) => containsCategory(child, currentSlug));
  const [expanded, setExpanded] = useState(() => containsCategory(category, currentSlug));
  const childrenId = useId();
  const hasChildren = !!category.children?.length;
  const isActive = category.slug === currentSlug;

  useEffect(() => {
    if (hasActiveChild || isActive) setExpanded(true);
  }, [currentSlug, hasActiveChild, isActive]);

  return (
    <div className="mb-1">
      <div className={`flex items-center gap-2 rounded-xl py-1 px-2 transition-colors ${
        isActive ? "bg-kala-50 text-kala-700 border border-kala-200/60" : hasActiveChild ? "bg-amber-50/60 text-gray-800" : "text-gray-700 hover:bg-gray-50"
      }`}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={childrenId}
            aria-label={`${expanded ? "بستن" : "باز کردن"} زیرشاخه‌های ${category.name}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100/80 text-gray-500 hover:bg-kala-100 focus-visible:outline-2 focus-visible:outline-kala-500"
          >
            <ChevronDown size={15} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        ) : <span aria-hidden="true" className={`mx-3 h-2 w-2 shrink-0 rounded-full ${isActive ? "bg-kala-500" : "bg-gray-300"}`} />}
        <button
          type="button"
          onClick={() => onSelect(category.slug)}
          aria-pressed={isActive}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg py-2.5 text-right text-sm font-medium focus-visible:outline-2 focus-visible:outline-kala-500"
        >
          <span className="break-words">{category.name}</span>
          {isActive ? <Check size={14} className="shrink-0 text-kala-600" /> : hasChildren && <span className="shrink-0 text-[11px] text-gray-500">همه</span>}
        </button>
      </div>
      <div id={childrenId} hidden={!expanded || !hasChildren} className="mr-3 my-1 space-y-1 border-r-2 border-kala-200/60 pr-2">
        {category.children?.map((child) => (
          <CategoryTreeItem key={child._id} category={child} currentSlug={currentSlug} onSelect={onSelect} />
        ))}
      </div>
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
  const contentId = useId();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
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
            id={contentId}
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
        <div className="flex items-center gap-1" role="group" aria-label="مرتب‌سازی محصولات">
          {SORT_OPTIONS.map((option) => {
            const isActive = currentSort === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
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

  // The URL is the only committed filter state. Drafts exist only for submitted inputs.
  const queryString = searchParams.toString();
  const listingQuery = useMemo(() => parseProductFilters(new URLSearchParams(queryString)), [queryString]);
  const categorySlug = listingQuery.category || null;
  const brandSlug = listingQuery.brand;
  const selectedBrands = useMemo(() => brandSlug?.split(",") || [], [brandSlug]);
  const searchQuery = listingQuery.search;
  const sortParam = listingQuery.sort;
  const minPriceParam = listingQuery.minPrice;
  const maxPriceParam = listingQuery.maxPrice;
  const hasPriceFilter = minPriceParam !== undefined || maxPriceParam !== undefined;
  const inStockParam = !!listingQuery.inStock;
  const selectedProperties = listingQuery.properties;
  const listingScrollKey = `/products${queryString ? `?${queryString}` : ""}`;

  // Pending URL writes are composed so rapid toggles cannot overwrite each other.
  // This ref is navigation bookkeeping, never a second source for rendered selections.
  const navigation = useRef({ observed: queryString, pending: queryString });
  useLayoutEffect(() => {
    if (navigation.current.observed !== queryString) {
      navigation.current = { observed: queryString, pending: queryString };
    }
  }, [queryString]);

  const [priceDraft, setPriceDraft] = useState<[string, string]>(["", ""]);
  const [priceError, setPriceError] = useState("");
  const [searchDraft, setSearchDraft] = useState(searchQuery || "");
  const [showFilters, setShowFilters] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const closeFilters = useCallback(() => setShowFilters(false), []);
  const closeSort = useCallback(() => setShowSortSheet(false), []);
  const filterDialogRef = useSheetDialog(showFilters, closeFilters);
  const sortDialogRef = useSheetDialog(showSortSheet, closeSort);
  const { desktopCategoryRef, categoryFilterRequest } = useCategoryFilterNavigation(setShowFilters);

  const { categoryTree, isLoading: categoriesLoading, error: categoriesError, refresh: refreshCategories } = useCategoryTree();
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandsError, setBrandsError] = useState(false);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  // جستجوی داخلی در مقادیر ویژگی‌های طولانی (بیش از ۶ مقدار) — Phase 4.2
  const [propertySearch, setPropertySearch] = useState<Record<string, string>>({});
  const [categoryDetails, setCategoryDetails] = useState<CategoryDetails | null>(null);
  const [brandDetails, setBrandDetails] = useState<Brand | null>(null);
  const singleBrandSlug = selectedBrands.length === 1 ? selectedBrands[0] : undefined;

  useEffect(() => {
    setSearchDraft(searchQuery || "");
  }, [searchQuery]);

  useEffect(() => {
    let active = true;
    brandService.getAll({ fields: "name,slug,logo" }).then((brands) => {
      if (active) setAllBrands(brands);
    }).catch(() => {
      if (active) setBrandsError(true);
    }).finally(() => {
      if (active) setBrandsLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setCategoryDetails(null);
    if (categorySlug) {
      productService.getCategoryBySlug(categorySlug).then((details) => {
        if (active) setCategoryDetails(details);
      }).catch(() => { if (active) setCategoryDetails(null); });
    }
    return () => { active = false; };
  }, [categorySlug]);

  useEffect(() => {
    let active = true;
    setBrandDetails(null);
    if (singleBrandSlug) {
      brandService.getBySlug(singleBrandSlug).then((brand) => {
        if (active) setBrandDetails(brand);
      }).catch(() => { if (active) setBrandDetails(null); });
    }
    return () => { active = false; };
  }, [singleBrandSlug]);

  const {
    products,
    total,
    totalPages,
    currentPage,
    priceRange: fetchedPriceRange,
    facets,
    isReady,
    isValidating,
    showSkeleton,
    showUpdating,
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
    setPriceDraft([minPriceParam === undefined ? "" : String(minPriceParam), maxPriceParam === undefined ? "" : String(maxPriceParam)]);
    setPriceError("");
  }, [minPriceParam, maxPriceParam]);

  const sliderMax = Math.max(
    0,
    Number.isFinite(fetchedPriceRange?.max) ? fetchedPriceRange!.max : 0,
    minPriceParam || 0,
    maxPriceParam || 0,
  );
  const sliderValue: [number, number] = [
    Math.min(parsePriceInput(priceDraft[0]) ?? 0, sliderMax),
    Math.min(parsePriceInput(priceDraft[1]) ?? sliderMax, sliderMax),
  ].sort((a, b) => a - b) as [number, number];

  // ─── Handlers ───────────────────────────────────────
  const updateFilters = useCallback((change: (params: URLSearchParams) => void, resetPage = true) => {
    const params = new URLSearchParams(navigation.current.pending);
    change(params);
    if (resetPage) params.delete("page");
    const qs = params.toString();
    navigation.current.pending = qs;
    const targetPath = `/products${qs ? `?${qs}` : ""}`;
    getScrollManager().clear(targetPath);
    // Keep the sheet and its scroll position stable during immediate multi-selection.
    router.push(targetPath, { scroll: false });
    if (!showFilters) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [router, showFilters]);

  const removeFilter = useCallback((key: string) => {
    updateFilters((params) => params.delete(key));
  }, [updateFilters]);

  const handleSortChange = useCallback((sort: string) => {
    updateFilters((params) => params.set("sort", sort));
  }, [updateFilters]);

  const handlePriceFilter = useCallback(() => {
    const min = parsePriceInput(priceDraft[0]);
    const max = parsePriceInput(priceDraft[1]);
    if ((priceDraft[0].trim() && min === undefined) || (priceDraft[1].trim() && max === undefined)) {
      setPriceError("قیمت را با عدد غیرمنفی و معتبر وارد کنید.");
      return;
    }
    if (min !== undefined && max !== undefined && min > max) {
      setPriceError("قیمت «از» نباید بیشتر از قیمت «تا» باشد.");
      return;
    }
    setPriceError("");
    updateFilters((params) => {
      if (min === undefined) params.delete("minPrice"); else params.set("minPrice", String(min));
      if (max === undefined) params.delete("maxPrice"); else params.set("maxPrice", String(max));
    });
  }, [priceDraft, updateFilters]);

  const handleCategorySelect = useCallback((slug: string) => {
    updateFilters((params) => {
      if (params.get("category") === slug) {
        params.delete("category");
        params.delete("includeChildren");
      } else {
        params.set("category", slug);
        params.set("includeChildren", "true");
      }
      Array.from(params.keys()).filter((key) => key.startsWith("prop_")).forEach((key) => params.delete(key));
    });
  }, [updateFilters]);

  const handleBrandSelect = useCallback((slug: string) => {
    updateFilters((params) => {
      const brands = new Set(parseProductFilters(params).brand?.split(",") || []);
      if (brands.has(slug)) brands.delete(slug); else brands.add(slug);
      params.delete("brand");
      if (brands.size) params.set("brand", Array.from(brands).join(","));
    });
  }, [updateFilters]);

  const handlePageChange = useCallback((page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    updateFilters((params) => {
      if (page === 1) params.delete("page"); else params.set("page", String(page));
    }, false);
  }, [updateFilters, totalPages, currentPage]);

  const handleClearFilters = useCallback(() => {
    updateFilters((params) => {
      Array.from(params.keys()).forEach((key) => {
        if (key !== "search" && key !== "sort") params.delete(key);
      });
    });
    setPriceDraft(["", ""]);
    setPriceError("");
  }, [updateFilters]);

  const handlePropertyFilter = useCallback((propertyName: string, value: string) => {
    updateFilters((params) => {
      const key = `prop_${propertyName}`;
      const values = new Set(params.getAll(key));
      if (values.has(value)) values.delete(value); else if (value.trim()) values.add(value.trim());
      params.delete(key);
      values.forEach((entry) => params.append(key, entry));
    });
  }, [updateFilters]);

  const handleToggle = useCallback((key: "inStock" | "onSale") => {
    updateFilters((params) => {
      if (params.get(key) === "true") params.delete(key); else params.set(key, "true");
    });
  }, [updateFilters]);

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

  const activeFilterCount = (categorySlug ? 1 : 0) + selectedBrands.length + (hasPriceFilter ? 1 : 0)
    + (inStockParam ? 1 : 0) + (listingQuery.onSale ? 1 : 0) + (listingQuery.minRating ? 1 : 0)
    + (searchQuery ? 1 : 0) + Object.values(selectedProperties).reduce((sum, values) => sum + values.length, 0);

  const availableBrands = useMemo(() => {
    const brands: Array<{ slug: string; name: string; logo?: Brand["logo"]; count?: number }> = facets?.brands
      ? facets.brands.map((brand) => ({ ...brand, logo: allBrands.find((item) => item.slug === brand.slug)?.logo }))
      : [...allBrands];
    selectedBrands.forEach((slug) => {
      if (!brands.some((brand) => brand.slug === slug)) {
        const known = allBrands.find((brand) => brand.slug === slug);
        brands.push({ slug, name: known?.name || (brandDetails?.slug === slug ? brandDetails.name : slug), logo: known?.logo });
      }
    });
    return brands;
  }, [allBrands, facets?.brands, selectedBrands, brandDetails]);
  const filteredBrands = availableBrands.filter((brand) => brand.name.toLowerCase().includes(brandSearchQuery.trim().toLowerCase()));

  const propertyOptions = useMemo(() => {
    const metadata = categoryDetails?.slug === categorySlug ? categoryDetails.properties.filter((prop) => prop.isFilterable !== false) : [];
    const properties: Array<{ name: string; unit?: string; isPinned?: boolean; isConfigured?: boolean; values: Array<{ value: string; count?: number; isSelected?: boolean }> }> = facets?.properties
      ? facets.properties.map((prop) => ({ ...prop, unit: metadata.find((item) => item.name === prop.name)?.unit, values: [...prop.values] }))
      : metadata.map((prop) => ({ name: prop.name, unit: prop.unit, values: (prop.options || []).map((value) => ({ value })) }));
    Object.entries(selectedProperties).forEach(([name, selected]) => {
      let property = properties.find((prop) => prop.name === name);
      if (!property) { property = { name, values: [] }; properties.push(property); }
      selected.forEach((value) => {
        if (!property.values.some((entry) => entry.value === value)) property.values.push({ value });
      });
    });
    return properties;
  }, [categoryDetails, categorySlug, facets?.properties, selectedProperties]);

  // ─── فیلترهای سریع بالای لیست (Quick Filter Pills) — Phase 4.2 ───
  // ۳ تا ۴ ویژگی برتر: اول پین‌شده‌ها، بعد بیشترین پوشش. از هر ویژگی
  // حداکثر دو مقدار پرتکرار به‌صورت چیپ نمایش داده می‌شود تا کاربر بدون
  // اسکرول در سایدبار، کلیدترین فیلترها را با یک کلیک اعمال کند.
  const quickFilters = useMemo(() => {
    if (!propertyOptions.length) return [] as Array<{ property: string; value: string; count: number; selected: boolean }>;
    const coverage = (prop: (typeof propertyOptions)[number]) =>
      prop.values.reduce((sum, item) => sum + (item.count ?? 0), 0);
    const ranked = propertyOptions
      .filter((prop) => prop.values.some((item) => (item.count ?? 0) > 0 || (item.isSelected ?? false)))
      .sort((a, b) => {
        if (Boolean(b.isPinned) !== Boolean(a.isPinned)) return b.isPinned ? 1 : -1;
        return coverage(b) - coverage(a);
      })
      .slice(0, 4);

    const pills: Array<{ property: string; value: string; count: number; selected: boolean }> = [];
    for (const prop of ranked) {
      const top = [...prop.values]
        .filter((item) => (item.count ?? 0) > 0 || selectedProperties[prop.name]?.includes(item.value))
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .slice(0, 2);
      for (const item of top) {
        pills.push({
          property: prop.name,
          value: item.value,
          count: item.count ?? 0,
          selected: Boolean(selectedProperties[prop.name]?.includes(item.value)),
        });
      }
    }
    return pills.slice(0, 8);
  }, [propertyOptions, selectedProperties]);

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
                  }}
                className="bg-kala-50 text-kala-700 text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 hover:bg-kala-100 font-medium transition-colors"
              >
                <LayoutGrid size={11} />
                {activeCategoryName}
                <X size={11} />
              </button>
            )}
                <div className="flex flex-wrap gap-2">
                  {selectedBrands.map((slug) => (
                    <button key={slug} type="button" aria-label={`حذف برند ${availableBrands.find((brand) => brand.slug === slug)?.name || slug}`} onClick={() => handleBrandSelect(slug)} className="bg-kala-50 text-kala-700 text-xs px-2.5 py-2 rounded-lg flex items-center gap-1.5">
                      {availableBrands.find((brand) => brand.slug === slug)?.name || slug}<X size={12} />
                    </button>
                  ))}
                </div>
            {[
              ...(minPriceParam !== undefined ? [{ key: "minPrice", label: `از ${minPriceParam.toLocaleString("fa-IR")} تومان` }] : []),
              ...(maxPriceParam !== undefined ? [{ key: "maxPrice", label: `تا ${maxPriceParam.toLocaleString("fa-IR")} تومان` }] : []),
              ...(inStockParam ? [{ key: "inStock", label: "فقط موجود" }] : []),
              ...(listingQuery.onSale ? [{ key: "onSale", label: "فقط تخفیف‌دار" }] : []),
              ...(listingQuery.minRating ? [{ key: "minRating", label: `امتیاز ${listingQuery.minRating.toLocaleString("fa-IR")} و بالاتر` }] : []),
              ...(searchQuery ? [{ key: "search", label: `جستجو: ${searchQuery}` }] : []),
            ].map((chip) => <button key={chip.key} type="button" aria-label={`حذف ${chip.label}`} onClick={() => removeFilter(chip.key)} className="bg-kala-50 text-kala-700 text-xs px-2.5 py-2 rounded-lg flex items-center gap-1.5 break-words">{chip.label}<X size={12} className="shrink-0" /></button>)}
            {Object.entries(selectedProperties).flatMap(([key, values]) => values.map((value) => (
              <button key={`${key}-${value}`} type="button" aria-label={`حذف ${key}: ${value}`} onClick={() => handlePropertyFilter(key, value)} className="bg-kala-50 text-kala-700 text-xs px-2.5 py-2 rounded-lg flex items-center gap-1.5 hover:bg-kala-100 font-medium">
                {key}: {value}<X size={12} />
              </button>
            )))}
          </div>
        </div>
      )}

      <FilterSection title="جستجو در محصولات" icon={<Search size={16} />}>
        <form role="search" aria-label="جستجو در محصولات" onSubmit={(event) => {
          event.preventDefault();
          updateFilters((params) => {
            const value = searchDraft.trim();
            if (value) params.set("search", value); else params.delete("search");
          });
        }} className="flex gap-2">
          <input type="search" aria-label="نام محصول یا عبارت جستجو" placeholder="نام محصول…" maxLength={200}
            value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)}
            className="min-w-0 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kala-200" />
          <button type="submit" aria-label="جستجو" className="rounded-xl bg-gray-900 text-white p-3 hover:bg-gray-800"><Search size={16} /></button>
        </form>
      </FilterSection>

      {/* Category Filter */}
      <div
        id={isMobile ? "mobile-category-filters" : "category-filters"}
        ref={isMobile ? undefined : desktopCategoryRef}
        tabIndex={-1}
        aria-label="فیلتر دسته‌بندی محصولات"
        style={{ scrollMarginTop: "calc(var(--header-height, 136px) + 1rem)" }}
        className="rounded-2xl focus-visible:outline-2 focus-visible:outline-kala-500"
      >
        <FilterSection
          key={`categories-${categoryFilterRequest}`}
          title="دسته‌بندی"
          icon={<LayoutGrid size={16} />}
          defaultOpen={true}
          badge={categorySlug ? 1 : 0}
        >
          <div className="max-h-[320px] overflow-y-auto -mx-1 px-1 custom-scrollbar">
            {categoryTree.length === 0 && (
              <div role="status" className="py-3 text-sm text-gray-500">
                {categoriesLoading ? "در حال بارگذاری دسته‌بندی‌ها…" : categoriesError ? (
                  <>
                    <p>بارگذاری دسته‌بندی‌ها انجام نشد.</p>
                    <button type="button" className="mt-2 text-kala-700" onClick={() => { void refreshCategories(); }}>تلاش مجدد</button>
                  </>
                ) : "دسته‌بندی‌ای برای نمایش وجود ندارد."}
              </div>
            )}
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
      </div>

      {/* Brand Filter */}
      {(availableBrands.length > 0 || brandsLoading || brandsError) && (
        <FilterSection
          title="برند"
          icon={<Tag size={16} />}
          defaultOpen={true}
          badge={selectedBrands.length}
        >
          {/* Brand Search */}
          {availableBrands.length > 6 && (
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
              const isActive = selectedBrands.includes(brand.slug);
              return (
                <button
                  key={brand.slug}
                  aria-pressed={isActive}
                  onClick={() => {
                    handleBrandSelect(brand.slug);
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
                  {typeof brand.count === "number" && (
                    <span className="text-[11px] font-medium tabular-nums text-gray-400">
                      {brand.count.toLocaleString("fa-IR")}
                    </span>
                  )}
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
        defaultOpen={true}
        badge={hasPriceFilter ? 1 : 0}
      >
        <div className="px-1 mb-5" dir="ltr">
          <Slider
            range
            min={0}
            max={sliderMax || 1}
            disabled={sliderMax <= 0}
            ariaLabelForHandle={["حداقل قیمت به تومان", "حداکثر قیمت به تومان"]}
            value={sliderValue}
            onChange={(value) => {
              const [min, max] = value as [number, number];
              setPriceDraft([String(min), String(max)]);
              setPriceError("");
            }}
            reverse={true}
            trackStyle={[{ backgroundColor: "#f59e0b", height: 5 }]}
            handleStyle={[
              { borderColor: "#f59e0b", backgroundColor: "#fff", opacity: 1, width: 18, height: 18, marginTop: -7, boxShadow: "0 2px 6px rgba(245,158,11,0.3)" },
              { borderColor: "#f59e0b", backgroundColor: "#fff", opacity: 1, width: 18, height: 18, marginTop: -7, boxShadow: "0 2px 6px rgba(245,158,11,0.3)" },
            ]}
            railStyle={{ backgroundColor: "#e5e7eb", height: 5, borderRadius: 4 }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {([0, 1] as const).map((index) => (
            <label key={index} className="text-xs font-medium text-gray-600">
              {index === 0 ? "از" : "تا"}
              <input type="text" inputMode="decimal" dir="ltr" aria-label={index === 0 ? "حداقل قیمت" : "حداکثر قیمت"}
                aria-invalid={!!priceError} aria-describedby={priceError ? `price-error-${isMobile ? "mobile" : "desktop"}` : undefined}
                value={priceDraft[index]} placeholder={index === 0 ? "۰" : "بدون سقف"}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); handlePriceFilter(); } }}
                onChange={(event) => { setPriceDraft((previous) => index === 0 ? [event.target.value, previous[1]] : [previous[0], event.target.value]); setPriceError(""); }}
                className="mt-1 w-full min-w-0 px-2 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-center focus:outline-none focus:ring-2 focus:ring-kala-200" />
            </label>
          ))}
        </div>
        {priceError && <p role="alert" id={`price-error-${isMobile ? "mobile" : "desktop"}`} className="mb-3 text-xs leading-5 text-red-600">{priceError}</p>}
        <button
          onClick={handlePriceFilter}
          className="w-full bg-gray-900 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-gray-800 transition-colors active:scale-[0.98]"
        >
          اعمال بازه قیمت
        </button>
      </FilterSection>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        {([{ key: "inStock", label: "فقط کالاهای موجود", checked: inStockParam }, { key: "onSale", label: "فقط کالاهای تخفیف‌دار", checked: !!listingQuery.onSale }] as const).map((toggle) => (
          <label key={toggle.key} className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm font-bold text-gray-700">{toggle.label}</span>
            <span className="relative inline-flex shrink-0" dir="ltr">
              <input type="checkbox" className="sr-only peer" checked={toggle.checked} onChange={() => handleToggle(toggle.key)} />
              <span className="w-10 h-[22px] bg-gray-200 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-kala-500 peer-focus-visible:ring-offset-2 peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-transform after:shadow-sm peer-checked:bg-kala-500" />
            </span>
          </label>
        ))}
      </div>

      <FilterSection title="امتیاز خریداران" icon={<Star size={16} />} defaultOpen={!!listingQuery.minRating}>
        <select aria-label="حداقل امتیاز خریداران" value={listingQuery.minRating || ""} onChange={(event) => {
          const value = event.target.value;
          updateFilters((params) => { if (value) params.set("minRating", value); else params.delete("minRating"); });
        }} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
          <option value="">همه امتیازها</option>
          {listingQuery.minRating && ![1, 2, 3, 4, 5].includes(listingQuery.minRating) && <option value={listingQuery.minRating}>{listingQuery.minRating.toLocaleString("fa-IR")} و بالاتر</option>}
          {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating.toLocaleString("fa-IR")} و بالاتر</option>)}
        </select>
      </FilterSection>
      {propertyOptions.map((prop, index) => {
        const searchTerm = propertySearch[prop.name] ?? "";
        const visibleValues = searchTerm.trim()
          ? prop.values.filter((item) => item.value.toLowerCase().includes(searchTerm.trim().toLowerCase()))
          : prop.values;
        const colorProperty = isColorProperty(prop.name);
        return (
        <FilterSection key={`${categorySlug}-${prop.name}`} title={`${prop.name}${prop.unit ? ` (${prop.unit})` : ""}`} defaultOpen={index < 3 || !!selectedProperties[prop.name]?.length} badge={selectedProperties[prop.name]?.length}>
          {prop.values.length > 6 && (
            <div className="relative mb-3">
              <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                aria-label={`جستجو در مقادیر ${prop.name}`}
                placeholder={`جستجو در ${prop.name}…`}
                value={searchTerm}
                onChange={(event) => setPropertySearch((previous) => ({ ...previous, [prop.name]: event.target.value }))}
                className="w-full rounded-xl border border-gray-100 bg-gray-50 py-2 pl-3 pr-9 text-sm transition-all focus:border-kala-300 focus:outline-none focus:ring-2 focus:ring-kala-200"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {visibleValues.map(({ value, count }) => {
              const selected = !!selectedProperties[prop.name]?.includes(value);
              const color = colorProperty ? swatchFor(value) : null;
              return <button type="button" key={value} aria-pressed={selected} onClick={() => handlePropertyFilter(prop.name, value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selected ? "bg-kala-500 text-white shadow-sm shadow-kala-200" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                {color && (
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: color }}
                  />
                )}
                {value}{count !== undefined && <span>({count.toLocaleString("fa-IR")})</span>}{selected && <Check size={12} />}
              </button>;
            })}
            {visibleValues.length === 0 && (
              <p className="text-[11px] text-gray-400">موردی با این جستجو یافت نشد</p>
            )}
          </div>
          {!facets?.properties && !categoryDetails?.properties.find((item) => item.name === prop.name)?.options?.length && (
            <form className="flex gap-2 mt-2" onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const value = String(new FormData(form).get("value") || "").trim();
              if (value) { handlePropertyFilter(prop.name, value); form.reset(); }
            }}>
              <input name="value" aria-label={`مقدار ${prop.name}`} placeholder={`مقدار ${prop.name}…`} maxLength={200} className="min-w-0 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kala-200" />
              <button type="submit" className="px-3 rounded-xl bg-gray-900 text-white text-xs">افزودن</button>
            </form>
          )}
          {prop.values.length > 1 && <p className="mt-2 text-[11px] leading-5 text-gray-500">نمایش محصولات با هر یک از گزینه‌های انتخاب‌شده</p>}
        </FilterSection>
        );
      })}
    </div>
  );

  // ─── Render ─────────────────────────────────────────
  return (
    <div dir="rtl" className="product-listing min-h-screen bg-gray-50 pb-20 lg:pb-8 pt-6">
      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .product-listing :is(button, input, select):focus-visible { outline: 2px solid #d97706; outline-offset: 2px; }
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
            className="mb-4 sm:mb-6 bg-gradient-to-l from-white via-white to-[#faf8f0] rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 overflow-hidden relative"
          >
            <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-[#D4AF37]/5 to-transparent" />
            <div className="flex items-center gap-2.5 sm:gap-3.5 relative z-10">
              <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-lg sm:rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#C9A033] flex items-center justify-center shadow-lg shadow-[#D4AF37]/20">
                <Search className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-sm leading-6 sm:text-base sm:leading-7 font-bold text-gray-900">
                  نتایج جستجو برای{" "}
                  <span className="text-[#D4AF37] [overflow-wrap:anywhere]">«{searchQuery}»</span>
                </h1>
                <p className="hidden lg:block text-xs text-gray-500 mt-0.5">
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
                type="button"
                onClick={() => removeFilter("search")}
                className="shrink-0 whitespace-nowrap px-2.5 py-1.5 text-[11px] sm:px-3.5 sm:py-2 sm:text-xs font-medium text-gray-600 hover:text-gray-900 bg-white/80 sm:bg-transparent border border-gray-200 sm:border-transparent hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
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
                  ref={filterDialogRef}
                  id="product-filter-dialog" role="dialog" aria-modal="true" aria-labelledby="product-filter-title" tabIndex={-1}
                  style={{ height: "calc(100vh - 3rem)", maxHeight: "calc(100vh - 3rem)" }}
                  className="fixed inset-x-0 bottom-0 z-bottom-drawer lg:hidden bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden overscroll-contain"
                >
                  {/* Drag Handle */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-200 rounded-full" />
                  </div>
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal size={18} className="text-gray-600" />
                      <h2 id="product-filter-title" className="font-bold text-lg text-gray-800">فیلترها</h2>
                      {activeFilterCount > 0 && (
                        <span className="bg-kala-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          {activeFilterCount}
                        </span>
                      )}
                    </div>
                    <button
                      aria-label="بستن فیلترها"
                      onClick={closeFilters}
                      className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <X size={18} className="text-gray-600" />
                    </button>
                  </div>
                  {/* Scrollable Content */}
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 custom-scrollbar">
                    {renderFilterContent(true)}
                  </div>
                  {/* Bottom Actions */}
                  <div style={{ paddingBottom: "max(1rem, var(--safe-area-bottom))" }} className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center gap-3 bg-white">
                    <button
                      onClick={() => {
                        handleClearFilters();
                      }}
                      className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      حذف همه فیلترها
                    </button>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors active:scale-[0.98]"
                    >
                      {isValidating || showInitialLoader ? "در حال به‌روزرسانی…" : `مشاهده ${total.toLocaleString("fa-IR")} محصول`}
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
                  aria-haspopup="dialog" aria-expanded={showSortSheet} aria-controls="product-sort-dialog"
                  onClick={() => { setShowFilters(false); setShowSortSheet(true); }}
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
                  aria-label="فیلترها" aria-haspopup="dialog" aria-expanded={showFilters} aria-controls="product-filter-dialog"
                  onClick={() => { setShowSortSheet(false); setShowFilters(true); }}
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

            {/* فیلترهای سریع بالای لیست (به سبک ترب/تکنولایف) */}
            {quickFilters.length > 1 && (
              <div
                role="group"
                aria-label="فیلترهای سریع"
                className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 custom-scrollbar"
              >
                {quickFilters.map((pill) => {
                  const color = isColorProperty(pill.property) ? swatchFor(pill.value) : null;
                  return (
                    <button
                      key={`${pill.property}-${pill.value}`}
                      type="button"
                      aria-pressed={pill.selected}
                      aria-label={`${pill.property}: ${pill.value}`}
                      onClick={() => handlePropertyFilter(pill.property, pill.value)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        pill.selected
                          ? "border-kala-500 bg-kala-500 text-white shadow-sm shadow-kala-200"
                          : "border-gray-200 bg-white text-gray-700 hover:border-kala-300 hover:text-kala-700"
                      }`}
                    >
                      {color && (
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 rounded-full border border-black/10"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      <span>{pill.value}</span>
                      {pill.count > 0 && (
                        <span className={`tabular-nums ${pill.selected ? "text-white/80" : "text-gray-400"}`}>
                          {pill.count.toLocaleString("fa-IR")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{showInitialLoader || isValidating ? "در حال بارگذاری محصولات…" : showError ? "بارگذاری محصولات انجام نشد" : `${total.toLocaleString("fa-IR")} محصول یافت شد`}</p>
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
                {activeFilterCount > 0 && <button type="button" onClick={handleClearFilters} className="mt-5 rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white">پاک کردن فیلترها</button>}
                {searchQuery && <button type="button" onClick={() => removeFilter("search")} className="mt-3 text-sm text-kala-700">حذف عبارت جستجو</button>}
              </div>
            ) : (
              <div className="relative" aria-busy={showUpdating}>
                {showUpdating && (
                  <div className="pointer-events-none absolute inset-x-0 -top-2 z-10 flex justify-center">
                    <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-gray-600 shadow-sm ring-1 ring-gray-100">
                      <Loader2 size={12} className="animate-spin text-kala-500" />
                      در حال به‌روزرسانی…
                    </span>
                  </div>
                )}
              <motion.div
                layout
                className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 sm:gap-5 transition-opacity duration-200 ${showUpdating ? "opacity-60 pointer-events-none" : ""}`}
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
              </div>
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
              ref={sortDialogRef} id="product-sort-dialog" role="dialog" aria-modal="true" aria-labelledby="product-sort-title" tabIndex={-1}
              style={{ maxHeight: "calc(100vh - 3rem)", paddingBottom: "0px" }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-bottom-drawer shadow-2xl overflow-y-auto overscroll-contain"
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <ArrowUpDown size={18} className="text-kala-500" />
                  <h2 id="product-sort-title" className="font-bold text-lg text-gray-800">مرتب‌سازی بر اساس</h2>
                </div>
                <button
                  aria-label="بستن مرتب‌سازی"
                  onClick={closeSort}
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
                      type="button"
                      aria-pressed={isActive}
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
