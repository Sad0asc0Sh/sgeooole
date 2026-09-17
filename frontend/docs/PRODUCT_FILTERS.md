# Product listing filters

All storefront category, brand and search entry points use `/products`.

## URL and API contract

| Storefront URL | API parameter | Meaning |
| --- | --- | --- |
| `category=cameras` | `category=cameras&includeChildren=true` | Category and descendants by default; explicit `includeChildren=false` selects only the category |
| `brand=a,b` | `brand=a,b` | Any selected brand, slug or ID |
| `prop_رنگ=آبی&prop_رنگ=قرمز` | `properties[رنگ]=آبی&properties[رنگ]=قرمز` | Any selected value for a property; different properties must all match |
| `minPrice=0&maxPrice=500000` | Same | Inclusive effective selling-price bounds in toman |
| `inStock=true` | Same | Positive stock, summing variants for variable products |
| `onSale=true` | Same | Effective displayed price below comparison price |
| `minRating=4` | Same | Rating at least 4 |
| `search=...` | Same | Literal Persian/Arabic-normalized name or SKU search |
| `sort=priceAsc&page=2` | Same plus `limit=24` | Stable price order and server pagination |

Prices, availability and discounts are evaluated before pagination and counting. Variable products use the minimum variant selling price and total variant stock. Direct product campaigns take precedence over category campaigns. Expired timed offers restore the base price. Existing `skipDiscount=true` admin calls keep raw product output.

The response preserves `success`, `data`, `pagination` and `priceRange`. The range respects other filters but excludes the price bounds themselves. Empty results preserve the existing minimum of one total page. Requests have a maximum limit of 100 and page of 100000. Malformed filter values return 400.

Filter changes reset the page. The URL is the committed state for refresh, sharing and browser navigation. Mobile choices apply immediately without closing the sheet; the results button closes it. Price inputs accept Persian/Arabic digits, validate bounds, and apply on submit. Clearing filters preserves search and sort. Individual chips remove only their own selection.

## Tests and verification

```bash
npm --prefix frontend run typecheck
```

```bash
npm --prefix frontend test -- --runInBand
```

```bash
npm --prefix ekgkala-backend test
```

Backend listing regression tests execute the emitted aggregation using the development-only `mingo` package and isolated fixtures. They cover effective prices, counts, pagination, variants, stock, properties, brands, expired deals, projection, validation and production query sanitizers. Category graph traversal/model access is mocked. These tests do **not** establish actual MongoDB execution or catalog-scale performance.

Browser verification was blocked by the preview tool's unavailable permission classifier during implementation. No production database or storefront data was modified. Real-browser desktop/mobile checks and execution against a local MongoDB fixture remain unverified.
