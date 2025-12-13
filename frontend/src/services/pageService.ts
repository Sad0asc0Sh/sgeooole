import api from "@/lib/api";

export interface PageData {
    _id: string;
    title: string;
    slug: string;
    content: string;
    status: "published" | "hidden";
    meta?: {
        title?: string;
        description?: string;
    };
    createdAt: string;
    updatedAt: string;
}

export interface PaginatedPages {
    data: PageData[];
    pagination: {
        currentPage: number;
        itemsPerPage: number;
        totalItems: number;
        totalPages: number;
    };
}

export const pageService = {
    // دریافت صفحه با slug (عمومی)
    async getPageBySlug(slug: string): Promise<PageData | null> {
        try {
            const response = await api.get(`/pages/slug/${slug}`);
            return response.data.data;
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null;
            }
            console.error("Error fetching page:", error);
            throw error;
        }
    },

    // لیست صفحات برای ادمین
    async getAdminPages(params?: {
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
    }): Promise<PaginatedPages> {
        const response = await api.get("/pages", { params });
        return response.data;
    },

    // ایجاد صفحه جدید
    async createPage(data: {
        title: string;
        slug?: string;
        content?: string;
        status?: "published" | "hidden";
        meta?: { title?: string; description?: string };
    }): Promise<PageData> {
        const response = await api.post("/pages", data);
        return response.data.data;
    },

    // ویرایش صفحه
    async updatePage(
        id: string,
        data: Partial<{
            title: string;
            slug: string;
            content: string;
            status: "published" | "hidden";
            meta: { title?: string; description?: string };
        }>
    ): Promise<PageData> {
        const response = await api.put(`/pages/${id}`, data);
        return response.data.data;
    },

    // حذف صفحه
    async deletePage(id: string): Promise<void> {
        await api.delete(`/pages/${id}`);
    },
};
