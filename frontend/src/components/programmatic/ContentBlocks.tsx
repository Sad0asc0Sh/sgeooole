import type { ContentBlock } from "@/content/programmatic/types";
import RichText from "./RichText";

/** Renders typed content blocks with consistent article typography. */
export default function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-4 text-gray-700 leading-8 text-[15px]">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={i} className="whitespace-pre-line">
                <RichText text={block.text} />
              </p>
            );
          case "list":
            return (
              <ul key={i} className="space-y-2 pr-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                    <span>
                      <RichText text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {block.headers.map((h, j) => (
                        <th key={j} className="px-4 py-3 text-right font-bold text-gray-800 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className={r % 2 === 1 ? "bg-gray-50/50" : undefined}>
                        {row.map((cell, c) => (
                          <td key={c} className="px-4 py-3 border-t border-gray-100 align-top">
                            <RichText text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "callout":
            return (
              <div key={i} className="rounded-xl border-r-4 border-amber-400 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-900">
                <RichText text={block.text} />
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
