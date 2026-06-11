"use client";

import { useCallback } from "react";
import dynamic from "next/dynamic";

import "react-quill/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

const defaultModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "image"],
    ["clean"],
  ],
};

const defaultFormats = [
  "header", "bold", "italic", "underline", "strike",
  "list", "bullet", "link", "image",
];

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  modules?: object;
  formats?: string[];
}

export default function RichTextEditor({ value, onChange, modules, formats }: RichTextEditorProps) {
  const handleChange = useCallback(
    (_html: string, _d: unknown, _s: unknown, editor: { getHTML: () => string }) => {
      onChange(editor.getHTML());
    },
    [onChange]
  );

  return (
    <div className="rich-text-editor">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={handleChange as never}
        modules={{ ...defaultModules, ...modules }}
        formats={formats ?? defaultFormats}
      />
    </div>
  );
}
