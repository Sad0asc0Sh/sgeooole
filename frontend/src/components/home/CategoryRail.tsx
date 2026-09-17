"use client";

import { useEffect, useId, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ChevronLeft, Shapes } from "lucide-react";
import { useResilientImage } from "@/components/ui/ResilientImage";
import { categoryService, type Category } from "@/services/categoryService";
import { trackCategoryView, trackCategoryClick } from "@/lib/categoryTracking";
import { getScrollManager } from "@/lib/scroll/ScrollManager";
import styles from "./CategoryRail.module.css";

function ResilientCategoryImg({ url, name }: { url: string; name: string }) {
  const { src, onError, onLoad, ref, phase } = useResilientImage(url, "/placeholder.png");
  return (
    <div className={styles.image}>
      {phase === "skeleton" && <div className={styles.imageSkeleton} aria-hidden />}
      <img ref={ref} src={src} alt={name} onError={onError} onLoad={onLoad}
        style={{ opacity: phase === "loaded" || phase === "error" ? 1 : 0 }} />
    </div>
  );
}

function imageUrl(value: Category["image"] | string): string | undefined {
  return typeof value === "string" ? value : value?.url;
}

interface CategoryRailProps {
  title: string;
  data: Category[] | null;
  variant: "circle" | "card";
}

export default function CategoryRail({ title, data, variant }: CategoryRailProps) {
  const headingId = useId();
  const containerRef = useRef<HTMLUListElement>(null);
  const viewedIds = useRef(new Set<string>());
  const kind = variant === "circle" ? "featured" : "popular";
  const { data: categories, error, isValidating, mutate } = useSWR<Category[]>(
    `homepage-categories-${kind}`,
    () => categoryService.getHomepage(kind),
    {
      fallbackData: data ?? undefined,
      revalidateOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 30000,
      errorRetryCount: 2,
      errorRetryInterval: 5000,
      keepPreviousData: true,
    }
  );
  const hasCategories = Boolean(categories?.length);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const railKey = `cats_${variant}`;
    const saved = getScrollManager().getHorizontal(railKey);
    if (typeof saved === "number") container.scrollLeft = saved;
    const handleScroll = () => getScrollManager().saveHorizontal(railKey, container.scrollLeft);
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [variant, hasCategories]);

  useEffect(() => {
    categories?.slice(0, 3).forEach((category) => {
      if (!viewedIds.current.has(category._id)) {
        viewedIds.current.add(category._id);
        trackCategoryView(category._id, "homepage", "view");
      }
    });
  }, [categories]);

  if (categories?.length === 0 && !error) return null;

  return (
    <section className={styles.section} aria-labelledby={headingId} data-category-rail={kind}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h2 id={headingId}>{title}</h2>
          <Link href="/categories" className={styles.viewAll}>همه دسته‌بندی‌ها <ChevronLeft size={16} aria-hidden /></Link>
        </header>
        {hasCategories ? (
          <ul ref={containerRef} className={`${styles.items} ${variant === "card" ? styles.cards : ""}`} aria-label={title}>
            {categories!.map((category) => {
              const url = imageUrl(category.image) || imageUrl(category.icon);
              return (
                <li key={category._id} className={styles.item}>
                  <Link href={`/products?category=${encodeURIComponent(category.slug || category._id)}&includeChildren=true`}
                    className={styles.category}
                    onClick={() => trackCategoryClick(category._id, "homepage")}>
                    <div className={styles.thumbnail}>
                      {url ? <ResilientCategoryImg url={url} name={category.name} /> : <Shapes size={32} aria-hidden />}
                    </div>
                    <span className={styles.name}>{category.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : error ? (
          <div className={styles.feedback} role="status">
            <p>بارگذاری دسته‌بندی‌ها انجام نشد.</p>
            <button type="button" className={styles.viewAll} disabled={isValidating} onClick={() => { void mutate(); }}>
              {isValidating ? "در حال بارگذاری…" : "تلاش مجدد"}
            </button>
          </div>
        ) : (
          <div className={styles.skeletons} role="status" aria-label={`در حال بارگذاری ${title}`}>
            {Array.from({ length: 8 }, (_, index) => <div key={index} className={styles.skeleton} aria-hidden />)}
          </div>
        )}
      </div>
    </section>
  );
}
