"use client";

import { useState, useEffect } from "react";
import { pageService, PageData } from "@/services/pageService";
import {
    FileText,
    Plus,
    Search,
    Edit3,
    Trash2,
    Eye,
    EyeOff,
    Save,
    X,
    AlertCircle,
    CheckCircle,
    Loader2,
    Globe,
    Clock,
    ExternalLink
} from "lucide-react";

export default function AdminPagesPage() {
    const [pages, setPages] = useState<PageData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPage, setEditingPage] = useState<PageData | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        title: "",
        slug: "",
        content: "",
        status: "published" as "published" | "hidden",
        metaTitle: "",
        metaDescription: ""
    });

    // Delete confirmation
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchPages();
    }, []);

    const fetchPages = async () => {
        try {
            setLoading(true);
            const response = await pageService.getAdminPages({ limit: 100 });
            setPages(response.data);
        } catch (error) {
            console.error("Error fetching pages:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPages = pages.filter(page =>
        page.title.toLowerCase().includes(search.toLowerCase()) ||
        page.slug.toLowerCase().includes(search.toLowerCase())
    );

    const openCreateModal = () => {
        setEditingPage(null);
        setFormData({
            title: "",
            slug: "",
            content: "",
            status: "published",
            metaTitle: "",
            metaDescription: ""
        });
        setIsModalOpen(true);
    };

    const openEditModal = (page: PageData) => {
        setEditingPage(page);
        setFormData({
            title: page.title,
            slug: page.slug,
            content: page.content,
            status: page.status,
            metaTitle: page.meta?.title || "",
            metaDescription: page.meta?.description || ""
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingPage(null);
        setSaveSuccess(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSaveSuccess(false);

        try {
            const payload = {
                title: formData.title,
                slug: formData.slug,
                content: formData.content,
                status: formData.status,
                meta: {
                    title: formData.metaTitle,
                    description: formData.metaDescription
                }
            };

            if (editingPage) {
                await pageService.updatePage(editingPage._id, payload);
            } else {
                await pageService.createPage(payload);
            }

            setSaveSuccess(true);
            await fetchPages();
            setTimeout(() => {
                closeModal();
            }, 1000);
        } catch (error: any) {
            console.error("Error saving page:", error);
            alert(error.response?.data?.message || "خطا در ذخیره صفحه");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        setDeleting(true);
        try {
            await pageService.deletePage(id);
            await fetchPages();
            setDeleteConfirm(null);
        } catch (error: any) {
            console.error("Error deleting page:", error);
            alert(error.response?.data?.message || "خطا در حذف صفحه");
        } finally {
            setDeleting(false);
        }
    };

    const toggleStatus = async (page: PageData) => {
        try {
            await pageService.updatePage(page._id, {
                status: page.status === "published" ? "hidden" : "published"
            });
            await fetchPages();
        } catch (error) {
            console.error("Error toggling status:", error);
        }
    };

    // Predefined pages for quick creation
    const predefinedPages = [
        { title: "قوانین و مقررات", slug: "terms", icon: "📜" },
        { title: "سوالات متداول", slug: "faq", icon: "❓" },
        { title: "درباره ما", slug: "about", icon: "👋" },
        { title: "حریم خصوصی", slug: "privacy", icon: "🔒" }
    ];

    const existingSlugs = pages.map(p => p.slug);
    const missingPages = predefinedPages.filter(p => !existingSlugs.includes(p.slug));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                        <div className="w-12 h-12 bg-vita-100 rounded-2xl flex items-center justify-center text-vita-600">
                            <FileText size={24} />
                        </div>
                        مدیریت صفحات
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">ایجاد و ویرایش صفحات استاتیک سایت</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-6 py-3 bg-vita-500 text-white rounded-xl font-bold hover:bg-vita-600 transition-all shadow-lg shadow-vita-200"
                >
                    <Plus size={20} />
                    صفحه جدید
                </button>
            </div>

            {/* Quick Create Missing Pages */}
            {missingPages.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-amber-500 mt-0.5" size={20} />
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-800 mb-2">صفحات پیشنهادی</h3>
                            <p className="text-sm text-gray-600 mb-4">این صفحات در فوتر سایت لینک شده‌اند اما هنوز ایجاد نشده‌اند:</p>
                            <div className="flex flex-wrap gap-2">
                                {missingPages.map(page => (
                                    <button
                                        key={page.slug}
                                        onClick={() => {
                                            setEditingPage(null);
                                            setFormData({
                                                title: page.title,
                                                slug: page.slug,
                                                content: "",
                                                status: "published",
                                                metaTitle: page.title,
                                                metaDescription: ""
                                            });
                                            setIsModalOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 rounded-xl text-gray-700 hover:bg-amber-100 transition-all text-sm font-medium"
                                    >
                                        <span>{page.icon}</span>
                                        <span>{page.title}</span>
                                        <Plus size={16} className="text-amber-600" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative max-w-md">
                <input
                    type="text"
                    placeholder="جستجو در صفحات..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:ring-2 focus:ring-vita-500 focus:border-transparent transition-all bg-white"
                />
                <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            {/* Pages List */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 size={40} className="animate-spin text-vita-500" />
                </div>
            ) : filteredPages.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <FileText size={64} className="text-gray-200 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-600 mb-2">صفحه‌ای یافت نشد</h3>
                    <p className="text-gray-400">با کلیک روی "صفحه جدید" اولین صفحه خود را بسازید</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="text-right py-4 px-6 font-bold text-gray-600 text-sm">عنوان</th>
                                    <th className="text-right py-4 px-6 font-bold text-gray-600 text-sm">آدرس</th>
                                    <th className="text-right py-4 px-6 font-bold text-gray-600 text-sm">وضعیت</th>
                                    <th className="text-right py-4 px-6 font-bold text-gray-600 text-sm">آخرین ویرایش</th>
                                    <th className="text-center py-4 px-6 font-bold text-gray-600 text-sm">عملیات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredPages.map((page) => (
                                    <tr key={page._id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-vita-100 flex items-center justify-center text-vita-600">
                                                    <FileText size={18} />
                                                </div>
                                                <span className="font-bold text-gray-800">{page.title}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <code className="text-sm bg-gray-100 px-2 py-1 rounded-lg text-gray-600" dir="ltr">
                                                    /{page.slug}
                                                </code>
                                                <a
                                                    href={`/${page.slug}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-vita-500 hover:text-vita-600"
                                                >
                                                    <ExternalLink size={16} />
                                                </a>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <button
                                                onClick={() => toggleStatus(page)}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${page.status === "published"
                                                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                                                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                                    }`}
                                            >
                                                {page.status === "published" ? (
                                                    <>
                                                        <Eye size={14} />
                                                        منتشر شده
                                                    </>
                                                ) : (
                                                    <>
                                                        <EyeOff size={14} />
                                                        مخفی
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={14} />
                                                {new Date(page.updatedAt).toLocaleDateString("fa-IR")}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(page)}
                                                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="ویرایش"
                                                >
                                                    <Edit3 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm(page._id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="حذف"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Page Edit/Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingPage ? "ویرایش صفحه" : "ایجاد صفحه جدید"}
                            </h2>
                            <button
                                onClick={closeModal}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-gray-700">
                                        عنوان صفحه *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-vita-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all"
                                        placeholder="مثال: قوانین و مقررات"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-gray-700">
                                        آدرس (slug) *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.slug}
                                        onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-vita-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all font-mono text-sm"
                                        placeholder="مثال: terms"
                                        dir="ltr"
                                    />
                                    <p className="text-xs text-gray-400">آدرس نمایش: /{formData.slug || "..."}</p>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700">
                                    محتوای صفحه
                                </label>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-vita-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all min-h-[200px] resize-y"
                                    placeholder="محتوای HTML یا متن ساده..."
                                />
                                <p className="text-xs text-gray-400">می‌توانید از HTML برای فرمت‌دهی استفاده کنید</p>
                            </div>

                            {/* Status */}
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700">
                                    وضعیت انتشار
                                </label>
                                <div className="flex gap-4">
                                    <label className={`flex items-center gap-3 px-5 py-3 rounded-xl border-2 cursor-pointer transition-all ${formData.status === "published"
                                            ? "border-green-500 bg-green-50"
                                            : "border-gray-200 hover:border-gray-300"
                                        }`}>
                                        <input
                                            type="radio"
                                            name="status"
                                            value="published"
                                            checked={formData.status === "published"}
                                            onChange={() => setFormData({ ...formData, status: "published" })}
                                            className="sr-only"
                                        />
                                        <Eye size={18} className={formData.status === "published" ? "text-green-600" : "text-gray-400"} />
                                        <span className={`font-medium ${formData.status === "published" ? "text-green-700" : "text-gray-600"}`}>
                                            منتشر شده
                                        </span>
                                    </label>
                                    <label className={`flex items-center gap-3 px-5 py-3 rounded-xl border-2 cursor-pointer transition-all ${formData.status === "hidden"
                                            ? "border-gray-500 bg-gray-50"
                                            : "border-gray-200 hover:border-gray-300"
                                        }`}>
                                        <input
                                            type="radio"
                                            name="status"
                                            value="hidden"
                                            checked={formData.status === "hidden"}
                                            onChange={() => setFormData({ ...formData, status: "hidden" })}
                                            className="sr-only"
                                        />
                                        <EyeOff size={18} className={formData.status === "hidden" ? "text-gray-600" : "text-gray-400"} />
                                        <span className={`font-medium ${formData.status === "hidden" ? "text-gray-700" : "text-gray-600"}`}>
                                            مخفی
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* SEO Section */}
                            <div className="border-t border-gray-100 pt-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Globe size={18} className="text-gray-500" />
                                    <h3 className="font-bold text-gray-700">تنظیمات SEO</h3>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-bold text-gray-700">
                                            عنوان متا
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.metaTitle}
                                            onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-vita-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all"
                                            placeholder="عنوان برای موتورهای جستجو"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-bold text-gray-700">
                                            توضیحات متا
                                        </label>
                                        <textarea
                                            value={formData.metaDescription}
                                            onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-vita-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all resize-none"
                                            rows={2}
                                            placeholder="توضیح کوتاه برای موتورهای جستجو"
                                        />
                                    </div>
                                </div>
                            </div>
                        </form>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                            >
                                انصراف
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-vita-500 text-white rounded-xl font-bold hover:bg-vita-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : saveSuccess ? (
                                    <CheckCircle size={18} />
                                ) : (
                                    <Save size={18} />
                                )}
                                {saving ? "در حال ذخیره..." : saveSuccess ? "ذخیره شد!" : "ذخیره صفحه"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 size={32} className="text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">حذف صفحه</h3>
                            <p className="text-gray-500 mb-6">آیا از حذف این صفحه اطمینان دارید؟ این عمل قابل بازگشت نیست.</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 px-6 py-3 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    انصراف
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteConfirm)}
                                    disabled={deleting}
                                    className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {deleting ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Trash2 size={18} />
                                    )}
                                    {deleting ? "در حال حذف..." : "حذف"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
