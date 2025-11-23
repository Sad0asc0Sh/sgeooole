"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronDown } from "lucide-react";
import { CATEGORIES } from "@/lib/mock/categoryData";

export default function CategoriesContent() {
    const [activeId, setActiveId] = useState(CATEGORIES[0].id);
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

    const activeCategory = CATEGORIES.find(c => c.id === activeId);

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev =>
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        );
    };

    const handleCategoryChange = (id: string) => {
        setActiveId(id);
        setExpandedGroups([]);
    };

    return (
        <div className="flex h-full bg-white overflow-hidden">

            {/* --- Right Sidebar (Main Cats) --- */}
            <aside className="w-[28%] bg-gray-50 h-full overflow-y-auto no-scrollbar pb-20 border-l border-gray-100">
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => handleCategoryChange(cat.id)}
                        className={`
              w-full flex flex-col items-center justify-center gap-2 py-5 px-2 transition-all duration-300 border-b border-gray-100 relative
              ${activeId === cat.id
                                ? "bg-white text-vita-600 font-bold"
                                : "text-gray-500 hover:bg-gray-100 font-medium"
                            }
            `}
                    >
                        {/* Active Indicator Strip */}
                        {activeId === cat.id && (
                            <span className="absolute right-0 top-0 h-full w-1 bg-vita-500 rounded-l-md" />
                        )}

                        <cat.icon size={24} strokeWidth={1.5} className={activeId === cat.id ? "text-vita-500" : "text-gray-400"} />
                        <span className="text-[10px] text-center leading-tight">{cat.name}</span>
                    </button>
                ))}
            </aside>

            {/* --- Left Content (Accordion List) --- */}
            <main className="flex-1 h-full overflow-y-auto bg-white p-4 pb-24 no-scrollbar">
                {/* Header */}
                <div className="flex items-center gap-2 mb-6">
                    <span className="text-sm font-bold text-gray-800">
                        {activeCategory?.name}
                    </span>
                    <div className="h-px flex-1 bg-gray-100" />
                    <a href="#" className="text-[10px] text-vita-600 flex items-center">
                        مشاهده همه <ChevronLeft size={12} />
                    </a>
                </div>

                {/* Accordion Groups with Page Transition */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col gap-3"
                    >
                        {activeCategory?.groups?.map((group) => {
                            const isExpanded = expandedGroups.includes(group.id);
                            return (
                                <div key={group.id} className="border-b border-gray-100 last:border-0 pb-2">
                                    {/* Accordion Header */}
                                    <button
                                        onClick={() => toggleGroup(group.id)}
                                        className="w-full flex items-center justify-between py-3 text-gray-700 font-medium text-sm hover:text-vita-600 transition-colors"
                                    >
                                        <span>{group.name}</span>
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronLeft size={16} className="text-gray-400" />}
                                    </button>

                                    {/* Accordion Content (Animated) */}
                                    <motion.div
                                        initial={false}
                                        animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="overflow-hidden"
                                    >
                                        <div className="grid grid-cols-3 gap-4 py-2 pr-2">
                                            {group.items.map((item) => (
                                                <div key={item.id} className="flex flex-col items-center gap-2 cursor-pointer group">
                                                    <div className="w-14 h-14 bg-gray-50 rounded-full p-2 flex items-center justify-center border border-gray-100 group-hover:border-vita-200 transition-colors">
                                                        <div className="w-full h-full bg-gray-200 rounded-full opacity-50 flex items-center justify-center text-[8px] text-gray-400">
                                                            IMG
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] text-center text-gray-600 leading-tight">
                                                        {item.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                </div>
                            );
                        })}
                    </motion.div>
                </AnimatePresence>
            </main>

        </div>
    );
}
