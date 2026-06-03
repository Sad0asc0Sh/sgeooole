/**
 * Scroll Restoration Examples
 * Demonstrates various use cases and edge cases
 */

// ============================================================================
// Example 1: Basic Product List with Scroll Restoration
// ============================================================================

"use client";

import { useRef } from 'react';
import { useScrollRestoration as useScroll } from '@/hooks/useScrollRestoration';

export function ProductListExample() {
  // Enable automatic scroll restoration
  useScroll({
    enabled: true,
    restoreOnMount: true,
    saveOnScroll: true,
    observeLayoutShifts: true,
  });

  return (
    <div>
      <h1>Products</h1>
      {/* Add scroll anchor for stable tracking */}
      <div className="product-grid" data-scroll-anchor="product-grid">
        {/* Products... */}
      </div>
    </div>
  );
}

// ============================================================================
// Example 2: Product Detail (No Restoration - Always Top)
// ============================================================================

import { useDisableScrollRestoration as useDisableScroll } from '@/hooks/useScrollRestoration';

export function ProductDetailExample() {
  // Disable restoration - always start at top
  useDisableScroll();

  return (
    <div>
      <h1>Product Details</h1>
      {/* Content always starts at top */}
    </div>
  );
}

// ============================================================================
// Example 3: Infinite Scroll with Restoration
// ============================================================================

import { useEffect, useState } from 'react';

export function InfiniteScrollExample() {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  
  // Scroll restoration with layout shift observation
  const { saveScroll } = useScroll({
    enabled: true,
    observeLayoutShifts: true, // Important for infinite scroll
  });

  useEffect(() => {
    // Load more items
    loadMoreItems(page).then(newItems => {
      setItems(prev => [...prev, ...newItems]);
      // Save scroll after items are added
      setTimeout(saveScroll, 100);
    });
  }, [page, saveScroll]);

  return (
    <div>
      <div data-scroll-anchor="infinite-list">
        {items.map(item => (
          <div key={item.id}>{item.name}</div>
        ))}
      </div>
      <button onClick={() => setPage(p => p + 1)}>Load More</button>
    </div>
  );
}

// ============================================================================
// Example 4: Search Results (Conditional Restoration)
// ============================================================================

import { useSearchParams } from 'next/navigation';

export function SearchResultsExample() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  
  // Only restore scroll if it's the same search query
  useScroll({
    enabled: true,
    key: `/search?q=${query}`, // Custom key per search
  });

  return (
    <div>
      <h1>Search Results for: {query}</h1>
      <div data-scroll-anchor="search-results">
        {/* Results... */}
      </div>
    </div>
  );
}

// ============================================================================
// Example 5: Manual Control with Loading States
// ============================================================================

export function ManualControlExample() {
  const [isLoading, setIsLoading] = useState(false);
  const { saveScroll, restoreScroll, clearScroll } = useScroll({
    enabled: true,
    restoreOnMount: false, // Manual control
    saveOnScroll: false,   // Manual control
  });

  const handleRefresh = async () => {
    setIsLoading(true);
    
    // Save current position before refresh
    saveScroll();
    
    // Load new data
    await fetchNewData();
    
    // Restore position after load
    await restoreScroll();
    
    setIsLoading(false);
  };

  const handleReset = () => {
    clearScroll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <button onClick={handleRefresh}>Refresh</button>
      <button onClick={handleReset}>Reset to Top</button>
      {isLoading ? <Spinner /> : <Content />}
    </div>
  );
}

// ============================================================================
// Example 6: Category Filter with Conditional Restoration
// ============================================================================

export function CategoryFilterExample() {
  const searchParams = useSearchParams();
  const category = searchParams.get('category');
  const previousCategory = useRef<string | null>(null);
  
  // Only restore if returning to same category
  const shouldRestore = category === previousCategory.current;
  
  useScroll({
    enabled: shouldRestore,
    key: `/products?category=${category}`,
  });

  useEffect(() => {
    if (!shouldRestore) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    previousCategory.current = category;
  }, [category, shouldRestore]);

  return (
    <div>
      <h1>Category: {category}</h1>
      <div data-scroll-anchor="category-grid">
        {/* Products... */}
      </div>
    </div>
  );
}

// ============================================================================
// Example 7: Tabs with Scroll Restoration
// ============================================================================

export function TabbedContentExample() {
  const [activeTab, setActiveTab] = useState('all');
  
  // Different scroll position per tab
  useScroll({
    enabled: true,
    key: `/products?tab=${activeTab}`,
  });

  return (
    <div>
      <div className="tabs">
        <button onClick={() => setActiveTab('all')}>All</button>
        <button onClick={() => setActiveTab('featured')}>Featured</button>
        <button onClick={() => setActiveTab('sale')}>Sale</button>
      </div>
      <div data-scroll-anchor={`tab-${activeTab}`}>
        {/* Tab content... */}
      </div>
    </div>
  );
}

// ============================================================================
// Example 8: Modal with Background Scroll Lock
// ============================================================================

export function ModalWithScrollLockExample() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { saveScroll, restoreScroll } = useScroll({
    enabled: true,
    saveOnScroll: false, // Manual control
  });

  const openModal = () => {
    // Save scroll position before opening modal
    saveScroll();
    setIsModalOpen(true);
    // Lock body scroll
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setIsModalOpen(false);
    // Unlock body scroll
    document.body.style.overflow = '';
    // Restore scroll position
    setTimeout(() => restoreScroll(), 0);
  };

  return (
    <div>
      <button onClick={openModal}>Open Modal</button>
      {isModalOpen && (
        <div className="modal">
          <button onClick={closeModal}>Close</button>
          {/* Modal content... */}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 9: Lazy Load Images with Scroll Restoration
// ============================================================================

import Image from 'next/image';

export function LazyImageGridExample() {
  useScroll({
    enabled: true,
    observeLayoutShifts: true, // Critical for lazy images
  });

  return (
    <div data-scroll-anchor="image-grid">
      {products.map(product => (
        <div key={product.id}>
          <Image
            src={product.image}
            alt={product.title}
            width={300}
            height={300}
            loading="lazy"
            // ScrollManager will wait for these to load
          />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Example 10: Advanced - Dynamic Content with Placeholder Heights
// ============================================================================

export function DynamicContentExample() {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useScroll({
    enabled: true,
    observeLayoutShifts: true,
  });

  return (
    <div data-scroll-anchor="dynamic-content">
      {isLoading ? (
        // Placeholder with same height as real content
        // Reduces layout shift when content loads
        <div className="skeleton-grid">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="skeleton-card h-[400px]" />
          ))}
        </div>
      ) : (
        items.map(item => (
          <div key={item.id} className="h-[400px]">
            {item.content}
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

async function loadMoreItems(page: number): Promise<any[]> {
  // Simulate API call
  return [];
}

async function fetchNewData(): Promise<void> {
  // Simulate API call
}

const products: any[] = [];

function Spinner() {
  return <div>Loading...</div>;
}

function Content() {
  return <div>Content</div>;
}
