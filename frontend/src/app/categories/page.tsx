import { permanentRedirect } from "next/navigation";
import { CATEGORY_FILTER_HREF } from "@/lib/categoryNavigation";

export default function CategoriesPage() {
  permanentRedirect(CATEGORY_FILTER_HREF);
}
