import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-white pb-24 pt-14 md:pt-0">
      {/* Mobile Skeleton */}
      <div className="lg:hidden">
        <div className="fixed top-0 left-0 w-full z-20 flex justify-between items-center p-4 md:hidden">
          <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
          <div className="flex gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="relative bg-gray-100 h-[380px] w-full animate-pulse" />
        <div className="px-4 py-6 -mt-6 relative bg-white rounded-t-3xl">
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4 animate-pulse" />
          <div className="h-12 bg-gray-100 rounded-xl mb-6 animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center mt-8 gap-3">
          <Loader2 className="animate-spin text-kala-500" size={32} />
          <span className="text-sm text-gray-500">در حال دریافت اطلاعات محصول...</span>
        </div>
      </div>

      {/* Desktop Skeleton */}
      <div className="hidden lg:block max-w-7xl mx-auto px-6 pb-8 mt-8">
        <div className="flex flex-row-reverse gap-10">
          {/* Right Column - Gallery Skeleton */}
          <div className="w-[45%] flex-shrink-0">
            <div className="sticky top-36">
              <div className="aspect-square bg-gray-100 rounded-2xl animate-pulse mb-4" />
              <div className="flex gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-20 h-20 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </div>

          {/* Left Column - Info Skeleton */}
          <div className="flex-1 min-w-0">
            {/* Breadcrumb */}
            <div className="flex gap-2 mb-6">
              <div className="w-16 h-4 bg-gray-100 rounded animate-pulse" />
              <div className="w-4 h-4 bg-gray-100 rounded animate-pulse" />
              <div className="w-24 h-4 bg-gray-100 rounded animate-pulse" />
            </div>

            {/* Title */}
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4 animate-pulse" />
            <div className="h-4 bg-gray-100 rounded w-1/2 mb-6 animate-pulse" />

            {/* Rating */}
            <div className="flex gap-2 mb-6">
              <div className="w-24 h-6 bg-gray-100 rounded animate-pulse" />
            </div>

            {/* Price Box */}
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
