export default function Loading() {
  return (
    <div className="min-h-screen bg-white pb-24 pt-14 md:pt-0">
      {/* Mobile Skeleton */}
      <div className="lg:hidden">
        {/* Header placeholder (matches mobile header space) */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
              <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        {/* Gallery skeleton: mirrors ProductGallery mobile wrapper */}
        <div className="w-full max-w-full min-w-0 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col flex-1 min-h-0 h-full">
          <div className="relative w-full max-w-full aspect-[4/3] max-h-[45vh] supports-[height:100dvh]:max-h-[45dvh] [@media(pointer:coarse)]:max-h-[42svh] min-h-0 min-w-0 overflow-hidden bg-white">
            <div className="absolute inset-0 min-h-0 min-w-0 max-w-full overflow-hidden bg-gray-100 animate-pulse" />
          </div>
          <div className="shrink-0 min-w-0 flex gap-2 px-4 overflow-x-auto no-scrollbar pt-2 pb-3 justify-center bg-white">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 animate-pulse flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Info Section - mirrors ProductDetailClient mobile spacing */}
        <div className="px-4 py-2 relative bg-white z-10">
          <div className="space-y-1.5 mb-2">
            <div className="h-3 w-4/5 rounded bg-gray-100 animate-pulse" />
            <div className="h-3 w-3/5 rounded bg-gray-100 animate-pulse" />
          </div>

          <div className="flex justify-between items-start mb-1">
            <div className="flex flex-col w-full">
              <div className="h-6 bg-gray-200 rounded w-11/12 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-2/3 animate-pulse" />
            </div>
          </div>

          <div className="mb-4">
            <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
          </div>

          <div className="flex items-center gap-1 mb-4">
            <div className="w-28 h-4 bg-gray-100 rounded animate-pulse" />
          </div>

          <div className="h-10 rounded-lg bg-gray-100 mb-6 animate-pulse" />
          <hr className="border-gray-100 mb-6" />

          <div className="h-16 rounded-xl bg-gray-100 mb-6 animate-pulse" />

          <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-6">
            <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
            <div className="h-px bg-gray-200 w-full" />
            <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
          </div>

          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>

        {/* Sticky action bar placeholder */}
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 p-3">
          <div className="h-11 rounded-xl bg-gray-200 animate-pulse" />
        </div>
      </div>

      {/* Desktop Skeleton */}
      <div className="hidden lg:block max-w-7xl mx-auto px-6 pb-8 pt-8">
        <div className="flex flex-row-reverse gap-10 min-w-0">
          {/* Right Column - Gallery Skeleton */}
          <div className="w-[45%] max-w-[45%] min-w-0 flex-shrink self-start sticky top-36 will-change-transform flex flex-col max-h-[calc(100vh-theme(spacing.36)-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-theme(spacing.36)-2rem)] [@media(pointer:coarse)]:max-h-[calc(100svh-theme(spacing.36)-2.5rem)]">
            <div className="w-full max-w-full min-w-0 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col flex-1 min-h-0 h-full">
              <div className="relative w-full max-w-full aspect-[4/3] max-h-[45vh] supports-[height:100dvh]:max-h-[45dvh] [@media(pointer:coarse)]:max-h-[42svh] md:aspect-square md:max-h-none [@media(pointer:coarse)]:md:max-h-[42svh] min-h-0 min-w-0 overflow-hidden bg-white">
                <div className="absolute inset-0 min-h-0 min-w-0 max-w-full overflow-hidden bg-gray-100 animate-pulse" />
              </div>
              <div className="shrink-0 min-w-0 flex gap-2 lg:gap-2 px-4 overflow-x-auto no-scrollbar pt-2 pb-3 lg:pb-4 justify-center bg-white">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-12 h-12 lg:w-14 lg:h-14 bg-gray-100 rounded-lg border border-gray-200 animate-pulse flex-shrink-0" />
                ))}
              </div>
            </div>

            {/* Breadcrumb and title in same right column, matching live layout */}
            <div className="shrink-0 space-y-1.5 mt-5">
              <div className="h-4 w-4/5 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-3/5 rounded bg-gray-100 animate-pulse" />
            </div>
            <div className="shrink-0 mt-4">
              <div className="h-8 bg-gray-200 rounded w-11/12 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-2/3 animate-pulse" />
            </div>
          </div>

          {/* Left Column - Info Skeleton */}
          <div className="flex-1 min-w-0">
            {/* Rating */}
            <div className="flex gap-2 mb-6">
              <div className="w-28 h-6 bg-gray-100 rounded animate-pulse" />
            </div>

            {/* Timer / campaign card placeholder */}
            <div className="mb-6">
              <div className="h-[62px] p-4 rounded-xl bg-gray-100 animate-pulse" />
            </div>

            {/* Social actions placeholder */}
            <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
            <hr className="border-gray-100 my-6" />

            {/* Color selector placeholder */}
            <div className="h-20 rounded-xl bg-gray-100 mb-6 animate-pulse" />

            {/* Features */}
            <div className="bg-gray-50 rounded-xl p-5 space-y-4 mb-6">
              <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
              <div className="h-px bg-gray-200 w-full" />
              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
            </div>

            {/* Desktop Price & Add to Cart Box */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
              <div className="flex justify-between items-center mb-6">
                <div className="w-32 h-8 bg-gray-200 rounded animate-pulse" />
                <div className="w-24 h-6 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="w-full h-12 bg-gray-200 rounded-xl animate-pulse" />
            </div>

            {/* Tabs Skeleton */}
            <div className="space-y-4">
              <div className="flex gap-8 border-b border-gray-200 pb-4">
                <div className="w-24 h-6 bg-gray-200 rounded animate-pulse" />
                <div className="w-24 h-6 bg-gray-100 rounded animate-pulse" />
                <div className="w-24 h-6 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="space-y-3 pt-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
