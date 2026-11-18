import { Sparkles } from "lucide-react";
import type { RoomCategory } from "@chatty/shared";
import { CATEGORY_ICONS } from "./categoryIcons";

/** The icon for a stored category; old or unknown values fall back to General's. */
export function CategoryIcon({
  category,
  className,
}: {
  category: string | undefined;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category as RoomCategory] ?? Sparkles;
  return <Icon className={className} />;
}
