import api from "@/lib/api";

export interface Review {
    _id: string;
    user: {
        _id: string;
        name: string;
    };
    product: string | {
        _id: string;
        name: string;
        slug: string;
        images: Array<{ url: string; alt?: string }>;
        price: number;
        finalPrice?: number;
        discount?: number;
    };
    rating: number;
    comment: string;
    isApproved: boolean;
    adminReply?: {
        message: string;
        repliedAt: string;
    };
    createdAt: string;
}

export interface ReviewResponse {
    success: boolean;
    data: Review[];
    pagination: {
        page: number;
        pages: number;
        total: number;
        totalItems?: number;
    };
}

export const reviewService = {
    getProductReviews: async (productId: string, page = 1, limit = 10) => {
        const { data } = await api.get<ReviewResponse>(`/reviews/product/${productId}?page=${page}&limit=${limit}`);
        return data;
    },

    addReview: async (productId: string, rating: number, comment: string) => {
        const { data } = await api.post(`/reviews/${productId}`, { rating, comment });
        return data;
    },

    // Get current user's reviews
    getUserReviews: async (page = 1, limit = 20) => {
        const { data } = await api.get<ReviewResponse>(`/reviews/user/my-reviews?page=${page}&limit=${limit}`);
        return data;
    },

    // Admin Methods
    getAllReviews: async (page = 1, limit = 20, isApproved?: boolean) => {
        let url = `/reviews/admin?page=${page}&limit=${limit}`;
        if (isApproved !== undefined) {
            url += `&isApproved=${isApproved}`;
        }
        const { data } = await api.get(url);
        return data;
    },

    updateStatus: async (reviewId: string, isApproved: boolean) => {
        const { data } = await api.put(`/reviews/${reviewId}/status`, { isApproved });
        return data;
    },

    deleteReview: async (reviewId: string) => {
        const { data } = await api.delete(`/reviews/${reviewId}`);
        return data;
    },

    replyToReview: async (reviewId: string, message: string) => {
        const { data } = await api.put(`/reviews/${reviewId}/reply`, { replyMessage: message });
        return data;
    }
};

