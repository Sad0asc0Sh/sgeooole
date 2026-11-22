"use client";

import Link from "next/link";
import { ChevronLeft, LayoutGrid, X } from "lucide-react";
import { useState } from "react";
import ResilientImage from "@/components/ui/ResilientImage";
import styles from "./TechnolifeMegaMenu.module.css";
import type { CategoryNode } from "./tree";

/** Circular icon chip on the rail — category icon when present, grid glyph otherwise. */
function RailIcon({ node }: { node: CategoryNode }) {
  return (
    <span className={styles.railIcon} aria-hidden="true">
      {node.image ? (
        <ResilientImage
          src={node.image}
          alt=""
          width={28}
          height={28}
          className="object-contain"
          onRetryExhausted={() => {}}
        />
      ) : (
        <LayoutGrid size={20} strokeWidth={1.75} />
      )}
    </span>
  );
}

export interface TechnolifeMegaMenuProps {
  roots: CategoryNode[];
  onClose: () => void;
}

/**
 * Technolife-style cascade body: icon rail on the right, the hovered root's
 * children as a middle column, and the hovered group's children as a
 * light-blue leaf column. Opening shows only the rail, exactly like the
 * original — columns appear as the pointer moves across the levels.
 */
export default function TechnolifeMegaMenu({ roots, onClose }: TechnolifeMegaMenuProps) {
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const activeRoot = activeRootId ? (roots.find((root) => root.id === activeRootId) ?? null) : null;
  const activeGroup = activeRoot?.children?.find((group) => group.id === activeGroupId) ?? null;
  const leafColumn = activeGroup?.children?.length ? activeGroup : null;

  const activateRoot = (id: string) => {
    setActiveRootId(id);
    setActiveGroupId(null);
  };

  return (
    <div className={styles.menuStack}>
      <nav className={styles.firstLevel} aria-label="دسته‌بندی محصولات">
        <ul className={styles.railList}>
          {roots.map((root) => {
            const isActive = root.id === activeRootId;
            return (
              <li
                key={root.id}
                className={isActive ? `${styles.railItem} ${styles.railItemActive}` : styles.railItem}
              >
                <Link
                  href={root.href}
                  className={styles.railLink}
                  onMouseEnter={() => activateRoot(root.id)}
                  onFocus={() => activateRoot(root.id)}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span className={styles.railRow}>
                    <RailIcon node={root} />
                    <span className={styles.railText}>{root.title}</span>
                  </span>
                  {isActive && <ChevronLeft className={styles.chevron} aria-hidden="true" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {activeRoot?.children?.length ? (
        <div className={styles.secondLevel}>
          <Link href={activeRoot.href} className={styles.secondHeaderChip}>
            <span>{activeRoot.title}</span>
          </Link>
          <ul className={styles.secondList}>
            {activeRoot.children.map((group) => {
              const isActive = group.id === activeGroupId;
              return (
                <li
                  key={group.id}
                  className={
                    isActive ? `${styles.secondItem} ${styles.secondItemActive}` : styles.secondItem
                  }
                >
                  <Link
                    href={group.href}
                    className={styles.secondLink}
                    onMouseEnter={() => setActiveGroupId(group.id)}
                    onFocus={() => setActiveGroupId(group.id)}
                  >
                    <span className={styles.secondText}>{group.title}</span>
                    {isActive && group.children?.length ? (
                      <ChevronLeft className={styles.chevron} aria-hidden="true" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {leafColumn && (
        <div className={styles.lastLevel}>
          <Link href={leafColumn.href} className={styles.lastHeaderChip}>
            <span>{leafColumn.title}</span>
          </Link>
          <ul className={styles.lastList}>
            {leafColumn.children?.map((leaf) => (
              <li key={leaf.id} className={styles.lastItem}>
                <Link href={leaf.href} className={styles.lastLink}>
                  <span>{leaf.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className={styles.closeBtn}
        onClick={onClose}
        aria-label="بستن منوی دسته‌بندی‌ها"
      >
        <X size={28} strokeWidth={2} />
      </button>
    </div>
  );
}
