"use client";

/**
 * useShipment — live subscription for a single shipment.
 *
 * Accepts the initial server-rendered shipment and subscribes to Supabase
 * UPDATE events for that specific row. Detects field-level changes and exposes
 * a `deltas` list so the UI can show what changed and when.
 *
 * Note: Supabase's postgres_changes UPDATE payload includes `old` only when
 * the table has REPLICA IDENTITY FULL enabled. We keep the previous value in a
 * ref to always produce accurate deltas regardless.
 */

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/app/lib/supabase/client";
import type { Shipment } from "@/app/lib/supabase/shipment-types";

export type LiveDelta = {
  field:  string;
  from:   string;
  to:     string;
  at:     Date;
};

export type LiveStatus = "connecting" | "live" | "offline";

const WATCHED_FIELDS: (keyof Shipment)[] = [
  "status", "risk_level", "eta_date", "compliance_notes", "carrier",
];

export function useShipment(id: string, initial: Shipment, channelSuffix = "main") {
  const [shipment,      setShipment]      = useState<Shipment>(initial);
  const [liveStatus,    setLiveStatus]    = useState<LiveStatus>("connecting");
  const [deltas,        setDeltas]        = useState<LiveDelta[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const prevRef = useRef<Shipment>(initial);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`shipment-detail-${id}-${channelSuffix}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "shipments",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const updated = payload.new as Shipment;
          const prev    = prevRef.current;

          const newDeltas: LiveDelta[] = WATCHED_FIELDS
            .filter((f) => prev[f] !== updated[f])
            .map((f) => ({
              field: String(f),
              from:  String(prev[f]  ?? ""),
              to:    String(updated[f] ?? ""),
              at:    new Date(),
            }));

          prevRef.current = updated;
          setShipment(updated);
          setLastUpdatedAt(new Date());

          if (newDeltas.length > 0) {
            setDeltas((d) => [...newDeltas, ...d].slice(0, 20)); // keep last 20 deltas
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveStatus("live");
        else if (status === "CLOSED" || status === "CHANNEL_ERROR") setLiveStatus("offline");
      });

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  return { shipment, liveStatus, deltas, lastUpdatedAt };
}
