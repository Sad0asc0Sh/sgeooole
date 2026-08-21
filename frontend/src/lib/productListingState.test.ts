import { getProductListingReadiness } from "./productListingState";

describe("getProductListingReadiness", () => {
  it("marks fresh, settled data as ready", () => {
    expect(
      getProductListingReadiness({
        hasData: true,
        isValidating: false,
        isStale: false,
        hasError: false,
      }),
    ).toEqual({ isReady: true, showSkeleton: false, showError: false });
  });

  it("keeps cached data behind a skeleton while it is stale and revalidating", () => {
    expect(
      getProductListingReadiness({
        hasData: true,
        isValidating: true,
        isStale: true,
        hasError: false,
      }),
    ).toEqual({ isReady: false, showSkeleton: true, showError: false });
  });

  it("uses a skeleton for an initial request with no cached data", () => {
    expect(
      getProductListingReadiness({
        hasData: false,
        isValidating: true,
        isStale: false,
        hasError: false,
      }),
    ).toEqual({ isReady: false, showSkeleton: true, showError: false });
  });

  it("does not display stale content as ready after a failed revalidation", () => {
    expect(
      getProductListingReadiness({
        hasData: true,
        isValidating: false,
        isStale: true,
        hasError: true,
      }),
    ).toEqual({ isReady: false, showSkeleton: false, showError: true });
  });
});
