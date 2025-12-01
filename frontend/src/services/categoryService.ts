import api from "@/lib/api";

export interface CategoryImage {
  url: string;
  public_id: string;
}

export interface Category {
  _id: string;
  name: string;
  parent?: string | null;
  description?: string;
  icon?: CategoryImage | null;
  image?: CategoryImage | null;
  isFeatured: boolean;
  isPopular: boolean;
  slug: string;
  order: number;
  isActive: boolean;
  children?: Category[]; // For tree structure
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryTreeResponse {
  success: boolean;
  data: Category[];
  count: number;
}

export interface CategoryResponse {
  success: boolean;
  data: Category[];
  count: number;
}

export interface SingleCategoryResponse {
  success: boolean;
  data: Category;
}

export const categoryService = {
  /**
   * Get all categories in a tree structure (hierarchical)
   * This includes parent-child relationships
   */
  getTree: async (): Promise<Category[]> => {
    const { data } = await api.get<CategoryTreeResponse>("/categories/tree");
    return data.data;
  },

  /**
   * Get popular categories (flat list)
   */
  getPopular: async (): Promise<Category[]> => {
    const { data } = await api.get<CategoryResponse>(`/categories?isPopular=true&_t=${Date.now()}`);
    return data.data;
  },

  /**
   * Get featured categories (flat list)
   */
  getFeatured: async (): Promise<Category[]> => {
    const { data } = await api.get<CategoryResponse>(`/categories?isFeatured=true&_t=${Date.now()}`);
    return data.data;
  },

  /**
   * Get all categories (flat list)
   */
  getAll: async (params?: {
    limit?: number;
    fields?: string;
    parent?: string | null;
    isFeatured?: boolean;
    isPopular?: boolean;
  }): Promise<Category[]> => {
    const queryParams = new URLSearchParams();

    if (params) {
      if (params.limit) queryParams.set("limit", params.limit.toString());
      if (params.fields) queryParams.set("fields", params.fields);
      if (params.parent !== undefined) queryParams.set("parent", params.parent === null ? "null" : params.parent);
      if (params.isFeatured !== undefined) queryParams.set("isFeatured", params.isFeatured.toString());
      if (params.isPopular !== undefined) queryParams.set("isPopular", params.isPopular.toString());
    }

    const { data } = await api.get<CategoryResponse>(`/categories?${queryParams.toString()}`);
    return data.data;
  },

  /**
   * Get root categories only (categories without parent)
   */
  getRootCategories: async (): Promise<Category[]> => {
    const { data } = await api.get<CategoryResponse>("/categories?parent=null");
    return data.data;
  },

  /**
   * Get a single category by ID
   */
  getById: async (id: string): Promise<Category> => {
    const { data } = await api.get<SingleCategoryResponse>(`/categories/${id}`);
    return data.data;
  },

  /**
   * Get children of a specific category
   */
  getChildren: async (parentId: string): Promise<Category[]> => {
    const { data } = await api.get<CategoryResponse>(`/categories?parent=${parentId}`);
    return data.data;
  },
};
