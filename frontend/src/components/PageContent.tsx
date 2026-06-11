interface PageContentProps {
  content: string;
  className?: string;
}

/**
 * Shared component for rendering CMS page HTML content.
 * Applies consistent prose typography styling across all static pages.
 */
export default function PageContent({ content, className = "" }: PageContentProps) {
  return (
    <div
      className={`prose prose-lg max-w-none p-8 md:p-12
        prose-headings:text-gray-800 prose-headings:font-bold
        prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b prose-h2:border-gray-100 prose-h2:pb-4
        prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-kala-700
        prose-p:text-gray-600 prose-p:leading-8
        prose-ul:space-y-3 prose-li:text-gray-600
        prose-strong:text-gray-800 prose-strong:font-bold
        prose-a:text-kala-500 prose-a:no-underline hover:prose-a:underline
        ${className}`}
      dir="rtl"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
