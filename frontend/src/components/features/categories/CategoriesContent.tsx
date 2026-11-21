"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, ChevronLeft, FolderTree, LayoutGrid, Loader2,
  Package, RotateCcw, ShoppingBag, X,
} from "lucide-react";
import { useCategoryTree } from "@/hooks/useCategories";
import { categoryImageSources, categoryProductHref } from "@/lib/categoryNavigation";
import type { Category } from "@/services/categoryService";
import styles from "./CategoriesSheet.module.css";

const number = new Intl.NumberFormat("fa-IR");

export interface CategoryBrowserProps {
  path: string[];
  enter: (id: string) => void;
  backTo: (depth: number) => void;
  leaveForLink: (event: { preventDefault(): void }, href: string) => void;
}

function CategoryThumbnail({ sources, branch }: { sources: string[]; branch: boolean }) {
  const [index, setIndex] = useState(0);
  const src = sources[index];
  const Fallback = branch ? FolderTree : Package;
  return (
    <span className={styles.thumbnail} aria-hidden="true">
      {src ? (
        <Image key={src} src={src} width={64} height={64} alt="" unoptimized
          onError={() => setIndex(index + 1)} />
      ) : <Fallback size={26} strokeWidth={1.5} />}
    </span>
  );
}

export default function CategoriesContent({ path, enter, backTo, leaveForLink }: CategoryBrowserProps) {
  const { categoryTree, isLoading, isValidating, error, refresh } = useCategoryTree();
  const heading = useRef<HTMLHeadingElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const offsets = useRef(new Map<string, number>());
  const previousPath = useRef(path);

  const trail: Category[] = [];
  let items = categoryTree;
  for (const id of path) {
    const node = items.find((category) => category._id === id);
    if (!node?.children?.length) break;
    trail.push(node);
    items = node.children;
  }
  const depth = trail.length;
  const current = trail[depth - 1];
  const levelKey = current?._id ?? "";
  const parentName = trail[depth - 2]?.name ?? "همه دسته‌ها";
  const hasData = categoryTree.length > 0;

  // A category can move or become a leaf while SWR refreshes an open menu.
  useEffect(() => {
    if ((hasData || (!isLoading && !error)) && depth < path.length) backTo(depth);
  }, [hasData, isLoading, error, depth, path.length, backTo]);

  useLayoutEffect(() => {
    const previous = previousPath.current;
    previousPath.current = path;
    const returning = previous.length > path.length;
    if (scroller.current) {
      scroller.current.scrollTop = returning ? (offsets.current.get(levelKey) ?? 0) : 0;
    }
    const row = returning && document.getElementById(`category-menu-row-${previous[path.length]}`);
    (row || heading.current)?.focus({ preventScroll: true });
  }, [path, levelKey]);

  const productsHref = current && categoryProductHref(current);
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {depth > 0 ? (
            <button type="button" className={styles.iconButton} onClick={() => backTo(depth - 1)}
              aria-label={`بازگشت به ${parentName}`}>
              <ArrowRight size={21} aria-hidden="true" />
            </button>
          ) : (
            <span className={styles.catalogIcon} aria-hidden="true"><LayoutGrid size={22} /></span>
          )}
          <h2 id="category-menu-title" ref={heading} tabIndex={-1} className={styles.title}>
            {current?.name ?? "دسته‌بندی محصولات"}
          </h2>
          <button type="button" className={styles.iconButton} onClick={() => backTo(-1)}
            aria-label="بستن دسته‌بندی‌ها"><X size={21} aria-hidden="true" /></button>
        </div>
      </header>

      <div className={styles.scroller} ref={scroller}
        onScroll={(event) => offsets.current.set(levelKey, event.currentTarget.scrollTop)}>
        {!hasData ? (
          <div className={styles.feedback} role="status">
            {isLoading ? (
              <><Loader2 className={styles.spinner} size={28} /><p>در حال دریافت دسته‌بندی‌ها…</p></>
            ) : error ? (
              <><FolderTree size={30} /><p>دسته‌بندی‌ها بارگذاری نشدند.</p>
                <button type="button" disabled={isValidating} onClick={() => void refresh()}>
                  <RotateCcw size={16} aria-hidden="true" /> تلاش مجدد
                </button>
              </>
            ) : (
              <><LayoutGrid size={30} /><p>هنوز دسته‌بندی‌ای برای نمایش وجود ندارد.</p></>
            )}
          </div>
        ) : (
          <div className={styles.content}>
            {current && (
              <nav aria-label="مسیر دسته‌بندی" className={styles.breadcrumb}>
                <ol>
                  <li><button type="button" onClick={() => backTo(0)}>همه دسته‌ها</button></li>
                  {trail.map((category, index) => (
                    <li key={category._id}>
                      <ChevronLeft size={14} aria-hidden="true" />
                      {index === depth - 1 ? (
                        <span aria-current="location">{category.name}</span>
                      ) : (
                        <button type="button" onClick={() => backTo(index + 1)}>{category.name}</button>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            {productsHref && (
              <Link href={productsHref} prefetch={false} className={styles.allProducts}
                onNavigate={(event) => leaveForLink(event, productsHref)}>
                <ShoppingBag size={20} aria-hidden="true" />
                <span>همه محصولات {current.name}</span>
                <ArrowLeft size={18} aria-hidden="true" />
              </Link>
            )}
            <div className={styles.listHeading}>
              <h3>{current ? "زیرشاخه‌ها" : "دسته‌های اصلی"}</h3>
              <span>سطح {number.format(depth + 1)}</span>
            </div>
            <ul className={styles.list}>
              {items.map((category) => {
                const count = category.children?.length ?? 0;
                const sources = categoryImageSources(category);
                const id = `category-menu-row-${category._id}`;
                const content = (
                  <>
                    <CategoryThumbnail key={JSON.stringify(sources)} sources={sources} branch={count > 0} />
                    <span className={styles.rowText}>
                      <strong>{category.name}</strong>
                      <span>{count > 0 ? `${number.format(count)} زیرشاخه` : "مشاهده محصولات"}</span>
                    </span>
                    {count > 0 ? (
                      <span className={styles.branchArrow}><ChevronLeft size={19} aria-hidden="true" /></span>
                    ) : <ArrowLeft size={19} className={styles.leafArrow} aria-hidden="true" />}
                  </>
                );
                const href = categoryProductHref(category);
                return (
                  <li key={category._id}>
                    {count > 0 ? (
                      <button id={id} type="button" className={styles.row} onClick={() => enter(category._id)}>
                        {content}
                      </button>
                    ) : (
                      <Link id={id} href={href} prefetch={false} className={styles.row}
                        onNavigate={(event) => leaveForLink(event, href)}>{content}</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
