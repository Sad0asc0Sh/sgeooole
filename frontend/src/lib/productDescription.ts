/**
 * Product copy is stored as ready-made HTML templates whose styling lives in
 * inline `style` attributes. One generation of the storefront's "structured"
 * template pinned the whole article to a fixed card width
 * (`max-width: 420px; margin: 0 auto`), which was fine for the narrow authoring
 * canvas but collapses the article into a narrow strip with a large blank gutter
 * on both sides once it is dropped into the product page's wide description
 * column. An inline declaration always wins over a stylesheet rule, so the
 * width contract is repaired here, on the article's root element, at render
 * time: the article always fills its column, and every nested card keeps its
 * own sizing untouched.
 */

const FIXED_ROOT_WIDTH = /(?:^|;)\s*(?:min-width|max-width|width)\s*:\s*\d+(?:\.\d+)?px/i;
const ROOT_WIDTH_DECLARATION = /(^|;)\s*(?:min-width|max-width|width)\s*:[^;]*/gi;
const FLUID_WIDTH = "width: 100%; max-width: 100%; box-sizing: border-box";

/**
 * Replace a pixel-sized `width` / `max-width` / `min-width` on the root element
 * of a product description with a fluid, column-filling width.
 *
 * Only the first (root) start tag is inspected, so cards, image wrappers and
 * table cells inside the article keep their authored widths. Descriptions that
 * are already fluid (or carry no inline style at all) are returned unchanged.
 */
export function normalizeDescriptionRoot(html: string): string {
  const rootTag = html.match(/^\s*<([a-z][a-z0-9-]*)\b([^>]*)>/i);
  if (!rootTag) return html;

  const [tag, name, attrs] = rootTag;
  const styleAttr = attrs.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  if (!styleAttr) return html;

  const style = styleAttr[1] ?? styleAttr[2] ?? "";
  if (!FIXED_ROOT_WIDTH.test(style)) return html;

  const fluid = style
    .replace(ROOT_WIDTH_DECLARATION, "$1")
    .replace(/;{2,}/g, ";")
    .replace(/^[\s;]+|[\s;]+$/g, "")
    .trim();

  const rebuiltAttrs = attrs.replace(styleAttr[0], `style="${fluid ? `${fluid}; ` : ""}${FLUID_WIDTH}"`);
  const offset = rootTag.index ?? 0;

  return `${html.slice(0, offset)}<${name}${rebuiltAttrs}>${html.slice(offset + tag.length)}`;
}
