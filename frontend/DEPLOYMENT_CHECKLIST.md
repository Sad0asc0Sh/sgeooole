# Scroll Restoration - Deployment Checklist

## ✅ Pre-Deployment Verification

Complete all items before deploying to production.

---

## 📋 Code Integration

- [x] `ScrollManager.ts` created in `src/lib/scroll/`
- [x] `useScrollRestoration.ts` hook created in `src/hooks/`
- [x] `ScrollRestorationProvider.tsx` created in `src/providers/`
- [x] Provider added to root `layout.tsx`
- [x] Hook integrated in `ProductsPageClient.tsx`
- [x] Disable hook added to `ProductDetailClient.tsx`
- [x] `data-scroll-anchor` attributes added to key elements

---

## 🧪 Functional Testing

### Desktop Testing

- [ ] Navigate /products → scroll 50% → click product → back button
  - **Expected**: Restores to 50% position
  - **Result**: _____________

- [ ] Navigate /products → scroll to bottom → click product → back button
  - **Expected**: Restores to bottom position
  - **Result**: _____________

- [ ] Navigate /products → /products?category=x (different URL)
  - **Expected**: New page starts at top
  - **Result**: _____________

- [ ] Click pagination from page 1 → page 2 → back button
  - **Expected**: Page 1 restores scroll position
  - **Result**: _____________

- [ ] Apply filter → back button
  - **Expected**: Restores to pre-filter state
  - **Result**: _____________

### Mobile Testing (Real Device or DevTools)

- [ ] iPhone Safari: Scroll → navigate → back
  - **Expected**: Instant restoration, no smooth scroll
  - **Result**: _____________

- [ ] Chrome Android: Scroll → navigate → back
  - **Expected**: Perfect restoration
  - **Result**: _____________

- [ ] Test with slow 3G network
  - **Expected**: Waits for images, then restores
  - **Result**: _____________

---

## 🔍 Browser Compatibility

Test in each browser:

- [ ] Chrome 120+ (Desktop)
  - **Status**: _____________

- [ ] Chrome Android
  - **Status**: _____________

- [ ] Safari 17+ (macOS)
  - **Status**: _____________

- [ ] Safari iOS 17+
  - **Status**: _____________

- [ ] Firefox 120+
  - **Status**: _____________

- [ ] Edge 120+
  - **Status**: _____________

---

## 🐛 Console Verification

### Check for Errors

Open browser console and verify:

- [ ] No JavaScript errors during scroll save
- [ ] No errors during scroll restore
- [ ] No `[ScrollManager]` errors
- [ ] No TypeScript compilation errors

### Verify SessionStorage

Run in console:
```javascript
Object.keys(sessionStorage).filter(k => k.startsWith('scroll_'))
```

- [ ] Scroll positions are being saved
- [ ] Keys contain correct pathname
- [ ] Data structure includes: `{ y, timestamp, url, layoutHash }`

---

## 📊 Performance Checks

### Lighthouse Audit

Run Lighthouse on `/products`:

- [ ] Performance score: > 90
- [ ] CLS (Cumulative Layout Shift): < 0.1
- [ ] No TBT increase from scroll system
- [ ] First Contentful Paint: No regression

### Memory Profiling

1. Open DevTools → Memory tab
2. Navigate between pages 20 times
3. Take heap snapshot

- [ ] No memory leaks detected
- [ ] ScrollManager instances properly cleaned up
- [ ] SessionStorage size reasonable (< 50KB)

---

## 🔧 Edge Case Testing

### Advanced Scenarios

- [ ] Rapid back/forward (click back 5x quickly)
  - **Expected**: No race conditions, correct restoration
  - **Result**: _____________

- [ ] Navigate away, wait 5 minutes, click back
  - **Expected**: Still restores (30min cache)
  - **Result**: _____________

- [ ] Test with very tall page (>10,000px scroll)
  - **Expected**: Handles large positions correctly
  - **Result**: _____________

- [ ] Test with lazy-loaded images
  - **Expected**: Waits for images before restore
  - **Result**: _____________

- [ ] Test with ad blockers enabled
  - **Expected**: Works normally
  - **Result**: _____________

- [ ] Test in private/incognito mode
  - **Expected**: Works (sessionStorage available)
  - **Result**: _____________

---

## 📱 Mobile-Specific Tests

### iOS Safari

- [ ] Test with bottom toolbar showing/hiding
  - **Expected**: Scroll position accounts for toolbar
  - **Result**: _____________

- [ ] Test momentum scrolling
  - **Expected**: Position saved after scroll stops
  - **Result**: _____________

- [ ] Test pull-to-refresh gesture
  - **Expected**: Doesn't interfere with restoration
  - **Result**: _____________

### Android Chrome

- [ ] Test with URL bar showing/hiding
  - **Expected**: Correct restoration
  - **Result**: _____________

- [ ] Test system back button
  - **Expected**: Same as browser back
  - **Result**: _____________

---

## 🏗️ Build Verification

### Development Build

```bash
cd frontend
pnpm run dev
```

- [ ] Dev server starts without errors
- [ ] Hot reload works correctly
- [ ] No TypeScript errors in terminal

### Production Build

```bash
cd frontend
pnpm run build
```

- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] Bundle size reasonable (check increase)
- [ ] Tree-shaking works (unused code removed)

### Production Preview

```bash
pnpm run start
```

- [ ] Production build runs correctly
- [ ] Scroll restoration works same as dev
- [ ] No console errors in production mode

---

## 📈 Monitoring Setup

### Analytics (Optional)

Consider tracking:

- [ ] Scroll restoration success rate
- [ ] Average restoration time
- [ ] Layout change detection frequency
- [ ] Browser compatibility issues

### Error Tracking

If using Sentry/Datadog/etc:

- [ ] Add custom error handling for ScrollManager
- [ ] Track restoration failures
- [ ] Monitor sessionStorage quota errors

---

## 🚀 Deployment Steps

### Pre-Deploy

- [ ] All tests above passed
- [ ] Code reviewed by team
- [ ] Documentation updated
- [ ] Changelog updated

### Deploy

- [ ] Deploy to staging environment
- [ ] Smoke test on staging (5 min test)
- [ ] Deploy to production

### Post-Deploy

- [ ] Monitor error rates (first 24h)
- [ ] Check user feedback/support tickets
- [ ] Verify analytics (if tracking)
- [ ] No rollback needed ✅

---

## 🐞 Known Issues & Limitations

Document any known issues here:

1. **Page Refresh**: Scroll positions NOT restored after refresh (by design)
2. **Cross-Tab**: Positions are per-tab, not shared across tabs
3. **Incognito**: May not work if sessionStorage is completely blocked
4. _____________
5. _____________

---

## 📞 Support Contacts

If issues arise:

- **Documentation**: See `frontend/src/lib/scroll/README.md`
- **Testing Guide**: See `frontend/src/lib/scroll/scrollRestoration.test.md`
- **Implementation**: See `SCROLL_RESTORATION_IMPLEMENTATION.md`

---

## ✅ Final Sign-Off

**Tested By**: _________________
**Date**: _________________
**Environment**: [ ] Dev [ ] Staging [ ] Production

**Status**: 
- [ ] ✅ Ready for Production
- [ ] ⚠️ Needs Minor Fixes
- [ ] ❌ Blocked

**Notes**:
_____________________________________________
_____________________________________________
_____________________________________________

---

## 🎉 Deployment Complete!

Once all items checked:

✅ Scroll restoration is production-ready
✅ Mobile UX bug is fixed
✅ Users will have seamless back navigation

**Ship it!** 🚀
