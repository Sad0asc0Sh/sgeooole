# URL Handling Architecture & DEP0169 Compliance

## Overview

This document outlines the URL handling architecture for the frontend application, ensuring compliance with Node.js deprecation warning DEP0169 (`url.parse()` is deprecated).

## Architecture Principles

### 1. Server-Side Rendering (SSR) Safety

**Rule**: Server Components and SSR code paths MUST use the WHATWG URL API exclusively.

- ✅ Use `new URL()` for URL parsing
- ✅ Use `URLSearchParams` for query string handling
- ✅ Use native `fetch()` for HTTP requests
- ❌ NEVER use `url.parse()` from Node.js `url` module
- ❌ NEVER import axios directly in Server Components

### 2. Type Import Patterns

**For Server Components (SSR-safe)**:
```typescript
// ✅ CORRECT - Import types from SSR-safe types file
import type { Product, ProductColor } from "@/types/product";
```

**For Client Components**:
```typescript
// ✅ CORRECT - Can import from productService (has "use client")
import { Product, productService } from "@/services/productService";

// ✅ ALSO CORRECT - Import from types file
import type { Product } from "@/types/product";
```

### 3. Data Fetching Patterns

**Server Components (SSR)** - Use `productData.ts`:
```typescript
// ✅ CORRECT - Uses native fetch, SSR-safe
import { fetchProductById, fetchRelatedProducts } from "@/lib/productData";

const product = await fetchProductById(id);
```

**Client Components** - Can use `productService.ts`:
```typescript
// ✅ CORRECT - productService is marked "use client"
import { productService } from "@/services/productService";

const products = await productService.getProducts({ limit: 10 });
```

## File Structure

```
src/
├── types/
│   └── product.ts          # SSR-safe type definitions ONLY (no runtime deps)
├── lib/
│   ├── productData.ts      # SSR-safe product fetching (uses native fetch)
│   ├── paths.ts            # URL building utilities (SSR-safe)
│   └── api.ts              # Axios instance (CLIENT-ONLY)
├── services/
│   └── productService.ts   # Client-side API wrapper ("use client" directive)
```

## Key Files

### `src/types/product.ts`
- Contains ONLY type/interface definitions
- NO runtime dependencies
- Safe to import anywhere (Server or Client)

### `src/lib/productData.ts`
- Uses native `fetch()` for HTTP requests
- React `cache()` for request deduplication
- Safe for Server Components and SSR
- DOES NOT import axios

### `src/services/productService.ts`
- Marked with `"use client"` directive
- Uses axios for HTTP requests
- ONLY for Client Components
- Re-exports types from `@/types/product` for backward compatibility

## Dependency Considerations

### Axios
Axios (even v1.13.2) may internally use `url.parse()`. This is acceptable in Client Components but MUST NOT execute during SSR.

**Mitigation**: `productService.ts` is marked with `"use client"` to prevent axios from being bundled in Server Components.

## Verification Checklist

Before deploying, verify:

- [ ] No `url.parse()` in project code (`grep -r "url.parse"`)
- [ ] No `require('url')` or `from 'url'` in Server Components
- [ ] Server Components only import from `@/types/product` or `@/lib/productData`
- [ ] `productService.ts` has `"use client"` directive at top
- [ ] Build completes without deprecation warnings

## ESLint Rule (Recommended)

Add this custom rule to prevent future regressions:

```javascript
// eslint-plugin-local-rules/no-url-parse.js
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow usage of deprecated url.parse()"
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.name === "url" &&
          node.callee.property.name === "parse"
        ) {
          context.report({
            node,
            message: "url.parse() is deprecated (DEP0169). Use new URL() instead."
          });
        }
      }
    };
  }
};
```

## Related Node.js Deprecation

- **DEP0169**: `url.parse()` behavior is not standardized
- **Affected**: Node.js 22+
- **Solution**: Use WHATWG URL API (`new URL()`, `URLSearchParams`)

## References

- [Node.js DEP0169](https://nodejs.org/api/deprecations.html#DEP0169)
- [WHATWG URL Standard](https://url.spec.whatwg.org/)
- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
