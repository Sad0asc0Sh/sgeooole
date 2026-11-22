"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ChevronDown, FolderTree, LayoutGrid, Loader2, RotateCcw,
} from "lucide-react";
import { useCategoryTree } from "@/hooks/useCategories";
import { CategoryColumns, CategoryRail, NodeThumbnail } from "./MegaMenuPanel";
import styles from "./CategoriesBrowser.module.css";
import { normalizeCategoryTree, type CategoryNode } from "./tree";

type CategoryNavigation = (event: { preventDefault(): void }, href: string) => void;
type CategoriesBrowserProps =
  | { initialTree: CategoryNode[]; initialError?: boolean; onNavigate?: never }
  | { initialTree?: never; initialError?: never; onNavigate: CategoryNavigation };

const emptyTree: CategoryNode[] = [];

export default function CategoriesBrowser({ initialTree = emptyTree, initialError = false, onNavigate }: CategoriesBrowserProps) {
  const { categoryTree, isLoading, isValidating, error, refresh } = useCategoryTree();
  const [activeId, setActiveId] = useState<string | null>(null);
  // undefined = "user hasn't chosen yet" → derive the default during render so
  // the server paints the first root with its first group already open.
  const [chosenOpenGroupId, setChosenOpenGroupId] = useState<string | null | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  // Server tree paints first; SWR takes over once it resolves. SWR returns the
  // raw backend model — normalize both shapes into CategoryNode[].
  const roots = useMemo<CategoryNode[]>(
    () => normalizeCategoryTree(categoryTree.length ? categoryTree : initialTree),
    [categoryTree, initialTree],
  );

  const active = (activeId && roots.find((root) => root.id === activeId)) || roots[0] || null;

  // One open accordion per root — its first group with children, like the original.
  const openGroupId = chosenOpenGroupId === undefined
    ? (active?.children?.find((group) => group.children?.length)?.id ?? null)
    : chosenOpenGroupId;
  const activeKey = active?.id ?? null;
  useEffect(() => {
    setChosenOpenGroupId(undefined);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeKey]);

  if (!roots.length) {
    return (
      <div className={onNavigate ? styles.sheetBrowser : styles.page}>
        <div className={styles.feedback} role="status">
          {isLoading ? (
            <Loader2 className={styles.spinner} size={28} aria-hidden="true" />
          ) : error || initialError ? (
            <>
              <FolderTree size={30} aria-hidden="true" />
              <p>دسته‌بندی‌ها بارگذاری نشدند.</p>
              <button type="button" disabled={isValidating} onClick={() => void refresh()}>
                <RotateCcw size={16} aria-hidden="true" /> تلاش مجدد
              </button>
            </>
          ) : (
            <>
              <LayoutGrid size={30} aria-hidden="true" />
              <p>هنوز دسته‌بندی‌ای برای نمایش وجود ندارد.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const activate = (id: string) => setActiveId(id);
  const rail = <CategoryRail roots={roots} activeId={active?.id ?? null} onActivate={activate} />;

  return (
    <>
      {/* Mobile: two-pane browser — image rail + single-open accordion of card grids. */}
      <div className={onNavigate ? styles.sheetBrowser : "flex items-start md:hidden"}>
        {rail}
        <div className={styles.content} ref={contentRef}>
          {active && (
            <div className={styles.toolbar}>
              <Link href={active.href} className={styles.toolbarLink}
                onNavigate={(event) => onNavigate?.(event, active.href)}>
                <LayoutGrid size={18} aria-hidden="true" />
                نمایش همه محصولات
              </Link>
            </div>
          )}
          {(active?.children ?? []).map((group) => {
            const children = group.children ?? [];
            const isOpen = group.id === openGroupId;
            if (!children.length) {
              return (
                <div key={group.id} className={styles.group}>
                  <Link href={group.href} className={styles.groupHeader}
                    onNavigate={(event) => onNavigate?.(event, group.href)}>
                    <span className={styles.groupTitle}>{group.title}</span>
                    <ArrowLeft size={20} className={styles.groupChevron} aria-hidden="true" />
                  </Link>
                </div>
              );
            }
            return (
              <div key={group.id} className={isOpen ? `${styles.group} ${styles.groupActive}` : styles.group}>
                <button
                  type="button"
                  className={styles.groupHeader}
                  aria-expanded={isOpen}
                  aria-controls={`category-group-${group.id}`}
                  onClick={() => setChosenOpenGroupId(isOpen ? null : group.id)}
                >
                  <span className={styles.groupTitle}>{group.title}</span>
                  <ChevronDown size={20} className={`${styles.groupChevron} ${isOpen ? styles.groupChevronOpen : ""}`} aria-hidden="true" />
                </button>
                {isOpen && (
                  <div id={`category-group-${group.id}`} className={styles.groupBody}>
                    <div className={styles.cardGrid}>
                      {children.map((child) => (
                        <Link key={child.id} href={child.href} className={styles.card}
                          onNavigate={(event) => onNavigate?.(event, child.href)}>
                          <NodeThumbnail node={child} size={48} />
                          <span className={styles.cardLabel}>{child.title}</span>
                        </Link>
                      ))}
                      <Link href={group.href} className={styles.card}
                        onNavigate={(event) => onNavigate?.(event, group.href)}>
                        <span className={styles.cardAllIcon} aria-hidden="true">
                          <LayoutGrid size={28} strokeWidth={1.75} />
                        </span>
                        <span className={styles.cardLabel}>همه کالاها</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop: the AllCategories mega-menu body as a full page. */}
      {!onNavigate && (
        <div className="hidden md:flex items-start">
          {rail}
          <div className={styles.content}>
            {active && (
              <div className={styles.toolbar} style={{ position: "static" }}>
                <Link href={active.href} className={styles.toolbarLink}>
                  <LayoutGrid size={18} aria-hidden="true" />
                  نمایش همه محصولات {active.title}
                </Link>
              </div>
            )}
            {active && <CategoryColumns root={active} />}
          </div>
        </div>
      )}
    </>
  );
}
