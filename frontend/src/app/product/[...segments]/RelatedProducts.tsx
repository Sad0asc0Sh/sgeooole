import { fetchRelatedProducts } from "@/lib/productData";
import ProductRail from "@/components/home/ProductRail";

type CategoryPathItem = {
    id: string;
    name?: string;
    slug?: string;
};

export default async function RelatedProducts({
    categoryPath,
    productId
}: {
    categoryPath: CategoryPathItem[];
    productId: string;
}) {
    const relatedProducts = await fetchRelatedProducts(categoryPath, productId, 10);

    if (relatedProducts.length === 0) {
        return null;
    }

    return (
        <div className="pb-4">
            <ProductRail
                title="محصولات مشابه"
                products={relatedProducts}
            />
        </div>
    );
}
