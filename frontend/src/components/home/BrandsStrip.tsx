"use client";

import { SectionTitle } from "@/components/ui/SectionTitle";
import { useRef, useState, MouseEvent } from "react";

const BRANDS = [
  { id: 1, name: "SAILGIS", color: "text-[#fda4af]", hoverColor: "hover:text-[#f43f5e]" }, // Pink/Red
  { id: 2, name: "SUZUKI", color: "text-[#9ca3af]", hoverColor: "hover:text-[#6b7280]" },  // Gray
  { id: 3, name: "DAHUA", color: "text-[#93c5fd]", hoverColor: "hover:text-[#3b82f6]" },   // Blue
  { id: 4, name: "HSB", color: "text-[#fdba74]", hoverColor: "hover:text-[#f97316]" },     // Orange
  { id: 5, name: "VEKRA", color: "text-[#22c55e]", hoverColor: "hover:text-[#16a34a]" },   // Green
];

export default function BrandsStrip() {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

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
    // We don't reset isDragging immediately here to allow onClick to check it
    setTimeout(() => setIsDragging(false), 0);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDown || !sliderRef.current) return;
    e.preventDefault();
    const x = e.pageX - sliderRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll-fast
    sliderRef.current.scrollLeft = scrollLeft - walk;

    // If moved more than a few pixels, consider it a drag
    if (Math.abs(x - startX) > 5) {
      setIsDragging(true);
    }
  };

  const handleBrandClick = (brandName: string) => {
    if (isDragging) return;
    console.log(`Clicked on ${brandName}`);
    // Add navigation or other click logic here
  };

  return (
    <div className="py-8 bg-white">
      <SectionTitle>برندهای همکار</SectionTitle>
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
        {BRANDS.map((brand) => (
          <div
            key={brand.id}
            onClick={() => handleBrandClick(brand.name)}
            className={`
              text-xl font-black tracking-wider transition-all duration-300 transform hover:scale-110
              ${brand.color} ${brand.hoverColor}
              min-w-max
            `}
          >
            {brand.name}
          </div>
        ))}
      </div>
    </div>
  );
}
