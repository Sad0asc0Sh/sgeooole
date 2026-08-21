import ProductListingSkeleton from "@/components/product/ProductListingSkeleton";

export default function ProductsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-20 pt-6 lg:pb-8">
      <div className="mx-auto max-w-[1440px]">
        <ProductListingSkeleton />
      </div>
    </div>
  );
}
