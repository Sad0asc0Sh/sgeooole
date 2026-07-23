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
  private restorationRafId: number | null = null;
  private restorationIntervalId: NodeJS.Timeout | null = null;
  private config: Required<ScrollManagerConfig>;
  private isRestoring = false;

  constructor(config: ScrollManagerConfig = {}) {
    this.config = {
      debounceMs: config.debounceMs ?? 80,
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
   * Restore scroll position with frame-based auto-adjustment as DOM expands
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

      // Step 2: Frame-based restoration loop as DOM expands (e.g. SWR hydration / image loads)
      const startTime = Date.now();
      const maxDuration = 1200; // max 1.2s monitoring window

      const checkAndAdjustScroll = () => {
        const currentY = window.scrollY || window.pageYOffset || 0;
        const currentDocHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        );
        const viewportHeight = window.innerHeight;

        // If targetY is reachable and we haven't reached it yet, re-apply scrollTo
        if (currentY < targetY - 2 && currentDocHeight > viewportHeight) {
          window.scrollTo({
            top: targetY,
            behavior: 'instant' as ScrollBehavior,
          });
        }

        const updatedY = window.scrollY || window.pageYOffset || 0;
        const elapsedTime = Date.now() - startTime;

        // Stop loop if target position reached or timeout exceeded
        if (Math.abs(updatedY - targetY) <= 5 || elapsedTime >= maxDuration) {
          this.cancelRestorationLoop();
          this.isRestoring = false;
        }
      };

      // Run interval every 35ms during layout mount
      this.restorationIntervalId = setInterval(checkAndAdjustScroll, 35);
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
    if (this.restorationRafId) {
      cancelAnimationFrame(this.restorationRafId);
      this.restorationRafId = null;
    }
  }

  observeLayoutShifts(_key: string): void {
    // No-op for backward compatibility, handled dynamically by restoreScrollPosition frame loop
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

