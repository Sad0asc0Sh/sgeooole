import api from "@/lib/api";

export interface BannerImage {
  url: string;
  public_id?: string;
  width?: number;
  height?: number;
}

export interface Banner {
  _id: string;
  title: string;
  link: string;
  image?: BannerImage | string | null;
  position: "main-slider" | "middle-banner" | "campaign-banner";
  sortOrder: number;
  isActive: boolean;
}

export const bannerService = {
  getAll: async () => {
    const { data } = await api.get("/banners?isActive=true&sort=sortOrder");
    return data.data;
  },
  getByPosition: async (position: string) => {
    const { data } = await api.get(
      `/banners?isActive=true&position=${position}&sort=sortOrder`,
    );
    return data.data;
  },
};
