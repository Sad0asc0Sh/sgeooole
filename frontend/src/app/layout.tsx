import type { Metadata, Viewport } from "next";
import { iransans } from "@/lib/fonts";
import "./globals.css";
import "./legacy-compat.generated.css"; // old-browser safety net (all rules are @supports-guarded)
import ClientLayout from "@/components/layout/ClientLayout";
import GoogleAuthProvider from "@/components/providers/GoogleAuthProvider";
import ThirdPartyScripts from "@/components/ThirdPartyScripts";
import ScrollRestorationProvider from "@/providers/ScrollRestorationProvider";
import SWRProvider from "@/providers/SWRProvider";
import LayoutStateProvider from "@/providers/LayoutStateProvider";
import RouteLoadingProvider from "@/providers/RouteLoadingProvider";

/*
 * CSS resilience net (2026-10, unstyled-homepage incident).
 *
 * The page must never render as raw HTML when the external Tailwind bundle
 * fails to apply — and that bundle CAN fail independently of the HTML:
 * the origin intermittently answered the main /_next/static/*.css requests
 * with plain-text 500s (and one chunk as a 1-byte empty 200) while the
 * homepage HTML kept serving 200 from the ISR cache, so real visitors got
 * exactly the screenshot: both header variants stacked, giant logo,
 * default purple links. Slow/interrupted downloads and engines that drop
 * Tailwind v4's @layer rules end at the same screen.
 *
 * Two in-page defences, both dependency-free and inert when healthy:
 *
 * 1) CRITICAL_CSS — a tiny UNLAYERED <style> block. Unlayered author CSS
 *    outranks Tailwind's layered utilities in the cascade, so every rule
 *    here must only restate what the design already assumes globally
 *    (preflight semantics / the Logo size contract) — never compete with
 *    utilities. It deliberately does NOT style links or define `.hidden`:
 *    link colour utilities must keep winning, and the watchdog below uses
 *    `.hidden` as its Tailwind-applied sentinel.
 *    The header-variant rules mirror Header.tsx's own Tailwind classes
 *    (md = 48rem): below md only the mobile header shows, from md up only
 *    the desktop one — so even with zero external CSS exactly one header
 *    renders, at the right size.
 *
 * 2) CSS_WATCHDOG — an ES5 inline script. After window load it probes
 *    whether a Tailwind utility actually applied (sentinel element with
 *    class `hidden` must compute to display:none). If not, it re-requests
 *    every /_next/static stylesheet once with a cache-busting query
 *    (intermittent 500s and stale caches usually succeed on retry); if the
 *    page is still unstyled after that, it reloads the page at most once
 *    per 10 minutes (sessionStorage guard — no reload loops). With JS
 *    disabled, CRITICAL_CSS alone still keeps the page presentable.
 *
 * Keep both blocks small and in sync with cssResilience.test.ts.
 */
const CRITICAL_CSS = [
  "body{margin:0;background:#faf9f7;color:#1c1917;font-family:'IRANSans',Tahoma,system-ui,sans-serif}",
  "*,*::before,*::after{box-sizing:border-box}",
  '[data-header-variant="desktop"]{display:none}',
  '@media (min-width:48rem){[data-header-variant="mobile"]{display:none}[data-header-variant="desktop"]{display:block}}',
  "[data-header-variant] img{height:2.5rem;width:auto}",
  "@media (min-width:48rem){[data-header-variant] img{height:3.5rem}}",
].join("\n");

const CSS_WATCHDOG = [
  "(function(){",
  "  var KEY='ekgCssHealV1';",
  "  function applied(){",
  "    try{",
  "      var d=document.createElement('div');",
  "      d.className='hidden';",
  "      document.body.appendChild(d);",
  "      var ok=window.getComputedStyle(d).display==='none';",
  "      d.parentNode.removeChild(d);",
  "      return ok;",
  "    }catch(e){return true}",
  "  }",
  "  function heal(){",
  "    if(!document.body||applied())return;",
  "    var links=document.querySelectorAll('link[rel=\"stylesheet\"][href*=\"/_next/static/\"]');",
  "    var retried=0;",
  "    for(var i=0;i<links.length;i++){",
  "      var href=links[i].href;",
  "      if(href.indexOf('__cssretry')===-1){",
  "        links[i].href=href+(href.indexOf('?')===-1?'?':'&')+'__cssretry='+new Date().getTime();",
  "        retried++;",
  "      }",
  "    }",
  "    setTimeout(function(){",
  "      if(applied())return;",
  "      try{",
  "        var last=+sessionStorage.getItem(KEY)||0;",
  "        if(new Date().getTime()-last<600000)return;",
  "        sessionStorage.setItem(KEY,''+new Date().getTime());",
  "      }catch(e){return}",
  "      window.location.reload();",
  "    },retried?2500:0);",
  "  }",
  "  if(document.readyState==='complete'){setTimeout(heal,800)}",
  "  else{window.addEventListener('load',function(){setTimeout(heal,800)})}",
  "})();",
].join("\n");

// Parspack Cloud Storage — DNS preconnect
const PARSPACK_ENDPOINT =
  process.env.NEXT_PUBLIC_PARSPACK_ENDPOINT ||
  "https://c258565.parspack.net";

export const viewport: Viewport = {
  themeColor: "#f59e0b",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: (() => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL;
    if (!raw) return new URL("https://www.ekgkala.ir");

    try {
      return new URL(raw);
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[metadata] Invalid NEXT_PUBLIC_SITE_URL: ${raw}`);
      } else {
        console.warn(
          "[metadata] Invalid NEXT_PUBLIC_SITE_URL; falling back to default"
        );
      }
      return new URL("https://www.ekgkala.ir");
    }
  })(),
  alternates: {
    canonical: "./",
  },
  title: {
    default: "ای کا جی کالا | ekgkala | فروشگاه اینترنتی",
    template: "%s | ای کا جی کالا",
  },
  description:
    "ای کا جی کالا (ekgkala)؛ فروشگاه اینترنتی با پیشنهادهای ویژه، قیمت مناسب، تحویل سریع و تجربه خرید روان.",
  keywords: [
    "ای کا جی کالا",
    "ekgkala",
    "ای‌کا‌جی‌کالا",
    "EKG KALA",
    "ای کا جی کالا فروشگاه",
    "فروشگاه اینترنتی ای کا جی کالا",
    "خرید آنلاین",
    "فروشگاه اینترنتی",
  ],
  openGraph: {
    title: "ای کا جی کالا | ekgkala | فروشگاه اینترنتی",
    description:
      "ای کا جی کالا (ekgkala)؛ فروشگاه اینترنتی با پیشنهادهای ویژه، قیمت مناسب و تحویل سریع.",
    url: "./",
    siteName: "ای کا جی کالا",
    locale: "fa_IR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ای کا جی کالا | ekgkala | فروشگاه اینترنتی",
    description:
      "ای کا جی کالا (ekgkala)؛ فروشگاه اینترنتی با پیشنهادهای ویژه، قیمت مناسب و تحویل سریع.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    enamad: "46480007",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "ای کا جی کالا",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={iransans.variable}>
      <head>
        {/* Parspack Storage DNS Prefetch & Preconnect for LCP optimization */}
        <link
          rel="dns-prefetch"
          href={PARSPACK_ENDPOINT}
        />
        <link
          rel="preconnect"
          href={PARSPACK_ENDPOINT}
          crossOrigin="anonymous"
        />
        {/* Second preconnect without crossorigin for non-CORS image fetches */}
        <link
          rel="preconnect"
          href={PARSPACK_ENDPOINT}
        />
        {/* CSS resilience net — see the CRITICAL_CSS / CSS_WATCHDOG note above.
            Inert when the Tailwind bundle loads normally. */}
        <style
          id="ekg-critical-css"
          dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }}
        />
        <script
          id="ekg-css-watchdog"
          dangerouslySetInnerHTML={{ __html: CSS_WATCHDOG }}
        />
      </head>
      <body
        className={`font-sans antialiased bg-ekg-50 text-ekg-900 ${iransans.className}`}
      >
        <GoogleAuthProvider>
          <SWRProvider>
            <ScrollRestorationProvider>
              <LayoutStateProvider>
                {/*
                  Phase 2 SEO: intentionally NO Suspense around the whole app here.
                  RouteLoadingProvider isolates its own useSearchParams() inside an
                  inner boundary. A page-level Suspense here would silently turn any
                  future unsuspended useSearchParams() into a site-wide CSR shell
                  (the deindex-era bug) — we want the build to fail loudly instead.

                  Soft-404 fix (2026-10): there is intentionally NO root
                  app/loading.tsx either (and none in product/[...segments]).
                  A loading fallback starts streaming the response with HTTP
                  200 before the page can call notFound(), and once headers
                  are sent the status can never become 404 — every unknown
                  URL was a soft-404 despite rendering the 404 page (see the
                  Next.js docs, loading file convention → Status Codes).
                  RouteLoadingProvider's progress bar is the global loading
                  UI instead. Do not re-add a root/PDP loading.tsx without
                  re-checking unknown-URL status codes with curl.
                */}
                <RouteLoadingProvider>
                  <ClientLayout>{children}</ClientLayout>
                </RouteLoadingProvider>
              </LayoutStateProvider>
            </ScrollRestorationProvider>
          </SWRProvider>
        </GoogleAuthProvider>
        <ThirdPartyScripts />
      </body>
    </html>
  );
}
