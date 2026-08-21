export const PRODUCT_LISTING_CACHE_POLICY = {
  staleTime: 60 * 1000,
  gcTime: 5 * 60 * 1000,
} as const;

type ProductListingReadinessInput = {
  hasData: boolean;
  isValidating: boolean;
  isStale: boolean;
  hasError: boolean;
};

export function getProductListingReadiness({
  hasData,
  isValidating,
  isStale,
  hasError,
}: ProductListingReadinessInput) {
  const isReady = hasData && !isValidating && !isStale && !hasError;

  return {
    isReady,
    showSkeleton: !isReady && !hasError,
    showError: hasError,
  };
}
