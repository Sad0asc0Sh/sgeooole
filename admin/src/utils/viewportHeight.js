/**
 * Real mobile viewport height helper.
 *
 * Problem: On mobile browsers `100vh` includes the area behind the URL /
 * navigation bars, so fixed-height app shells end up taller than the real
 * visible area and the bottom of the page hides under the browser chrome.
 *
 * Fix: publish the REAL usable height as the CSS custom property `--app-vh`
 * (equal to 1% of window.innerHeight) and consume it from CSS:
 *     height: calc(var(--app-vh, 1vh) * 100);
 * Browsers supporting dynamic viewports additionally get exact `100dvh`
 * through an @supports override in MainLayout.css.
 *
 * Usage: call once at startup → setupViewportHeight()
 */
let installed = false

export function setupViewportHeight() {
  if (installed || typeof window === 'undefined') return
  installed = true

  const apply = () => {
    const h = window.innerHeight
    if (h > 0) {
      document.documentElement.style.setProperty('--app-vh', `${h / 100}px`)
    }
  }

  apply()

  // Track rotation, browser-chrome show/hide and soft-nav events.
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', () => setTimeout(apply, 120))
  window.addEventListener('pageshow', apply)

  return apply
}

export default setupViewportHeight
