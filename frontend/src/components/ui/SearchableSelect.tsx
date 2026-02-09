"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    className?: string;
    error?: boolean;
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "انتخاب کنید",
    searchPlaceholder = "جستجو...",
    disabled = false,
    className = "",
    error = false
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Focus search input when opening
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        } else {
            setSearchTerm(""); // Reset search when closing
        }
    }, [isOpen]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        return options.filter(option =>
            option.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm("");
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between bg-white border rounded-xl p-3 text-sm transition-all outline-none
                    ${disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200" : "cursor-pointer hover:border-gray-300"}
                    ${error ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500" : "border-gray-200 focus:border-kala-500 focus:ring-1 focus:ring-kala-500"}
                    ${isOpen ? "border-kala-500 ring-1 ring-kala-500" : ""}
                `}
            >
                <span className={`truncate ${!selectedOption && !value ? "text-gray-400" : "text-gray-800"}`}>
                    {selectedOption ? selectedOption.label : (value || placeholder)}
                </span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top">
                    <div className="p-2 border-b border-gray-100 bg-gray-50">
                        <div className="relative">
                            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full bg-white border border-gray-200 rounded-lg py-2 pr-9 pl-3 text-xs focus:border-kala-500 focus:outline-none transition-colors"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                        {filteredOptions.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-500">
                                موردی یافت نشد
                            </div>
                        ) : (
                            <div className="p-1">
                                {filteredOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleSelect(option.value)}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors
                                            ${value === option.value
                                                ? "bg-kala-50 text-kala-700 font-medium"
                                                : "text-gray-700 hover:bg-gray-50"
                                            }
                                        `}
                                    >
                                        <span>{option.label}</span>
                                        {value === option.value && <Check size={14} className="text-kala-600" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
