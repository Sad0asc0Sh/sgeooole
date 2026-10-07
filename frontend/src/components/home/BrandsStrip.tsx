"use client";

import { SectionTitle } from "@/components/ui/SectionTitle";
import { brandService, HomepageBrand } from "@/services/brandService";
import { useRef, useState, MouseEvent, useEffect } from "react";
import ResilientImage from "@/components/ui/ResilientImage";
import { useRouter } from "next/navigation";

export default function BrandsStrip() {
  const router = useRouter();
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [brands, setBrands] = useState<HomepageBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBrand, setHoveredBrand] = useState<string | null>(null);

  // Fetch homepage brands
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        setLoading(true);
        const data = await brandService.getHomepageBrands();
        setBrands(data);
      } catch (error) {
        console.error("Error fetching homepage brands:", error);
        setBrands([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBrands();
  }, []);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!sliderRef.current) return;
    setIsDown(true);
    setIsDragging(false);
    setStartX(e.pageX - sliderRef.current.offsetLeft);
    setScrollLeft(sliderRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDown(false);
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDown(false);
    setTimeout(() => setIsDragging(false), 0);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDown || !sliderRef.current) return;
    e.preventDefault();
    const x = e.pageX - sliderRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    sliderRef.current.scrollLeft = scrollLeft - walk;

    if (Math.abs(x - startX) > 5) {
      setIsDragging(true);
    }
  };

  const handleBrandClick = (brandKey?: string) => {
    if (isDragging) return;

    const value = (brandKey || "").trim();
    if (!value) return;

    // Go straight to the products listing with brand filter
    router.push(`/products?brand=${encodeURIComponent(value)}`);
  };

  // Don't render the section if there are no brands
  if (!loading && brands.length === 0) {
    return null;
  }

  return (
    <section className="py-8 md:py-10 lg:py-12 bg-white border-t border-ekg-100/60">
      <div className="mx-auto w-full max-w-screen-2xl md:px-4 lg:px-6">
        {/* Header: mobile keeps the compact title, desktop adds a subtitle */}
        <div className="md:mb-8">
          <SectionTitle className="md:px-0 md:mb-2">برندهای همکار</SectionTitle>
          <p className="hidden md:block text-sm lg:text-base text-ekg-500">
            محصولات اصل و با گارانتی معتبر از برترین برندهای تجهیزات امنیتی
          </p>
        </div>

        {loading ? (
          // Loading skeleton
          <div className="flex items-center justify-center px-6 md:px-0 gap-8 md:gap-5 md:flex-wrap">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="animate-pulse bg-gray-200 rounded h-8 w-24 md:h-40 md:w-44 md:rounded-2xl"
              />
            ))}
          </div>
        ) : (
          <div
            ref={sliderRef}
            className={`
              flex items-center justify-between px-6 py-4 overflow-x-auto gap-8
              no-scrollbar cursor-grab active:cursor-grabbing select-none
              md:flex-wrap md:justify-center md:items-stretch md:overflow-visible md:px-0 md:py-0 md:gap-4 lg:gap-5
              md:cursor-default md:active:cursor-default
            `}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
          >
            {brands.map((brand) => (
              <div
                key={brand._id}
                role="link"
                tabIndex={0}
                aria-label={brand.name}
                onClick={() => handleBrandClick(brand.slug || brand._id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleBrandClick(brand.slug || brand._id);
                  }
                }}
                onMouseEnter={() => setHoveredBrand(brand._id)}
                onMouseLeave={() => setHoveredBrand(null)}
                className={`
                  group min-w-max transition-all duration-300 transform hover:scale-110 flex flex-col items-center gap-3 cursor-pointer p-2
                  md:min-w-0 md:w-40 lg:w-44 md:justify-center md:p-5 md:rounded-2xl md:border md:border-ekg-100 md:bg-ekg-50/40
                  md:hover:scale-100 md:hover:-translate-y-1 md:hover:bg-white md:hover:shadow-xl md:hover:border-kala-200/70
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-kala-500 focus-visible:ring-offset-2
                `}
                style={{
                  color: hoveredBrand === brand._id ? brand.hoverColor : brand.textColor,
                }}
              >
                {/* Show logo if available */}
                {brand.logo?.url && (
                  <div className="relative w-24 h-24 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded transition-transform duration-300 md:group-hover:scale-105">
                    <ResilientImage
                      src={brand.logo.url}
                      alt={brand.name}
                      fill
                      className="object-contain"
                      sizes="96px"
                      fallbackSrc="/placeholder.png"
                    />
                  </div>
                )}
                <span className="text-sm font-bold tracking-wide text-center md:line-clamp-1">
                  {brand.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
