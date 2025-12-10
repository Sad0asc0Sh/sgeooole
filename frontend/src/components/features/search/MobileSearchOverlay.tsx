import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, X, Clock, TrendingUp, ChevronLeft, Loader2, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from '@/hooks/useDebounce';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { productService, Product } from '@/services/productService';
import { searchService } from '@/services/searchService';

interface MobileSearchOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

const MobileSearchOverlay: React.FC<MobileSearchOverlayProps> = ({ isOpen, onClose }) => {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
    const [searchSettings, setSearchSettings] = useState({
        trackingEnabled: false,
        trendingEnabled: false,
        trendingLimit: 8,
        trendingPeriodDays: 30
    });
    const inputRef = useRef<HTMLInputElement>(null);

    const debouncedQuery = useDebounce(query, 500);
    const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();


    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    // Fetch Search Settings from API
    useEffect(() => {
        const fetchSearchSettings = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/settings/public`);
                const data = await response.json();
                if (data.success && data.settings?.searchSettings) {
                    setSearchSettings(data.settings.searchSettings);
                }
            } catch (error) {
                console.error('Failed to fetch search settings:', error);
            }
        };

        fetchSearchSettings();
    }, []);

    // Fetch Trending Searches from API
    useEffect(() => {
        const fetchTrendingSearches = async () => {
            if (!searchSettings.trendingEnabled) return;

            const trending = await searchService.getTrendingSearches(searchSettings.trendingLimit);
            setTrendingSearches(trending);
        };

        fetchTrendingSearches();
    }, []);

    // Handle Search Logic
    useEffect(() => {
        const fetchProducts = async () => {
            if (!debouncedQuery.trim()) {
                setResults([]);
                setTotalResults(0);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                const { products, total } = await productService.getProducts({
                    search: debouncedQuery,
                    limit: 6  // Show fewer items in quick search
                });
                setResults(products);
                setTotalResults(total);
            } catch (error) {
                console.error('Search failed:', error);
                setResults([]);
                setTotalResults(0);
            } finally {
                setIsSearching(false);
            }
        };

        fetchProducts();
    }, [debouncedQuery]);

    // Navigate to full search results page
    const navigateToResults = () => {
        if (query.trim()) {
            addToHistory(query.trim());
            if (searchSettings.trackingEnabled) {
                searchService.trackSearch(query.trim());
            }
            router.push(`/products?search=${encodeURIComponent(query.trim())}`);
            onClose();
        }
    };

    const handleSearchSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        navigateToResults();
    };

    const handleHistoryClick = (term: string) => {
        setQuery(term);
        addToHistory(term);
        // Track search for trending analytics (if enabled)
        if (searchSettings.trackingEnabled) {
            searchService.trackSearch(term);
        }
    };

    // Navigate to full results when clicking on trending
    const handleTrendingClick = (tag: string) => {
        addToHistory(tag);
        if (searchSettings.trackingEnabled) {
            searchService.trackSearch(tag);
        }
        router.push(`/products?search=${encodeURIComponent(tag)}`);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: '100%' }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed inset-0 z-[9999] bg-gray-50 flex flex-col h-[100dvh] w-full overflow-hidden"
                    dir="rtl"
                >
                    {/* --- Header / Input Area --- */}
                    <div className="bg-white px-4 py-3 shadow-sm flex items-center gap-3 sticky top-0 z-10">
                        <button
                            onClick={onClose}
                            className="p-2 -mr-2 text-gray-500 hover:text-gray-700 active:scale-95 transition-transform"
                        >
                            <ArrowRight className="w-6 h-6" />
                        </button>

                        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="جستجو در محصولات..."
                                className="w-full h-12 pr-10 pl-4 bg-gray-100 border border-transparent focus:bg-white focus:border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 outline-none transition-all text-sm font-medium"
                            />
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#D4AF37]" />

                            {query && (
                                <button
                                    type="button"
                                    onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 p-1 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </form>
                    </div>

                    {/* --- Content Area --- */}
                    <div className="flex-1 overflow-y-auto p-4 pb-20">

                        {/* State A: History & Trending (Empty Query) */}
                        {!query && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="space-y-6"
                            >
                                {/* Recent Searches */}
                                {history.length > 0 && (
                                    <section>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                جستجوهای اخیر
                                            </h3>
                                            <button
                                                onClick={clearHistory}
                                                className="text-xs text-red-500 hover:text-red-600"
                                            >
                                                پاک کردن
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {history.map((term, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleHistoryClick(term)}
                                                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors flex items-center gap-1 group"
                                                >
                                                    {term}
                                                    <span
                                                        onClick={(e) => { e.stopPropagation(); removeFromHistory(term); }}
                                                        className="mr-1 p-0.5 rounded-full hover:bg-gray-100 text-gray-400 group-hover:text-[#D4AF37]"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Trending - Dynamic from API */}
                                {searchSettings.trendingEnabled && trendingSearches.length > 0 && (
                                    <section>
                                        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
                                            محبوب‌ترین‌ها
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {trendingSearches.map((tag: string, idx: number) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleTrendingClick(tag)}
                                                    className="px-3 py-1.5 bg-gray-100 rounded-full text-xs text-gray-600 hover:bg-[#D4AF37] hover:text-white transition-colors"
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </motion.div>
                        )}

                        {/* State B: Results (With Query) */}
                        {query && (
                            <div className="space-y-3">
                                {isSearching ? (
                                    <div className="flex justify-center py-10">
                                        <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
                                    </div>
                                ) : results.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400">
                                        <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                        <p className="font-medium">موردی یافت نشد</p>
                                        <p className="text-sm mt-1">عبارت دیگری را امتحان کنید</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Quick Results Header */}
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-gray-500">
                                                <span className="font-bold text-gray-700">{totalResults}</span> نتیجه
                                            </span>
                                        </div>

                                        {/* Results List */}
                                        {results.map((product) => (
                                            <SearchResultItem key={product.id} product={product} onClose={onClose} />
                                        ))}

                                        {/* View All Results Button */}
                                        {totalResults > results.length && (
                                            <motion.button
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                onClick={navigateToResults}
                                                className="w-full mt-4 py-4 bg-gradient-to-l from-[#D4AF37] to-[#C9A033] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20 hover:shadow-xl hover:shadow-[#D4AF37]/30 transition-all active:scale-[0.98]"
                                            >
                                                <span>مشاهده همه {totalResults} نتیجه</span>
                                                <ArrowUpRight className="w-4 h-4" />
                                            </motion.button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// --- Sub-components ---

const SearchResultItem = ({ product, onClose }: { product: Product; onClose: () => void }) => {
    const router = useRouter();

    // Use slug if available, otherwise fallback to id
    const productUrl = `/product/${product.slug || product.id}`;

    const handleClick = () => {
        router.push(productUrl);
        onClose();
    };

    return (
        <button onClick={handleClick} className="block w-full text-right">
            <div className="flex items-center gap-3 p-3 border border-gray-100 bg-white hover:bg-gray-50 hover:border-[#D4AF37]/30 transition-all rounded-xl shadow-sm">
                {/* Product Image */}
                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                    <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                        {product.image ? (
                            <img
                                src={product.image}
                                alt={product.title}
                                className="object-cover w-full h-full"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <Search className="w-5 h-5 text-gray-300" />
                        )}
                    </div>
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-medium text-gray-800 truncate">
                        {product.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1.5">
                        {/* Product Code (KY-XXXXXXX) */}
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded tracking-wider">
                            {(() => {
                                // Extract digits from SKU
                                const skuDigits = product.sku ? product.sku.replace(/\D/g, '') : '';

                                let code = '';
                                if (skuDigits.length > 0) {
                                    // Take last 7 digits, pad with zeros if needed
                                    code = skuDigits.slice(-7).padStart(7, '0');
                                } else {
                                    // Fallback: Generate deterministic 7-digit number from ID
                                    let hash = 0;
                                    for (let i = 0; i < product.id.length; i++) {
                                        hash = ((hash << 5) - hash) + product.id.charCodeAt(i);
                                        hash |= 0;
                                    }
                                    code = Math.abs(hash).toString().slice(0, 7).padStart(7, '0');
                                }

                                return `KY-${code}`;
                            })()}
                        </span>

                        {/* Category - hide if it looks like ObjectId */}
                        {product.category && !/^[0-9a-fA-F]{24}$/.test(product.category) && (
                            <span className="text-[10px] text-gray-400 truncate">
                                {product.category}
                            </span>
                        )}
                    </div>
                </div>

                {/* Price Section */}
                <div className="flex flex-col items-end">
                    {product.oldPrice && product.oldPrice > product.price && (
                        <span className="text-[10px] text-gray-400 line-through">
                            {product.oldPrice.toLocaleString('fa-IR')}
                        </span>
                    )}
                    <span className="text-sm font-bold text-[#D4AF37]">
                        {product.price.toLocaleString('fa-IR')}
                        <span className="text-[10px] font-normal mr-0.5">تومان</span>
                    </span>
                </div>

                <ChevronLeft className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </div>
        </button>
    );
};

export default MobileSearchOverlay;
