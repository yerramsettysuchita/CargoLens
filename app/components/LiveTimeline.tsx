"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/app/lib/supabase/client";
import { CheckCircle2, Circle, Loader2, Zap, Clock } from "lucide-react";
import type { Shipment } from "@/app/lib/supabase/shipment-types";

interface TimelineEvent {
  id:           string;
  event_type:   string;
  event_label:  string;
  location:     string;
  status:       "completed" | "active" | "pending";
  occurred_at:  string | null;
  isNew?:       boolean;
}

interface Props {
  shipmentId:    string;
  initialEvents: TimelineEvent[];
  shipment:      Shipment;
}

export default function LiveTimeline({ shipmentId, initialEvents, shipment }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`timeline-${shipmentId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "shipment_events",
        filter: `shipment_id=eq.${shipmentId}`,
      }, (payload) => {
        const ev = payload.new as TimelineEvent;
        setEvents((prev) => {
          if (prev.find((e) => e.id === ev.id)) return prev;
          return [...prev, ev];
        });
        setNewIds((s) => new Set([...s, ev.id]));
        setTimeout(() => {
          setNewIds((s) => { const n = new Set(s); n.delete(ev.id); return n; });
        }, 4000);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public",
        table: "shipment_events",
        filter: `shipment_id=eq.${shipmentId}`,
      }, (payload) => {
        const updated = payload.new as TimelineEvent;
        setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shipmentId]);

  const completed = events.filter((e) => e.status === "completed").length;
  const progressPct = events.length > 0 ? Math.round((completed / events.length) * 100) : 0;

  return (
    <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Shipment Timeline</h2>
          {events.length > 0 && (
            <>
              <div className="h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{progressPct}% complete</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-emerald-600 font-semibold">Live</span>
        </div>
      </div>

      <div className="flex-1 p-5 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Clock className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500 mb-1">No events yet</p>
            <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
              Events will appear here in real time as your shipment progresses through booking confirmation,
              port departure, customs clearance, and delivery.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
              <Zap className="w-3.5 h-3.5" />
              New events stream instantly via Supabase Realtime
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-5 top-6 bottom-4 w-0.5 bg-gray-100" />

            <div className="flex flex-col gap-0">
              {events.map((event, idx) => {
                const isCompleted = event.status === "completed";
                const isActive    = event.status === "active";
                const isNew       = newIds.has(event.id);
                const isLast      = idx === events.length - 1;

                return (
                  <div
                    key={event.id}
                    className={`relative flex gap-4 transition-all duration-500 ${
                      isLast ? "pb-0" : "pb-4"
                    } ${isNew ? "bg-emerald-50/60 -mx-3 px-3 rounded-xl" : ""}`}
                  >
                    {/* Icon */}
                    <div className="relative z-10 shrink-0 mt-1">
                      {isCompleted ? (
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 bg-white rounded-full" />
                      ) : isActive ? (
                        <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                        </div>
                      ) : (
                        <Circle className="w-8 h-8 text-gray-200 bg-white rounded-full" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className={`text-sm font-semibold flex items-center gap-2 ${
                            isCompleted ? "text-gray-900"
                            : isActive   ? "text-blue-700"
                            : "text-gray-400"
                          }`}>
                            {event.event_label}
                            {isNew && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full animate-pulse">
                                NEW
                              </span>
                            )}
                          </div>
                          {event.location && (
                            <p className="text-xs text-gray-400 mt-0.5">{event.location}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          {event.occurred_at ? (
                            <span className={`text-xs font-medium ${
                              isActive ? "text-blue-500" : isCompleted ? "text-gray-500" : "text-gray-300"
                            }`}>
                              {isActive || isCompleted
                                ? new Date(event.occurred_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                                : `Est. ${new Date(event.occurred_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                              }
                            </span>
                          ) : (
                            <span className="text-xs text-gray-200">TBC</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
