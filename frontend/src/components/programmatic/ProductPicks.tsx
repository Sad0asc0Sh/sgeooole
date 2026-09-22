import Image from "next/image";
import Link from "next/link";
import { buildProductUrl } from "@/lib/paths";
import { resolveImageUrl } from "@/lib/image";

const API_BASE = (process.env.INTERNAL_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

type PickProduct = {
  id: string;
  name: string;
  slug?: string;
  productCode?: string;
  price: number;
  image: string;
  rating: number;
  reviewCount: number;
};

function normalizeItem(item: any): PickProduct | null {
  const id = item?._id || item?.id;
  const name = item?.name || item?.title;
  if (!id || !name) return null;
  return {
    id: String(id),
    name: String(name),
    slug: item?.slug ? String(item.slug) : undefined,
    productCode: item?.productCode ? String(item.productCode) : undefined,
    price: Number(item?.price) || 0,
    image: resolveImageUrl(item?.image || item?.images?.[0]),
    rating: Number(item?.rating) || 0,
    reviewCount: Number(item?.reviewCount) || 0,
  };
}

async function fetchPicks(categorySlug: string): Promise<PickProduct[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(
        `${API_BASE}/products?limit=6&category=${encodeURIComponent(categorySlug)}&sort=popularity&isActive=true`,
        { signal: controller.signal, next: { revalidate: 1800 } }
      );
      if (!res.ok) return [];
      const json = await res.json().catch(() => null);
      const data = Array.isArray(json?.data) ? json.data : [];
      return data.map(normalizeItem).filter((p: PickProduct | null): p is PickProduct => p !== null);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return [];
  }
}

/**
 * Live product picks for guide pages — proprietary data that makes each
 * guide genuinely useful (and unique). Renders nothing when the API is
 * unreachable or the category slug matches nothing, so pages never break.
 */
export default async function ProductPicks({
  categorySlug,
  categoryName,
}: {
  categorySlug: string;
  categoryName: string;
}) {
  const picks = await fetchPicks(categorySlug);
  if (picks.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-extrabold text-gray-900">پیشنهادهای منتخب {categoryName}</h2>
        <Link
          href={`/products?category=${encodeURIComponent(categorySlug)}`}
          className="text-sm font-bold text-blue-600 hover:text-blue-700"
        >
          مشاهده همه ←
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {picks.map((p) => (
          <Link
            key={p.id}
            href={buildProductUrl({ id: p.id, slug: p.slug, productCode: p.productCode } as any)}
            className="group rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="relative aspect-square bg-gray-50">
              <Image
                src={p.image}
                alt={p.name}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-contain p-3 group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            </div>
            <div className="p-3">
              <h3 className="text-[13px] font-medium text-gray-800 line-clamp-2 leading-6 min-h-[3rem]">
                {p.name}
              </h3>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-extrabold text-gray-900">
                  {p.price > 0 ? `${p.price.toLocaleString("fa-IR")} تومان` : "تماس بگیرید"}
                </span>
                {p.rating > 0 && (
                  <span className="text-xs text-amber-500 font-bold">
                    ★ {p.rating.toLocaleString("fa-IR")}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
