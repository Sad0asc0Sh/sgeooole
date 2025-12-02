"use client";
import { useEffect } from "react";
import { useHistoryStore } from "@/store/historyStore";
import { Product } from "@/services/productService";

type ProductHistoryTrackerProps = {
    product: Product;
};

export default function ProductHistoryTracker({ product }: ProductHistoryTrackerProps) {
    const { addToHistory } = useHistoryStore();

    // Track product view in history
    useEffect(() => {
        addToHistory({
            _id: product.id,
            title: product.title,
            price: product.price,
            image: product.images?.[0] || "",
            slug: product.slug || product.id,
            discount: product.discount,
            finalPrice: product.price,
        });
    }, [addToHistory, product]);

    return null; // This component doesn't render anything
}
