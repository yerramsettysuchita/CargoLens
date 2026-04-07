"use client";

/**
 * useShipments — realtime-aware shipments hook
 *
 * Strategy:
 *  1. Initial fetch on mount.
 *  2. Subscribe to Supabase postgres_changes for live INSERT/UPDATE/DELETE.
 *     Requires the `shipments` table to be added to the supabase_realtime
 *     publication in the Supabase project (Dashboard → Database → Replication).
 *  3. If the subscription cannot establish (CHANNEL_ERROR / CLOSED), fall back
 *     to a 30-second polling interval and expose `realtimeStatus = "polling"`.
 *
 * Delta tracking:
 *  - On every UPDATE, compares new vs previous record for TRACKED_FIELDS.
 *  - Exposes `recentlyUpdated: Map<id, { at, changedFields }>`.
 *  - Entries auto-expire after 30 seconds (cleanup runs every 5s).
 */

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/app/lib/supabase/client";
import type { Shipment } from "@/app/lib/supabase/shipment-types";

export type RealtimeStatus = "connecting" | "live" | "polling" | "offline";

export type ShipmentDelta = {
  at:            number;
  changedFields: string[];
};

// Fields we care about for the "just updated" visual indicator
const TRACKED_FIELDS: (keyof Shipment)[] = [
  "status", "risk_level", "eta_date", "compliance_notes",
];

export function useShipments() {
  const [shipments,      setShipments]      = useState<Shipment[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [recentlyUpdated, setRecentlyUpdated] = useState<Map<string, ShipmentDelta>>(new Map());

  // Mutable ref: always holds the latest snapshot keyed by id.
  // Used inside the subscription callback to detect field-level deltas
  // without stale closure issues.
  const prevRef  = useRef<Map<string, Shipment>>(new Map());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef   = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async function fetchAll() {
    const supabase = createClient();
    const { data } = await supabase
      .from("shipments")
      .select("*")
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Shipment[];
    // Sync prev ref on full reload
    prevRef.current = new Map(rows.map((s) => [s.id, s]));
    setShipments(rows);
    setLoading(false);
  }

  function startPolling() {
    if (pollTimerRef.current) return;
    setRealtimeStatus("polling");
    pollTimerRef.current = setInterval(fetchAll, 30_000);
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function markUpdated(id: string, changedFields: string[]) {
    if (changedFields.length === 0) return;
    setRecentlyUpdated((prev) => {
      const next = new Map(prev);
      next.set(id, { at: Date.now(), changedFields });
      return next;
    });
  }

  // ─── Subscription ─────────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();

    // 1. Initial load
    fetchAll();

    // 2. Realtime subscription
    const channel = supabase
      .channel("shipments-realtime-v2")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shipments" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const inserted = payload.new as Shipment;
            prevRef.current.set(inserted.id, inserted);
            setShipments((prev) => [inserted, ...prev]);
            markUpdated(inserted.id, ["new"]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Shipment;
            const prev    = prevRef.current.get(updated.id);
            const changed = prev
              ? TRACKED_FIELDS.filter((f) => prev[f] !== updated[f]).map(String)
              : [];
            prevRef.current.set(updated.id, updated);
            setShipments((s) => s.map((x) => (x.id === updated.id ? updated : x)));
            markUpdated(updated.id, changed);
          } else if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            prevRef.current.delete(id);
            setShipments((s) => s.filter((x) => x.id !== id));
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("live");
          stopPolling();
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setRealtimeStatus("offline");
          startPolling();
        }
      });

    channelRef.current = channel;

    // 3. Auto-expire recentlyUpdated entries after 30s (cleanup every 5s)
    const cleanupTimer = setInterval(() => {
      setRecentlyUpdated((prev) => {
        if (prev.size === 0) return prev;
        const now  = Date.now();
        const next = new Map(prev);
        for (const [id, delta] of next) {
          if (now - delta.at > 30_000) next.delete(id);
        }
        return next.size === prev.size ? prev : next; // avoid re-render if nothing changed
      });
    }, 5_000);

    return () => {
      supabase.removeChannel(channel);
      stopPolling();
      clearInterval(cleanupTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeShipment(id: string) {
    prevRef.current.delete(id);
    setShipments((s) => s.filter((x) => x.id !== id));
  }

  return { shipments, loading, realtimeStatus, recentlyUpdated, removeShipment };
}
