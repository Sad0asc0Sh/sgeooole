/**
 * ScrollManager - Production-grade, high-performance scroll position persistence
 * Simple, rock-solid, interactive scroll position caching with SessionStorage fallback.
 */

interface ScrollState {
  y: number;
  timestamp: number;
}

class ScrollManager {
  private cache: Map<string, ScrollState> = new Map();
  private restorationTimer: NodeJS.Timeout | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;

  /**
   * Save current scroll position for a page key
   */
  save(key: string, overrideY?: number): void {
    if (!key || typeof window === 'undefined') return;
    const y = typeof overrideY === 'number' ? overrideY : (window.scrollY || window.pageYOffset || 0);

    const state = { y: Math.max(0, y), timestamp: Date.now() };
    this.cache.set(key, state);

    try {
      sessionStorage.setItem(`scroll_pos_${key}`, JSON.stringify(state));
    } catch (e) {
      // Storage quota or error fallback
    }
  }

  /**
   * Retrieve saved scroll position for a page key
   */
  getSavedY(key: string): number | null {
    if (!key || typeof window === 'undefined') return null;

    // Check memory first
    const memory = this.cache.get(key);
    if (memory && typeof memory.y === 'number') {
      return memory.y;
    }

    // Fallback to SessionStorage
    try {
      const raw = sessionStorage.getItem(`scroll_pos_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.y === 'number') {
          this.cache.set(key, parsed);
          return parsed.y;
        }
      }
    } catch (e) {
      // Ignore parse error
    }

    return null;
  }

  /**
   * Clear scroll position for a key (e.g. when user explicitly navigates forward via menu)
   */
  clear(key: string): void {
    if (!key) return;
    this.cache.delete(key);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(`scroll_pos_${key}`);
      } catch (e) {}
    }
  }

  /**
   * Restore scroll position for a page key with continuous frame-locking
   */
  restore(key: string): boolean {
    if (typeof window === 'undefined') return false;

    this.stopRestoration();

    const targetY = this.getSavedY(key);
    if (targetY === null || targetY <= 0) {
      return false;
    }

    // Step 1: Immediate scroll
    window.scrollTo({ top: targetY, behavior: 'instant' as ScrollBehavior });

    // Step 2: High-frequency frame restoration loop as DOM nodes / SWR data render
    const startTime = Date.now();
    const maxDuration = 2500; // 2.5s maximum retry window

    const applyScroll = () => {
      const currentY = window.scrollY || window.pageYOffset || 0;
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );

      // Re-apply if not reached target yet
      if (Math.abs(currentY - targetY) > 5 && docHeight > window.innerHeight) {
        window.scrollTo({ top: targetY, behavior: 'instant' as ScrollBehavior });
      }

      const newY = window.scrollY || window.pageYOffset || 0;
      if (Math.abs(newY - targetY) <= 5 || Date.now() - startTime >= maxDuration) {
        this.stopRestoration();
      }
    };

    // Frame interval check every 20ms
    this.restorationTimer = setInterval(applyScroll, 20);

    // MutationObserver for DOM changes
    if (typeof MutationObserver !== 'undefined') {
      this.mutationObserver = new MutationObserver(applyScroll);
      this.mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    // ResizeObserver for element resizes
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(applyScroll);
      this.resizeObserver.observe(document.body);
    }

    applyScroll();
    return true;
  }

  stopRestoration(): void {
    if (this.restorationTimer) {
      clearInterval(this.restorationTimer);
      this.restorationTimer = null;
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

  // Backward compatibility alias methods
  saveScrollPosition(key: string, overrideY?: number): void {
    this.save(key, overrideY);
  }

  saveScrollPositionImmediate(key: string, overrideY?: number): void {
    this.save(key, overrideY);
  }

  restoreScrollPosition(key: string): Promise<boolean> {
    return Promise.resolve(this.restore(key));
  }

  clearScrollPosition(key: string): void {
    this.clear(key);
  }

  observeLayoutShifts(_key: string): void {
    // Handled dynamically by restore
  }

  stopObserving(): void {
    this.stopRestoration();
  }

  clearAll(): void {
    this.cache.clear();
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
          if (k.startsWith('scroll_pos_')) sessionStorage.removeItem(k);
        });
      } catch (e) {}
    }
  }
}

let instance: ScrollManager | null = null;

export function getScrollManager(): ScrollManager {
  if (typeof window === 'undefined') {
    return new ScrollManager();
  }
  if (!instance) {
    instance = new ScrollManager();
  }
  return instance;
}

export default ScrollManager;



