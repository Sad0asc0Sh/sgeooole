"use client";

import { useState, useRef, useCallback, useMemo } from "react";

interface EnhancedTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const tagInserts: { label: string; insert: string }[] = [
  { label: "H2", insert: "<h2>Heading</h2>" },
  { label: "H3", insert: '<h3>Subheading</h3>' },
  { label: "P", insert: "<p>Paragraph text</p>" },
  { label: "B", insert: "<strong>Bold text</strong>" },
  { label: "I", insert: "<em>Italic text</em>" },
  { label: "UL", insert: "<ul><li>Item 1</li><li>Item 2</li></ul>" },
  { label: "OL", insert: "<ol><li>First</li><li>Second</li></ol>" },
  { label: "Link", insert: '<a href="https://example.com">Link text</a>' },
  { label: "BR", insert: "<br>" },
];

export default function EnhancedTextEditor({ value, onChange }: EnhancedTextEditorProps) {
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = value.length;
  const wordCount = useMemo(() => {
    const text = value.replace(/<[^>]*>/g, " ").trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
  }, [value]);

  const handleInsert = useCallback(
    (insert: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = value.substring(0, start);
      const after = value.substring(end);
      const newValue = before + insert + after;
      onChange(newValue);

      // Restore cursor position after inserted text
      requestAnimationFrame(() => {
        textarea.focus();
        const newPos = start + insert.length;
        textarea.setSelectionRange(newPos, newPos);
      });
    },
    [value, onChange],
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-gray-50 border border-gray-200 rounded-lg">
        {tagInserts.map((tag) => (
          <button
            key={tag.label}
            type="button"
            onClick={() => handleInsert(tag.insert)}
            className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-white border border-gray-200 text-gray-600 hover:bg-kala-50 hover:border-kala-300 hover:text-kala-700 transition-colors"
            title={`Insert ${tag.label}`}
          >
            {tag.label}
          </button>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-gray-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("write")}
          className={`px-4 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === "write"
              ? "bg-white text-kala-700 border border-gray-200 border-b-white -mb-px"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`px-4 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === "preview"
              ? "bg-white text-kala-700 border border-gray-200 border-b-white -mb-px"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Preview
        </button>
        <div className="flex-1" />
        <span className="self-center text-xs text-gray-400 tabular-nums">
          {charCount.toLocaleString()} chars &middot; {wordCount.toLocaleString()} words
        </span>
      </div>

      {/* Editor / Preview panes */}
      <div className="relative min-h-[300px] border border-gray-200 rounded-b-lg overflow-hidden">
        {/* Write pane */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextareaChange}
          className={`w-full px-4 py-3 font-mono text-sm leading-6 bg-gray-50/50 border-0 focus:outline-none focus:ring-0 resize-y transition-opacity ${
            activeTab === "write" ? "opacity-100" : "absolute inset-0 opacity-0 pointer-events-none"
          }`}
          placeholder="محتوای HTML یا متن ساده..."
          rows={12}
          dir="ltr"
          spellCheck={false}
        />

        {/* Preview pane */}
        <div
          className={`transition-opacity ${
            activeTab === "preview" ? "opacity-100" : "absolute inset-0 opacity-0 pointer-events-none"
          }`}
        >
          {value ? (
            <div
              className="prose prose-sm max-w-none p-4 md:p-6 bg-white min-h-[300px]
                prose-headings:text-gray-800 prose-headings:font-bold
                prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
                prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-kala-700
                prose-p:text-gray-600 prose-p:leading-7
                prose-ul:space-y-2 prose-li:text-gray-600
                prose-strong:text-gray-800 prose-strong:font-bold
                prose-a:text-kala-500 prose-a:no-underline hover:prose-a:underline"
              dir="rtl"
              dangerouslySetInnerHTML={{ __html: value }}
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
              Type HTML above to see a live preview here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
