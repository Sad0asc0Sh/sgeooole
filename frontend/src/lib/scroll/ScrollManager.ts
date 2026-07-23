/**
 * ScrollManager - Production-grade, high-performance scroll position persistence
 * Supports instant restoration, dynamic layout expansion, and SessionStorage fallback.
 */

interface ScrollState {
  y: number;
  timestamp: number;
  url: string;
}

interface ScrollManagerConfig {
  debounceMs?: number;
  maxCacheSize?: number;
  cacheExpiryMs?: number;
}

class ScrollManager {
  private cache: Map<string, ScrollState> = new Map();
  private saveTimeout: NodeJS.Timeout | null = null;
  private restorationIntervalId: NodeJS.Timeout | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private config: Required<ScrollManagerConfig>;
  private isRestoring = false;

  constructor(config: ScrollManagerConfig = {}) {
    this.config = {
      debounceMs: config.debounceMs ?? 50,
      maxCacheSize: config.maxCacheSize ?? 100,
      cacheExpiryMs: config.cacheExpiryMs ?? 60 * 60 * 1000, // 60 minutes
    };
  }

  /**
   * Save current scroll position to memory cache and SessionStorage
   */
  private persistScrollState(key: string, state: ScrollState): void {
    if (!key) return;
    this.cache.set(key, state);

    if (this.cache.size > this.config.maxCacheSize) {
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.cache.delete(oldestKey);
    }

    try {
      sessionStorage.setItem(`scroll_${key}`, JSON.stringify(state));
    } catch (e) {
      this.cleanupSessionStorage();
    }
  }

  private createScrollState(overrideY?: number): ScrollState {
    const y = typeof overrideY === 'number' ? overrideY : (window.scrollY || window.pageYOffset || 0);
    return {
      y: Math.max(0, y),
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
    };
  }

  saveScrollPosition(key: string, overrideY?: number): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.persistScrollState(key, this.createScrollState(overrideY));
    }, this.config.debounceMs);
  }

  saveScrollPositionImmediate(key: string, overrideY?: number): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.persistScrollState(key, this.createScrollState(overrideY));
  }

  getSavedPosition(key: string): number | null {
    let state = this.cache.get(key);

    if (!state && typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(`scroll_${key}`);
        if (stored) {
          state = JSON.parse(stored);
          if (state && Date.now() - state.timestamp > this.config.cacheExpiryMs) {
            sessionStorage.removeItem(`scroll_${key}`);
            return null;
          }
        }
      } catch (e) {
        return null;
      }
    }

    return state ? state.y : null;
  }

  /**
   * Restore scroll position with dynamic height locking as DOM expands
   */
  async restoreScrollPosition(key: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    this.cancelRestorationLoop();
    this.isRestoring = true;

    try {
      const targetY = this.getSavedPosition(key);

      if (targetY === null || targetY <= 0) {
        this.isRestoring = false;
        return false;
      }

      // Step 1: Immediate scroll attempt
      window.scrollTo({
        top: targetY,
        behavior: 'instant' as ScrollBehavior,
      });

      // Step 2: Continuous dynamic height locking loop
      const startTime = Date.now();
      const maxDuration = 2500; // monitor for up to 2.5s while SWR/images load

      const checkAndAdjustScroll = () => {
        const currentY = window.scrollY || window.pageYOffset || 0;
        const currentDocHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        );

        // Re-apply scroll if targetY hasn't been reached yet and document is scrollable
        if (Math.abs(currentY - targetY) > 5 && currentDocHeight > window.innerHeight) {
          window.scrollTo({
            top: targetY,
            behavior: 'instant' as ScrollBehavior,
          });
        }

        const updatedY = window.scrollY || window.pageYOffset || 0;
        const elapsedTime = Date.now() - startTime;

        // Stop monitoring if target position reached or timeout reached
        if (Math.abs(updatedY - targetY) <= 5 || elapsedTime >= maxDuration) {
          this.cancelRestorationLoop();
          this.isRestoring = false;
        }
      };

      // Set up high-frequency interval check (every 25ms)
      this.restorationIntervalId = setInterval(checkAndAdjustScroll, 25);

      // Set up MutationObserver to re-scroll instantly whenever DOM nodes change
      if (typeof MutationObserver !== 'undefined') {
        this.mutationObserver = new MutationObserver(() => {
          checkAndAdjustScroll();
        });
        this.mutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: false,
        });
      }

      // Set up ResizeObserver to re-scroll on body resize
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          checkAndAdjustScroll();
        });
        this.resizeObserver.observe(document.body);
      }

      checkAndAdjustScroll();
      return true;
    } catch (error) {
      console.error('[ScrollManager] Restore error:', error);
      this.isRestoring = false;
      return false;
    }
  }

  private cancelRestorationLoop(): void {
    if (this.restorationIntervalId) {
      clearInterval(this.restorationIntervalId);
      this.restorationIntervalId = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  observeLayoutShifts(_key: string): void {
    // Handled dynamically by restoreScrollPosition
  }

  stopObserving(): void {
    this.cancelRestorationLoop();
  }

  clearScrollPosition(key: string): void {
    this.cache.delete(key);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`scroll_${key}`);
    }
  }

  clearAll(): void {
    this.cache.clear();
    if (typeof window !== 'undefined') {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('scroll_')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }

  private cleanupSessionStorage(): void {
    if (typeof window === 'undefined') return;
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

  destroy(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.cancelRestorationLoop();
  }
}

// Singleton instance
let scrollManagerInstance: ScrollManager | null = null;

export function getScrollManager(): ScrollManager {
  if (typeof window === 'undefined') {
    return new ScrollManager();
  }

  if (!scrollManagerInstance) {
    scrollManagerInstance = new ScrollManager();
  }
  return scrollManagerInstance;
}

export default ScrollManager;


