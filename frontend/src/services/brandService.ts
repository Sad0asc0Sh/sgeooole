import api from "@/lib/api";

export interface BrandLogo {
    url: string;
    public_id: string;
}

export interface Brand {
    _id: string;
    name: string;
    slug: string;
    description?: string;
    logo?: BrandLogo | null;
    showOnHomepage: boolean;
    displayOrder: number;
    textColor: string;
    hoverColor: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface HomepageBrand {
    _id: string;
    name: string;
    slug: string;
    logo?: BrandLogo | null;
    textColor: string;
    hoverColor: string;
    displayOrder: number;
}

export interface BrandResponse {
    success: boolean;
    data: Brand[];
    count: number;
}

export interface HomepageBrandResponse {
    success: boolean;
    data: HomepageBrand[];
    count: number;
}

export interface SingleBrandResponse {
    success: boolean;
    data: Brand;
}

export const brandService = {
    /**
     * Get all brands
     */
    getAll: async (params?: {
        limit?: number;
        fields?: string;
    }): Promise<Brand[]> => {
        const queryParams = new URLSearchParams();

        if (params) {
            if (params.limit) queryParams.set("limit", params.limit.toString());
            if (params.fields) queryParams.set("fields", params.fields);
        }

        const { data } = await api.get<BrandResponse>(`/brands?${queryParams.toString()}`);
        return data.data;
    },

    /**
     * Get brands for homepage display
     * Only returns brands with showOnHomepage = true
     */
    getHomepageBrands: async (): Promise<HomepageBrand[]> => {
        const { data } = await api.get<HomepageBrandResponse>("/brands/homepage");
        return data.data;
    },

    /**
     * Get a single brand by ID
     */
    getById: async (id: string): Promise<Brand> => {
        const { data } = await api.get<SingleBrandResponse>(`/brands/${id}`);
        return data.data;
    },

    /**
     * Get a single brand by slug
     */
    getBySlug: async (slug: string): Promise<Brand> => {
        const { data } = await api.get<SingleBrandResponse>(`/brands/slug/${slug}`);
        return data.data;
    },
};
