import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, ArrowRight, X, Clock, TrendingUp, ChevronLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from '@/hooks/useDebounce';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { productService, Product } from '@/services/productService';

const TRENDING_TAGS = ['آیفون ۱۳', 'سامسونگ S24', 'PS5', 'ایرپاد', 'شیائومی', 'لپ تاپ گیمینگ'];

interface MobileSearchOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

const MobileSearchOverlay: React.FC<MobileSearchOverlayProps> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);
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

    // Handle Search Logic
    useEffect(() => {
        const fetchProducts = async () => {
            if (!debouncedQuery.trim()) {
                setResults([]);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            try {
                const { products } = await productService.getProducts({
                    search: debouncedQuery,
                    limit: 10
                });
                setResults(products);
            } catch (error) {
                console.error('Search failed:', error);
                setResults([]);
            } finally {
                setIsSearching(false);
            }
        };

        fetchProducts();
    }, [debouncedQuery]);

    const handleSearchSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (query.trim()) {
            addToHistory(query.trim());
            // Here you would typically navigate to a search results page
            // For now, we just close the overlay or keep it open with results
        }
    };

    const handleHistoryClick = (term: string) => {
        setQuery(term);
        addToHistory(term);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: '100%' }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed inset-0 z-50 bg-gray-50 flex flex-col h-[100dvh] w-full overflow-hidden"
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

                                {/* Trending */}
                                <section>
                                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-[#D4AF37]" />
                                        محبوب‌ترین‌ها
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {TRENDING_TAGS.map((tag, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setQuery(tag)}
                                                className="px-3 py-1.5 bg-gray-100 rounded-full text-xs text-gray-600 hover:bg-[#D4AF37] hover:text-white transition-colors"
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            </motion.div>
                        )}

                        {/* State B: Results (With Query) */}
                        {query && (
                            <div className="space-y-2">
                                {isSearching ? (
                                    <div className="flex justify-center py-10">
                                        <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
                                    </div>
                                ) : results.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400">
                                        <p>موردی یافت نشد</p>
                                    </div>
                                ) : (
                                    results.map((product) => (
                                        <SearchResultItem key={product.id} product={product} />
                                    ))
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

const SearchResultItem = ({ product }: { product: Product }) => (
    <Link href={`/product/${product.id}`} className="block">
        <div className="flex items-center gap-3 p-3 border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors rounded-lg mb-2 shadow-sm">
            {/* Product Image */}
            <div className="relative w-12 h-12 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                {/* Using a placeholder if image fails or is generic */}
                <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                    {product.image ? (
                        <img
                            src={product.image}
                            alt={product.title}
                            className="object-cover w-full h-full"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement!.innerText = 'IMG';
                            }}
                        />
                    ) : (
                        <span className="text-xs">IMG</span>
                    )}
                </div>
            </div>

            {/* Text Content */}
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-700 truncate text-right">
                    {product.title}
                </h4>
                <div className="flex items-center justify-between mt-1">
                    {/* Category or Meta - Gray */}
                    <span className="text-xs text-gray-400">{product.category || 'کالای دیجیتال'}</span>
                    {/* Price - Rich Gold */}
                    <span className="text-sm font-bold text-[#D4AF37]">
                        {product.price.toLocaleString('fa-IR')} تومان
                    </span>
                </div>
            </div>

            <ChevronLeft className="w-4 h-4 text-gray-300" />
        </div>
    </Link>
);

export default MobileSearchOverlay;
