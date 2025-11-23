"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import CategoriesContent from "./CategoriesContent";

interface CategoriesSheetProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CategoriesSheet({ isOpen, onClose }: CategoriesSheetProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed inset-0 z-40 bg-white flex flex-col pb-16"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900">دسته‌بندی محصولات</h2>
                        <button onClick={onClose} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
                            <X size={24} className="text-gray-600" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden">
                        <CategoriesContent />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
