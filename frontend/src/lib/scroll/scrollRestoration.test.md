# Scroll Restoration Testing Guide

## Manual Testing Scenarios

### Test 1: Basic Back Navigation

**Steps:**
1. Navigate to `/products`
2. Scroll down to approximately 50% of the page
3. Click on any product card
4. Wait for product detail page to load
5. Click browser back button

**Expected Result:**
- Page should restore to the exact scroll position (50% down)
- No jarring jump or flash
- Product grid should be visible at the same position

**Pass/Fail:** ___

---

### Test 2: Deep Scroll Restoration

**Steps:**
1. Navigate to `/products`
2. Scroll to the bottom of the page (footer visible)
3. Click on a product near the bottom
4. Click browser back button

**Expected Result:**
- Page should scroll to bottom, showing footer
- Previously clicked product should be visible in viewport

**Pass/Fail:** ___

---

### Test 3: Forward Navigation (No Restoration)

**Steps:**
1. Navigate to `/products`
2. Scroll down 50%
3. Navigate to `/products?category=electronics` (different URL)

**Expected Result:**
- New page should start at the top (Y=0)
- No scroll restoration should occur

**Pass/Fail:** ___

---

### Test 4: Lazy Loaded Images

**Steps:**
1. Navigate to `/products`
2. Scroll down slowly to trigger lazy loading
3. Scroll to position where lazy images are loading
4. Click on a product
5. Click back button

**Expected Result:**
- Page waits for images to load
- Scroll position is restored correctly
- No layout shift from late-loading images

**Pass/Fail:** ___

---

### Test 5: Pagination

**Steps:**
1. Navigate to `/products`
2. Scroll down 50%
3. Click "Next Page" button
4. Note: should scroll to top of page 2
5. Click browser back button

**Expected Result:**
- Page 1 should restore to 50% scroll position
- Page 2 navigation should have started at top

**Pass/Fail:** ___

---

### Test 6: Filter Changes

**Steps:**
1. Navigate to `/products`
2. Scroll down 50%
3. Apply a price filter
4. Note: should scroll to top with new results
5. Click browser back button

**Expected Result:**
- Original product list at 50% scroll position
- Filter state is reverted

**Pass/Fail:** ___

---

### Test 7: Mobile Viewport

**Steps:**
1. Open DevTools, set to iPhone 12 viewport (390x844)
2. Navigate to `/products`
3. Scroll down 70%
4. Tap on a product
5. Tap back button (or swipe back on real device)

**Expected Result:**
- Instant scroll restoration (no smooth scroll)
- Correct position restored
- No viewport flickering

**Pass/Fail:** ___

---

### Test 8: Rapid Back/Forward

**Steps:**
1. Navigate to `/products`, scroll to 30%
2. Click product A
3. Quickly click back
4. Quickly click forward
5. Click back again

**Expected Result:**
- Each back navigation restores scroll correctly
- No race conditions or incorrect positions

**Pass/Fail:** ___

---

### Test 9: Session Persistence

**Steps:**
1. Navigate to `/products`, scroll to 50%
2. Click product
3. Wait 5 minutes on product detail page
4. Click back

**Expected Result:**
- Scroll position still restored after 5 minutes
- No expiry (default is 30 minutes)

**Pass/Fail:** ___

---

### Test 10: Layout Changes

**Steps:**
1. Navigate to `/products` with 24 products loaded
2. Scroll to product #12
3. Click product #12
4. (Simulate: admin adds 10 new products to top of list)
5. Click back

**Expected Result:**
- If layout hash detects major change, may skip restoration (safe fallback)
- If minor change, scroll position adjusted appropriately
- No crash or error

**Pass/Fail:** ___

---

## Console Debugging

### Enable Debug Mode

In browser console:
```javascript
localStorage.setItem('debug_scroll', 'true');
```

### Check Saved Positions

```javascript
// View all saved scroll positions
Object.keys(sessionStorage)
  .filter(k => k.startsWith('scroll_'))
  .map(k => ({
    key: k,
    data: JSON.parse(sessionStorage.getItem(k))
  }));
```

### Manually Trigger Restore

```javascript
import { getScrollManager } from '@/lib/scroll/ScrollManager';
const manager = getScrollManager();
await manager.restoreScrollPosition('/products', true);
```

### Check Layout Hash

```javascript
// Inspect current layout hash
const anchors = document.querySelectorAll('[data-scroll-anchor]');
console.log('Scroll anchors:', anchors.length);
```

---

## Performance Testing

### Lighthouse Checks

1. Run Lighthouse on `/products`
2. Verify no CLS (Cumulative Layout Shift) warnings related to scroll
3. Check that scroll restoration doesn't block main thread

**Target Metrics:**
- CLS: < 0.1
- TBT (Total Blocking Time): No increase from scroll system

---

## Browser Compatibility Tests

Test in:
- [ ] Chrome 120+ (Desktop)
- [ ] Chrome Android (Mobile)
- [ ] Safari 17+ (Desktop)
- [ ] Safari iOS 17+ (Mobile)
- [ ] Firefox 120+
- [ ] Edge 120+

---

## Known Limitations

1. **Page Refresh**: Scroll positions are NOT restored after refresh (expected)
2. **Cross-tab**: Positions are per-tab (sessionStorage, not localStorage)
3. **Incognito**: May not work if sessionStorage is disabled
4. **Very Large Pages**: Pages with 10,000+ products may have slower restoration

---

## Automated Testing (Future)

### Playwright Test Example

```typescript
test('restores scroll position on back navigation', async ({ page }) => {
  await page.goto('/products');
  
  // Scroll to specific position
  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.waitForTimeout(200); // Wait for debounce
  
  // Click first product
  await page.click('[data-testid="product-card"]:first-child');
  await page.waitForURL(/\/product\/.*/);
  
  // Go back
  await page.goBack();
  await page.waitForTimeout(500); // Wait for restoration
  
  // Verify scroll position
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBeCloseTo(1000, -1); // Within 10px
});
```

---

## Regression Testing Checklist

After any changes to scroll system:

- [ ] Test 1: Basic Back Navigation
- [ ] Test 7: Mobile Viewport
- [ ] Test 8: Rapid Back/Forward
- [ ] Check browser console for errors
- [ ] Verify sessionStorage doesn't grow unbounded
- [ ] Test on production build (not just dev)

---

## Success Criteria

✅ **Core Functionality**
- Scroll position restores within 50px of original position
- Restoration completes within 500ms on average
- No visual jumps or layout shifts after restoration

✅ **Edge Cases**
- Works with lazy-loaded images
- Handles layout changes gracefully
- Doesn't break pagination or filters

✅ **Performance**
- No impact on page load time
- No memory leaks over extended session
- Clean cleanup on navigation

✅ **Mobile**
- Touch-friendly (no conflicts with swipe gestures)
- Works on iOS Safari
- Works on Chrome Android

---

## Report Issues

If any test fails, document:
1. Test number
2. Browser and version
3. Viewport size
4. Expected vs actual behavior
5. Console errors (if any)
6. Network conditions (fast/slow/offline)
