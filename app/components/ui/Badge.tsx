import { type RiskLevel } from "@/app/types";
import { clsx } from "clsx";

interface BadgeProps {
  label: string;
  variant?: RiskLevel | "info" | "neutral" | "success";
  size?: "sm" | "md";
  dot?: boolean;
}

const variantStyles: Record<string, string> = {
  low:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium:   "bg-amber-50 text-amber-700 border-amber-200",
  high:     "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-red-50 text-red-700 border-red-200",
  info:     "bg-blue-50 text-blue-700 border-blue-200",
  success:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  neutral:  "bg-gray-100 text-gray-600 border-gray-200",
};

const dotColors: Record<string, string> = {
  low:      "bg-emerald-500",
  medium:   "bg-amber-500",
  high:     "bg-orange-500",
  critical: "bg-red-500",
  info:     "bg-blue-500",
  success:  "bg-emerald-500",
  neutral:  "bg-gray-400",
};

export function Badge({ label, variant = "neutral", size = "sm", dot = false }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 font-medium border rounded-full",
        variantStyles[variant],
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      )}
    >
      {dot && <span className={clsx("w-1.5 h-1.5 rounded-full", dotColors[variant])} />}
      {label}
    </span>
  );
}
