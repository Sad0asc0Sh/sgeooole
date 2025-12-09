"use client";

import { SectionTitle } from "@/components/ui/SectionTitle";
import { brandService, HomepageBrand } from "@/services/brandService";
import { useRef, useState, MouseEvent, useEffect } from "react";
import Image from "next/image";
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

  const handleBrandClick = (brandSlug: string) => {
    if (isDragging) return;
    // Use Next.js router for client-side navigation
    router.push(`/brands/${brandSlug}`);
  };

  // Don't render the section if there are no brands
  if (!loading && brands.length === 0) {
    return null;
  }

  return (
    <div className="py-8 bg-white">
      <SectionTitle>برندهای همکار</SectionTitle>

      {loading ? (
        // Loading skeleton
        <div className="flex items-center justify-center px-6 gap-8 md:gap-12">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-gray-200 rounded h-8 w-24"
            />
          ))}
        </div>
      ) : (
        <div
          ref={sliderRef}
          className={`
            flex items-center justify-between px-6 overflow-x-auto gap-8 md:justify-center md:gap-12
            no-scrollbar cursor-grab active:cursor-grabbing select-none
          `}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          {brands.map((brand) => (
            <div
              key={brand._id}
              onClick={() => handleBrandClick(brand.slug)}
              onMouseEnter={() => setHoveredBrand(brand._id)}
              onMouseLeave={() => setHoveredBrand(null)}
              className="min-w-max transition-all duration-300 transform hover:scale-110 flex items-center gap-2 cursor-pointer"
              style={{
                color: hoveredBrand === brand._id ? brand.hoverColor : brand.textColor,
              }}
            >
              {/* Show logo if available */}
              {brand.logo?.url && (
                <div className="relative w-8 h-8 rounded overflow-hidden">
                  <Image
                    src={brand.logo.url}
                    alt={brand.name}
                    fill
                    className="object-contain"
                    sizes="32px"
                  />
                </div>
              )}
              <span className="text-xl font-black tracking-wider">
                {brand.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
