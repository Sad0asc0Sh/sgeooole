/**
 * ScrollManager - Production-grade scroll position persistence
 * Handles dynamic content, lazy-loaded images, infinite scroll, and layout shifts
 */

interface ScrollState {
  y: number;
  timestamp: number;
  url: string;
  layoutHash?: string;
}

interface ScrollManagerConfig {
  debounceMs?: number;
  maxCacheSize?: number;
  cacheExpiryMs?: number;
  imageLoadTimeout?: number;
  stabilizationDelay?: number;
}

class ScrollManager {
  private cache: Map<string, ScrollState> = new Map();
  private saveTimeout: NodeJS.Timeout | null = null;
  private restoreTimeout: NodeJS.Timeout | null = null;
  private config: Required<ScrollManagerConfig>;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private isRestoring = false;

  constructor(config: ScrollManagerConfig = {}) {
    this.config = {
      debounceMs: config.debounceMs ?? 150,
      maxCacheSize: config.maxCacheSize ?? 50,
      cacheExpiryMs: config.cacheExpiryMs ?? 30 * 60 * 1000, // 30 minutes
      imageLoadTimeout: config.imageLoadTimeout ?? 3000,
      stabilizationDelay: config.stabilizationDelay ?? 100,
    };
  }

  /**
   * Generate a layout hash to detect if DOM structure has changed
   */
  private generateLayoutHash(): string {
    const elements = document.querySelectorAll('[data-scroll-anchor]');
    if (elements.length === 0) {
      // Fallback: use body height and main container count
      const height = document.body.scrollHeight;
      const containers = document.querySelectorAll('main > *').length;
      return `${height}-${containers}`;
    }
    return Array.from(elements)
      .map(el => {
        const rect = el.getBoundingClientRect();
        return `${el.getAttribute('data-scroll-anchor')}-${Math.round(rect.top)}`;
      })
      .join('|');
  }

  /**
   * Save current scroll position with layout information
   */
  saveScrollPosition(key: string): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      const y = window.scrollY || window.pageYOffset;
      const state: ScrollState = {
        y,
        timestamp: Date.now(),
        url: window.location.href,
        layoutHash: this.generateLayoutHash(),
      };

      this.cache.set(key, state);

      // Cleanup old entries
      if (this.cache.size > this.config.maxCacheSize) {
        const oldestKey = Array.from(this.cache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        this.cache.delete(oldestKey);
      }

      // Persist to sessionStorage for resilience
      try {
        sessionStorage.setItem(`scroll_${key}`, JSON.stringify(state));
      } catch (e) {
        // Storage quota exceeded - clean up old entries
        this.cleanupSessionStorage();
      }
    }, this.config.debounceMs);
  }

  /**
   * Restore scroll position with intelligent retry and image wait
   */
  async restoreScrollPosition(key: string, force: boolean = false): Promise<boolean> {
    if (this.isRestoring && !force) {
      return false;
    }

    this.isRestoring = true;

    try {
      // Try memory cache first
      let state = this.cache.get(key);

      // Fallback to sessionStorage
      if (!state) {
        const stored = sessionStorage.getItem(`scroll_${key}`);
        if (stored) {
          state = JSON.parse(stored);
          // Check if expired
          if (state && Date.now() - state.timestamp > this.config.cacheExpiryMs) {
            sessionStorage.removeItem(`scroll_${key}`);
            return false;
          }
        }
      }

      if (!state || state.y === 0) {
        return false;
      }

      // Wait for images to load
      await this.waitForImages();

      // Wait for layout stabilization
      await this.waitForLayoutStable();

      // Verify layout hasn't dramatically changed
      const currentHash = this.generateLayoutHash();
      const layoutChanged = state.layoutHash && 
        Math.abs(parseInt(state.layoutHash) - parseInt(currentHash)) > 500;

      if (layoutChanged) {
        console.warn('[ScrollManager] Layout changed significantly, skipping restore');
        return false;
      }

      // Restore scroll position
      window.scrollTo({
        top: state.y,
        behavior: 'instant' as ScrollBehavior,
      });

      // Verify scroll position was set correctly (some browsers delay this)
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const actualY = window.scrollY || window.pageYOffset;
      if (Math.abs(actualY - state.y) > 10) {
        // Retry once
        window.scrollTo({
          top: state.y,
          behavior: 'instant' as ScrollBehavior,
        });
      }

      return true;
    } catch (error) {
      console.error('[ScrollManager] Restore failed:', error);
      return false;
    } finally {
      this.isRestoring = false;
    }
  }

  /**
   * Wait for all images in viewport to load
   */
  private waitForImages(): Promise<void> {
    return new Promise((resolve) => {
      const images = Array.from(document.querySelectorAll('img'));
      const unloadedImages = images.filter(img => !img.complete);

      if (unloadedImages.length === 0) {
        resolve();
        return;
      }

      let loadedCount = 0;
      const timeout = setTimeout(() => {
        resolve();
      }, this.config.imageLoadTimeout);

      const checkComplete = () => {
        loadedCount++;
        if (loadedCount >= unloadedImages.length) {
          clearTimeout(timeout);
          resolve();
        }
      };

      unloadedImages.forEach(img => {
        if (img.complete) {
          checkComplete();
        } else {
          img.addEventListener('load', checkComplete, { once: true });
          img.addEventListener('error', checkComplete, { once: true });
        }
      });
    });
  }

  /**
   * Wait for layout to stabilize (no height changes)
   */
  private waitForLayoutStable(): Promise<void> {
    return new Promise((resolve) => {
      let lastHeight = document.body.scrollHeight;
      let stableCount = 0;
      const requiredStableChecks = 3;

      const checkInterval = setInterval(() => {
        const currentHeight = document.body.scrollHeight;
        if (currentHeight === lastHeight) {
          stableCount++;
          if (stableCount >= requiredStableChecks) {
            clearInterval(checkInterval);
            resolve();
          }
        } else {
          stableCount = 0;
          lastHeight = currentHeight;
        }
      }, this.config.stabilizationDelay);

      // Safety timeout
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 2000);
    });
  }

  /**
   * Observe layout shifts and re-adjust scroll if needed
   */
  observeLayoutShifts(key: string): void {
    this.stopObserving();

    const state = this.cache.get(key);
    if (!state) return;

    let initialHeight = document.body.scrollHeight;

    // Watch for DOM mutations that might affect layout
    this.mutationObserver = new MutationObserver(() => {
      const newHeight = document.body.scrollHeight;
      if (newHeight !== initialHeight && !this.isRestoring) {
        const currentY = window.scrollY || window.pageYOffset;
        const heightDiff = newHeight - initialHeight;
        
        // If content was added above viewport, adjust scroll
        if (heightDiff > 0 && currentY > 0) {
          window.scrollTo({
            top: currentY,
            behavior: 'instant' as ScrollBehavior,
          });
        }
        
        initialHeight = newHeight;
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    });

    // Watch for element resizes
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.isRestoring) {
        const currentY = window.scrollY || window.pageYOffset;
        if (currentY > 0 && state.y > 0) {
          // Maintain scroll position during resizes
          window.scrollTo({
            top: currentY,
            behavior: 'instant' as ScrollBehavior,
          });
        }
      }
    });

    const main = document.querySelector('main');
    if (main) {
      this.resizeObserver.observe(main);
    }
  }

  /**
   * Stop observing layout changes
   */
  stopObserving(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  /**
   * Clear scroll state for a specific key
   */
  clearScrollPosition(key: string): void {
    this.cache.delete(key);
    sessionStorage.removeItem(`scroll_${key}`);
  }

  /**
   * Clear all scroll states
   */
  clearAll(): void {
    this.cache.clear();
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith('scroll_')) {
        sessionStorage.removeItem(key);
      }
    });
  }

  /**
   * Cleanup expired entries from sessionStorage
   */
  private cleanupSessionStorage(): void {
    const keys = Object.keys(sessionStorage);
    const scrollKeys = keys.filter(k => k.startsWith('scroll_'));
    
    scrollKeys.forEach(key => {
      try {
        const stored = sessionStorage.getItem(key);
        if (stored) {
          const state = JSON.parse(stored);
          if (Date.now() - state.timestamp > this.config.cacheExpiryMs) {
            sessionStorage.removeItem(key);
          }
        }
      } catch (e) {
        sessionStorage.removeItem(key);
      }
    });
  }

  /**
   * Cleanup on unmount
   */
  destroy(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    if (this.restoreTimeout) {
      clearTimeout(this.restoreTimeout);
    }
    this.stopObserving();
  }
}

// Singleton instance
let scrollManagerInstance: ScrollManager | null = null;

export function getScrollManager(): ScrollManager {
  if (typeof window === 'undefined') {
    // SSR safeguard
    return new ScrollManager();
  }
  
  if (!scrollManagerInstance) {
    scrollManagerInstance = new ScrollManager();
  }
  return scrollManagerInstance;
}

export default ScrollManager;
