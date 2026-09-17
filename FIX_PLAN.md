# Homepage repair plan

## Requested outcome
- Make best sellers and newest products responsive across mobile, laptop and large monitors.
- Share the same product-card design with timed and curated offers, preserving the storefront's Persian RTL, slate/navy and amber identity.
- Fix featured categories disappearing after transient data failures; make the category layout stable and responsive.

## Scope and implementation
1. **Shared product presentation**: `frontend/src/components/home/HomeProductCard.tsx`, `HomeProductRail.tsx`, `HomeProductRail.module.css`; integrate through existing `ProductRail.tsx`, `FlashOfferRail.tsx`, `SpecialOfferRail.tsx`, `ProductRailContainer.tsx`.
   - One bounded 1536px container and container-based Swiper breakpoints; no competing fixed slide width.
   - Shared square image, title, promotion, stock and price slots; existing pricing resolver and product URL builder.
   - Accessible instance-scoped navigation, RTL touch/scroll restoration, reduced motion.
2. **Promotion boundaries**: `frontend/src/hooks/usePromotionBoundary.ts`.
   - Re-render at successive expiry boundaries, not every second for the whole list.
   - Remove only expired curated products, not the entire section when its earliest item expires.
3. **Category resilience**: `frontend/src/app/page.tsx`, `frontend/src/components/home/CategoryRail.tsx`, `CategoryRail.module.css`, `frontend/src/services/categoryService.ts`.
   - Stable server cache keys; client SWR retry/revalidation using the dedicated public category endpoints.
   - Preserve successful data on transient errors; distinguish failure, loading and a genuinely empty response.
   - No automatic horizontal scrolling; mobile scroll snapping and fluid desktop grid; image fallback.
4. **Containment and tests**: `frontend/src/components/home/HomeSection.tsx`, targeted Jest tests in `frontend/__tests__`.

## Verification gates
- Typecheck and focused lint on changed files.
- Regression tests: card price/expiry display, successive timer boundaries, shared rail integration, category loading/retry/stale-data/empty behavior, curated item expiry.
- Launch actual Next app through Browser preview; verify one homepage before further visual adjustments.
- Browser checks at 320/375/768/1024/1440/1920px and a constrained container: no document overflow, readable price/title, consistent cards, working RTL arrows and category recovery.
- If local API is unavailable, keep fixture testing isolated from production code and disclose that real backend data was not verified.

## Current status
- Existing homepage, rail DOM, pricing resolver, image frame, promotion components and global layout constraints inspected.
- Shared card/rail implemented and imported by all four existing product sections; not yet browser-verified.
- Category recovery, stable server URLs, nullable failure state, responsive grid/scroll, and legacy string-image support implemented.
- Product sections preserve cached data on refresh errors and retry locally; disabled newest/best-seller hooks no longer fetch with limit zero.
- Verification complete: production build succeeds; TypeScript succeeds; targeted ESLint reports zero warnings/errors; git diff whitespace check succeeds.
- Full frontend Jest suite: 18 suites and 51 tests pass, including 12 new regressions. Existing ProductCard mock-image DOM warnings remain unchanged.
- Fixed Jest stylesheet mapper ordering and Swiper CSS mapping so homepage components can be tested.
- Browser preview launch repeatedly blocked by temporary permission-classifier service unavailability. No permission bypass attempted. Actual screenshot, responsive geometry and interaction verification remain blocked; no claim of visual verification is made.
- Local default API port 5000 was unavailable; live backend behavior was not verified. No backend code, database, commits or deployment changed.
