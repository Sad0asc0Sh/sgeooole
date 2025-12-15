import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-white pb-24">
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
        <Loader2 className="animate-spin text-vita-500" size={32} />
        <span className="text-sm text-gray-500">در حال دریافت اطلاعات محصول...</span>
      </div>
    </div>
  );
}
