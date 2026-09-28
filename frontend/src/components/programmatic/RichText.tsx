import Link from "next/link";
import { Fragment } from "react";

/**
 * Phase 2 SEO (#11 internal linking).
 *
 * Renders plain content text with markdown-style inline links:
 *   [متن لینک](/guides/راهنمای-خرید-dvr)
 *
 * This keeps the content layer (src/content/programmatic/*.ts) free of HTML
 * while letting guides / glossary / comparisons carry 2–5 contextual text
 * links in their body. Internal hrefs (starting with "/") use next/link;
 * anything else renders as a plain <a>.
 *
 * Newlines are preserved by the caller's whitespace-pre-line CSS, so this
 * renders inline fragments only.
 */
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

export default function RichText({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const label = m[1];
    const href = m[2];
    const linkClass =
      "text-blue-700 underline decoration-blue-200 underline-offset-4 hover:decoration-blue-500";
    nodes.push(
      href.startsWith("/") ? (
        <Link key={key++} href={href} className={linkClass}>
          {label}
        </Link>
      ) : (
        <a key={key++} href={href} className={linkClass}>
          {label}
        </a>
      )
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return (
    <Fragment>
      {nodes.map((n, i) => (
        <Fragment key={i}>{n}</Fragment>
      ))}
    </Fragment>
  );
}
