import { type ShipmentStatus } from "@/app/types";
import { clsx } from "clsx";

const statusConfig: Record<ShipmentStatus, { label: string; class: string; dot: string }> = {
  draft: {
    label: "Draft",
    class: "bg-gray-50 text-gray-500 border-gray-200",
    dot: "bg-gray-400",
  },
  booked: {
    label: "Booked",
    class: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  in_transit: {
    label: "In Transit",
    class: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-500 animate-pulse",
  },
  customs: {
    label: "Customs Hold",
    class: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500 animate-pulse",
  },
  customs_hold: {
    label: "Customs Hold",
    class: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500 animate-pulse",
  },
  delivered: {
    label: "Delivered",
    class: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  delayed: {
    label: "Delayed",
    class: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500 animate-pulse",
  },
  at_risk: {
    label: "At Risk",
    class: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500 animate-pulse",
  },
};

interface StatusPillProps {
  status: ShipmentStatus;
  size?: "sm" | "md";
}

export function StatusPill({ status, size = "sm" }: StatusPillProps) {
  const cfg = statusConfig[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 font-medium border rounded-full whitespace-nowrap",
        cfg.class,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      )}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
