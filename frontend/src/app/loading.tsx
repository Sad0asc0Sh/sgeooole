export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-12 h-12 border-4 border-kala-500 border-t-transparent rounded-full animate-spin" aria-label="در حال بارگذاری" />
    </div>
  );
}
