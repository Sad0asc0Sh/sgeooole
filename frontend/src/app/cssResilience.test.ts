/**
 * CSS resilience contract (layout.tsx + Header.tsx + scripts).
 *
 * Incident (2026-10-17, user screenshot): the homepage rendered as raw
 * unstyled HTML — both header variants stacked, giant logo, default
 * purple links — because the origin intermittently answered the main
 * /_next/static/*.css requests with plain-text 500s (and one chunk as a
 * 1-byte empty 200) while the HTML itself kept serving 200 from the ISR
 * cache. Slow/interrupted stylesheet downloads and engines that drop
 * Tailwind v4's @layer rules land on the identical screen.
 *
 * The defence pinned here (see the long note in layout.tsx):
 *  1. A tiny UNLAYERED critical <style> in the root layout restates only
 *     preflight-level semantics and the header-variant contract, so the
 *     page stays presentable with zero external CSS. Because unlayered
 *     CSS outranks Tailwind's layers, it must NEVER style links or define
 *     `.hidden` (utilities must keep winning; `.hidden` is the watchdog's
 *     sentinel).
 *  2. An ES5 inline watchdog probes the `.hidden` sentinel after load,
 *     retries every /_next/static stylesheet once with a cache-busting
 *     query, and — only if still unstyled — reloads at most once per
 *     10 minutes (sessionStorage guard).
 *  3. Header.tsx carries data-header-variant="mobile|desktop" hooks the
 *     critical CSS keys on (md breakpoint = 48rem, matching Tailwind).
 *  4. scripts/audit-live-assets.mjs + `pnpm audit:live` verify the
 *     DEPLOYED bundle after every deploy (the gap that let the incident
 *     ship unnoticed).
 *  5. Sadra's legacy-compat colour safety net stays imported alongside.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

const layoutTsx = read("layout.tsx");
const headerTsx = read("../components/layout/Header.tsx");
const packageJson = read("../../package.json");

/** The CRITICAL_CSS array literal from layout.tsx, joined for assertions. */
const criticalCssMatch = layoutTsx.match(/const CRITICAL_CSS = \[([\s\S]*?)\]\.join/);
const criticalCss = criticalCssMatch ? criticalCssMatch[1] : "";

describe("critical fallback CSS", () => {
  it("is defined and rendered as an unlayered inline <style> in the root layout", () => {
    expect(criticalCssMatch).not.toBeNull();
    expect(layoutTsx).toContain('id="ekg-critical-css"');
    expect(layoutTsx).toContain("CRITICAL_CSS");
    // must stay unlayered so it applies even when an engine drops @layer
    expect(criticalCss).not.toContain("@layer");
  });

  it("restates the preflight-level body contract (margin 0, ekg-50 bg, ekg-900 text)", () => {
    expect(criticalCss).toContain("body{margin:0");
    expect(criticalCss).toContain("background:#faf9f7");
    expect(criticalCss).toContain("color:#1c1917");
    expect(criticalCss).toContain("box-sizing:border-box");
  });

  it("enforces exactly one header variant per width at the md (48rem) breakpoint", () => {
    expect(criticalCss).toContain('[data-header-variant="desktop"]{display:none}');
    expect(criticalCss).toContain("@media (min-width:48rem)");
    expect(criticalCss).toContain('[data-header-variant="mobile"]{display:none}');
    expect(criticalCss).toContain('[data-header-variant="desktop"]{display:block}');
  });

  it("bounds the header logo to the Logo size contract (h-10 mobile, md:h-14)", () => {
    expect(criticalCss).toContain("[data-header-variant] img{height:2.5rem;width:auto}");
    expect(criticalCss).toContain("[data-header-variant] img{height:3.5rem}");
  });

  it("never competes with Tailwind utilities: no link styling, no .hidden rule", () => {
    // unlayered rules beat layered utilities in the cascade — styling `a`
    // here would strip every text-colour utility from links site-wide.
    expect(criticalCss).not.toMatch(/(^|["'\s])a\{/);
    // `.hidden` is the watchdog's Tailwind-applied sentinel; defining it
    // here would make a broken page look healthy to the probe.
    expect(criticalCss).not.toContain(".hidden");
  });
});

describe("Header variant hooks", () => {
  it("tags the mobile and desktop header wrappers for the critical CSS", () => {
    expect(headerTsx).toContain('data-header-variant="mobile"');
    expect(headerTsx).toContain('data-header-variant="desktop"');
    // the hooks must sit on the same elements that carry the Tailwind
    // responsive classes, so both mechanisms always agree
    expect(headerTsx).toMatch(/data-header-variant="mobile" className="md:hidden/);
    expect(headerTsx).toMatch(/data-header-variant="desktop" className="hidden md:block"/);
  });
});

describe("stylesheet watchdog", () => {
  it("is rendered inline in the root layout", () => {
    expect(layoutTsx).toContain('id="ekg-css-watchdog"');
    expect(layoutTsx).toContain("CSS_WATCHDOG");
  });

  it("probes Tailwind with the .hidden sentinel via getComputedStyle", () => {
    expect(layoutTsx).toContain("d.className='hidden'");
    expect(layoutTsx).toContain("getComputedStyle");
    expect(layoutTsx).toContain(".display==='none'");
  });

  it("retries every /_next/static stylesheet once with a cache-busting query", () => {
    expect(layoutTsx).toContain('link[rel=\\"stylesheet\\"][href*=\\"/_next/static/\\"]');
    expect(layoutTsx).toContain("__cssretry");
  });

  it("reloads at most once per 10 minutes (sessionStorage guard, no loops)", () => {
    expect(layoutTsx).toContain("sessionStorage");
    expect(layoutTsx).toContain("ekgCssHealV1");
    expect(layoutTsx).toContain("600000");
    expect(layoutTsx).toContain("window.location.reload()");
  });

  it("stays ES5 so the old engines it protects can run it", () => {
    const watchdogMatch = layoutTsx.match(/const CSS_WATCHDOG = \[([\s\S]*?)\]\.join/);
    expect(watchdogMatch).not.toBeNull();
    const watchdog = watchdogMatch ? watchdogMatch[1] : "";
    expect(watchdog).not.toContain("=>");
    expect(watchdog).not.toMatch(/\bconst\b|\blet\b/);
  });
});

describe("legacy colour safety net (existing work, must not regress)", () => {
  it("layout still imports globals.css and legacy-compat.generated.css", () => {
    expect(layoutTsx).toContain('import "./globals.css"');
    expect(layoutTsx).toContain('import "./legacy-compat.generated.css"');
  });
});

describe("live deploy audit", () => {
  it("ships scripts/audit-live-assets.mjs and wires it as `pnpm audit:live`", () => {
    expect(existsSync(join(__dirname, "../../scripts/audit-live-assets.mjs"))).toBe(true);
    expect(packageJson).toContain('"audit:live": "node scripts/audit-live-assets.mjs"');
    const script = read("../../scripts/audit-live-assets.mjs");
    // the two incident signatures: non-200 status and the <2-byte empty chunk
    expect(script).toContain("/_next/static/");
    expect(script).toContain("bytes >= 2");
  });
});
