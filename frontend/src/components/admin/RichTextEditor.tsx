"use client";

import { useCallback, useState } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const [preview, setPreview] = useState(false);

  const handleFormat = useCallback((tag: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const selected = range.extractContents();
    const el = document.createElement(tag);
    el.appendChild(selected);
    range.insertNode(el);
    const div = document.getElementById("rte-editor");
    if (div) onChange(div.innerHTML);
  }, [onChange]);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-200">
        {[
          { label: "B", tag: "strong", title: "Bold" },
          { label: "I", tag: "em", title: "Italic" },
          { label: "U", tag: "u", title: "Underline" },
        ].map(({ label, tag, title }) => (
          <button
            key={tag}
            type="button"
            title={title}
            onMouseDown={(e) => { e.preventDefault(); handleFormat(tag); }}
            className="px-2 py-1 text-sm font-medium border border-gray-300 rounded hover:bg-gray-200"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="ml-auto px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-200"
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {/* Editor / Preview */}
      {preview ? (
        <div
          className="p-3 min-h-[200px] prose max-w-none"
          dangerouslySetInnerHTML={{ __html: value }}
        />
      ) : (
        <div
          id="rte-editor"
          contentEditable
          suppressContentEditableWarning
          className="p-3 min-h-[200px] focus:outline-none"
          onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
          dangerouslySetInnerHTML={{ __html: value }}
        />
      )}
    </div>
  );
}
