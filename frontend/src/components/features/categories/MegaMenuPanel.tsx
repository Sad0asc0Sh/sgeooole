"use client";

import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import ResilientImage from "@/components/ui/ResilientImage";
import styles from "./CategoriesBrowser.module.css";
import type { CategoryNode } from "./tree";

export function NodeThumbnail({ node, size }: { node: CategoryNode; size: number }) {
  if (!node.image) {
    return (
      <span className={styles.cardAllIcon} style={{ width: size, height: size }} aria-hidden="true">
        <LayoutGrid size={size} strokeWidth={1.75} />
      </span>
    );
  }
  return (
    <span style={{ width: size, height: size, flex: "none" }} aria-hidden="true">
      <ResilientImage src={node.image} alt="" fill sizes={`${size}px`} className="object-contain"
        wrapperClassName="relative block w-full h-full"
        onRetryExhausted={() => {}} />
    </span>
  );
}

export interface CategoryRailProps {
  roots: CategoryNode[];
  activeId: string | null;
  onActivate: (id: string) => void;
}

/** Right-hand rail: image cells on mobile, snappshop-style pills on desktop. */
export function CategoryRail({ roots, activeId, onActivate }: CategoryRailProps) {
  const activeIndex = roots.findIndex((root) => root.id === activeId);
  const railClass = (index: number) => {
    if (index === activeIndex) return `${styles.railItem} ${styles.railItemActive}`;
    if (index === activeIndex - 1) return `${styles.railItem} ${styles.railItemBeforeActive}`;
    if (index === activeIndex + 1) return `${styles.railItem} ${styles.railItemAfterActive}`;
    return styles.railItem;
  };
  return (
    <nav className={styles.rail} aria-label="دسته‌بندی‌ها">
      <ul className={styles.pillList}>
        {roots.map((root, index) => (
          <li key={root.id}>
            <button
              type="button"
              className={railClass(index)}
              onMouseEnter={() => onActivate(root.id)}
              onFocus={() => onActivate(root.id)}
              onClick={() => onActivate(root.id)}
              aria-current={index === activeIndex ? "true" : undefined}
            >
              <NodeThumbnail node={root} size={48} />
              <span className={styles.railLabel}>{root.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Desktop columns: fixed-width 168px titles and links that wrap like the original. */
export function CategoryColumns({ root }: { root: CategoryNode }) {
  // The original stacks 396px-tall left-side-wrappers that column-wrap their
  // flat link lists; chunk groups the same way so long roots never overflow.
  const CHUNK_ROWS = 15; // ≈ 396px wrapper height (16px line + 8px row gap)
  const chunks: CategoryNode[][] = [];
  let current: CategoryNode[] = [];
  let rows = 0;
  for (const group of root.children ?? []) {
    const groupRows = 2 + (group.children?.length ?? 0) + 1; // title + همه کالاها + margin row
    if (rows + groupRows > CHUNK_ROWS && current.length) {
      chunks.push(current);
      current = [];
      rows = 0;
    }
    current.push(group);
    rows += groupRows;
  }
  if (current.length) chunks.push(current);

  const renderGroup = (group: CategoryNode) => {
    const items = [
      <Link key={`${group.id}-title`} href={group.href} className={styles.groupTitle}>
        {group.title}
      </Link>,
    ];
    for (const child of group.children ?? []) {
      items.push(
        <Link key={child.id} href={child.href} className={styles.card}>
          <span className={styles.cardLabel}>{child.title}</span>
        </Link>,
      );
    }
    items.push(
      <Link key={`${group.id}-all`} href={group.href} className={`${styles.card} ${styles.cardAll}`}>
        <span className={styles.cardLabel}>همه کالاها</span>
      </Link>,
    );
    return items;
  };

  return (
    <div className={styles.columns}>
      {chunks.map((chunk, index) => (
        <div key={`${chunk[0]?.id ?? "chunk"}-${index}`} className={styles.columnsChunk}>
          {chunk.flatMap(renderGroup)}
        </div>
      ))}
    </div>
  );
}

export interface MegaMenuPanelProps {
  roots: CategoryNode[];
  activeId: string | null;
  onActivate: (id: string) => void;
  /** Caps the columns viewport — used by the header overlay panel. */
  contentMaxHeight?: string | number;
}

/**
 * Desktop clone of snappshop's AllCategories mega-menu body: pill rail on the
 * right plus 168px link columns that wrap into a multi-column grid.
 */
export default function MegaMenuPanel({ roots, activeId, onActivate, contentMaxHeight }: MegaMenuPanelProps) {
  const active = roots.find((root) => root.id === activeId) ?? null;
  return (
    <>
      <CategoryRail roots={roots} activeId={activeId} onActivate={onActivate} />
      <div className={styles.content} style={contentMaxHeight ? { maxHeight: contentMaxHeight, overflowY: "auto" } : undefined}>
        {active ? (
          <CategoryColumns root={active} />
        ) : (
          <div className={styles.columns} aria-hidden="true" />
        )}
      </div>
    </>
  );
}
