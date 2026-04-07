"use client";

/**
 * ShipmentLiveStatus — client-side live status/risk/ETA panel for shipment detail.
 *
 * The detail page is a server component; this wrapper subscribes to Supabase
 * realtime for the specific shipment and shows a live badge + delta feed
 * when anything changes, without requiring a full page refresh.
 */

import { useState } from "react";
import { useShipment } from "@/app/lib/hooks/useShipment";
import { StatusPill } from "@/app/components/ui/StatusPill";
import { Badge } from "@/app/components/ui/Badge";
import type { Shipment } from "@/app/lib/supabase/shipment-types";
import type { ShipmentStatus } from "@/app/types";
import {
  Radio,
  WifiOff,
  Zap,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";

interface Props {
  shipment: Shipment;
}

const FIELD_LABELS: Record<string, string> = {
  status:           "Status",
  risk_level:       "Risk Level",
  eta_date:         "ETA",
  compliance_notes: "Compliance Notes",
  carrier:          "Carrier",
};

function fmt(field: string, val: string): string {
  if (field === "eta_date" && val) {
    return new Date(val).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  return val || "—";
}

export default function ShipmentLiveStatus({ shipment: initial }: Props) {
  const { shipment, liveStatus, deltas, lastUpdatedAt } = useShipment(initial.id, initial, "status");
  const [showDeltas, setShowDeltas] = useState(false);

  const riskLevel = shipment.risk_level as "low" | "medium" | "high" | "critical";
  const hasDeltas  = deltas.length > 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Live status row — always visible */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={shipment.status as ShipmentStatus} size="md" />
        <Badge
          label={riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1) + " Risk"}
          variant={riskLevel}
          dot
        />

        {/* ETA badge */}
        {shipment.eta_date && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3" />
            ETA {new Date(shipment.eta_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        )}

        {/* Realtime indicator */}
        {liveStatus === "live" ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
        ) : liveStatus === "offline" ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
            <WifiOff className="w-3 h-3" />
            OFFLINE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200">
            <Radio className="w-3 h-3 animate-pulse" />
            CONNECTING
          </span>
        )}

        {/* "Just updated" badge + toggle */}
        {hasDeltas && (
          <button
            onClick={() => setShowDeltas((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors"
          >
            <Zap className="w-3 h-3" />
            {deltas.length} update{deltas.length > 1 ? "s" : ""}
            {showDeltas ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>
        )}
      </div>

      {/* Delta feed — expandable */}
      {showDeltas && hasDeltas && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 flex flex-col gap-2">
          <div className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider mb-0.5">
            Live Activity Feed
          </div>
          {deltas.map((d, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 mt-1.5" />
              <div className="flex-1">
                <span className="font-semibold text-violet-900">
                  {FIELD_LABELS[d.field] ?? d.field}
                </span>
                <span className="text-violet-600"> changed: </span>
                <span className="text-gray-500 line-through">{fmt(d.field, d.from)}</span>
                <span className="text-violet-600"> → </span>
                <span className="font-semibold text-gray-900">{fmt(d.field, d.to)}</span>
              </div>
              <span className="text-[10px] text-violet-400 shrink-0">
                {d.at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          ))}
          {lastUpdatedAt && (
            <div className="text-[10px] text-violet-400 mt-1 border-t border-violet-100 pt-1.5">
              Last updated: {lastUpdatedAt.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
