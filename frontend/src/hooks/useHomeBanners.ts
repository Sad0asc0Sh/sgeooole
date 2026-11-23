"use client";

import useSWR from "swr";
import { bannerService, type Banner } from "@/services/bannerService";

export function useHomeBanners(initialBanners: Banner[] | null) {
  const { data, isLoading } = useSWR<Banner[]>("homepage-banners", bannerService.getAll, {
    fallbackData: initialBanners ?? undefined,
    revalidateOnMount: initialBanners === null,
    revalidateOnFocus: false,
  });
  return { banners: data ?? [], loading: !data && isLoading };
}
