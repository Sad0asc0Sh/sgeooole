export default function ProductListingSkeleton() {
  return (
    <div className="animate-pulse" aria-label="در حال بارگذاری محصولات" aria-busy="true">
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-8">
        <aside className="lg:col-span-3 space-y-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-40 rounded-2xl border border-gray-100 bg-white" />
          ))}
        </aside>
        <div className="lg:col-span-9">
          <div className="mb-4 h-14 rounded-2xl border border-gray-100 bg-white" />
          <ProductGridSkeleton />
        </div>
      </div>
      <div className="lg:hidden">
        <div className="mb-4 h-10 w-44 rounded-xl bg-white" />
        <ProductGridSkeleton />
      </div>
      <span className="sr-only">در حال آماده‌سازی فهرست محصولات</span>
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="aspect-square bg-gray-100" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-4/5 rounded bg-gray-100" />
            <div className="h-3 w-3/5 rounded bg-gray-100" />
            <div className="h-5 w-2/5 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
