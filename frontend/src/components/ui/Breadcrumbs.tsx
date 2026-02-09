type Crumb = {
  label: string;
  href?: string;
};

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="breadcrumb" className="text-sm text-gray-500 flex items-center gap-1 flex-wrap">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={`${item.label}-${idx}`} className="flex items-center gap-1">
            {item.href && !isLast ? (
              <a href={item.href} className="hover:text-kala-600 font-medium">
                {item.label}
              </a>
            ) : (
              <span className="font-semibold text-gray-700">{item.label}</span>
            )}
            {!isLast && <span className="text-gray-300">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
