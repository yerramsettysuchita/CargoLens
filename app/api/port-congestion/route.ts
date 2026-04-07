// ─── Port Congestion API — IMF PortWatch ──────────────────────────────────────
// Fetches real-time port waiting times from the IMF PortWatch platform.
// Source: https://portwatch.imf.org  (public, no API key required)
// Data:   ArcGIS Feature Service — weekly aggregated vessel AIS data
// Cache:  ISR 1 hour (revalidate = 3600)
//
// Response shape: { ports: Record<string, PortWatchEntry>, source, fetchedAt }
// "ports" is keyed by lowercased port name for easy matching on the client.

import { NextResponse } from "next/server";
import type { PortWatchEntry, PortCongestionAPIResponse } from "@/app/lib/port-watch-types";

export const revalidate = 3600; // re-fetch from PortWatch at most once per hour

// Re-export so existing code that imports from this route still works
export type { PortWatchEntry, PortCongestionAPIResponse };

// ─── IMF PortWatch ArcGIS Feature Service endpoint ────────────────────────────
const PORTWATCH_URL =
  "https://portwatch.imf.org/arcgis/rest/services/PortWatch/PortStatisticsWeekly/FeatureServer/0/query";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Piecewise linear map: waiting time (days) → 0–100 congestion score
// Calibrated so that:
//   0 d  → 0    | 0.5 d → 20   | 1 d → 40
//   2 d  → 60   | 4 d   → 78   | 7 d → 92   | 10+ d → 100
function waitDaysToScore(days: number): number {
  if (days <= 0)   return 0;
  if (days <= 0.5) return Math.round(days * 40);
  if (days <= 1)   return Math.round(20 + (days - 0.5) * 40);
  if (days <= 2)   return Math.round(40 + (days - 1) * 20);
  if (days <= 4)   return Math.round(60 + (days - 2) * 9);
  if (days <= 7)   return Math.round(78 + (days - 4) * 4.67);
  if (days <= 10)  return Math.round(92 + (days - 7) * 2.67);
  return 100;
}

function scoreToRisk(s: number): PortWatchEntry["riskLevel"] {
  if (s >= 75) return "severe";
  if (s >= 55) return "high";
  if (s >= 35) return "moderate";
  return "low";
}

// Safely read a field trying common ArcGIS field-name casings
function field(attrs: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (attrs[k] !== undefined && attrs[k] !== null) return attrs[k];
  }
  return undefined;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const params = new URLSearchParams({
      where:             "1=1",
      outFields:         "*",
      orderByFields:     "date DESC",
      resultRecordCount: "1000",
      f:                 "json",
    });

    const res = await fetch(`${PORTWATCH_URL}?${params}`, {
      headers: { Accept: "application/json" },
      // Next.js fetch cache — respected by ISR
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error(`IMF PortWatch returned HTTP ${res.status}`);

    const json = await res.json();

    if (!json.features || !Array.isArray(json.features)) {
      throw new Error("Unexpected PortWatch payload — missing features array");
    }

    const ports: Record<string, PortWatchEntry> = {};
    const seen  = new Set<string>();

    for (const feature of json.features as Array<{ attributes: Record<string, unknown> }>) {
      const a = feature.attributes ?? feature;

      const portId   = String(field(a, "portid",   "PORTID",   "PortID",   "port_id")   ?? "").trim();
      const portName = String(field(a, "portname", "PORTNAME", "PortName", "port_name") ?? portId).trim();

      if (!portName || seen.has(portName.toLowerCase())) continue;
      seen.add(portName.toLowerCase());

      const waitRaw  = field(a, "waiting_time",  "WAITING_TIME",  "WaitingTime",  "wait_time");
      const callsRaw = field(a, "n_portcalls",   "N_PORTCALLS",   "PortCalls",    "vessel_calls");
      const dateRaw  = field(a, "date",          "DATE",          "week",         "week_date");

      const waitDays = typeof waitRaw === "number"
        ? waitRaw : parseFloat(String(waitRaw ?? 0)) || 0;
      const calls    = typeof callsRaw === "number"
        ? callsRaw : parseInt(String(callsRaw ?? 0), 10) || 0;

      const score = waitDaysToScore(Math.max(0, waitDays));

      ports[portName.toLowerCase()] = {
        portId,
        portName,
        waitingTimeDays: Math.round(waitDays * 10) / 10,
        vesselCalls:     calls,
        congestionScore: score,
        riskLevel:       scoreToRisk(score),
        observedDate:    String(dateRaw ?? ""),
      };
    }

    const response: PortCongestionAPIResponse = {
      ports,
      source:    "imf_portwatch",
      fetchedAt: new Date().toISOString(),
      count:     Object.keys(ports).length,
    };
    return NextResponse.json(response);

  } catch (err) {
    console.error("[port-congestion] IMF PortWatch fetch failed:", String(err));
    return NextResponse.json({
      ports:     {},
      source:    "unavailable",
      fetchedAt: new Date().toISOString(),
      count:     0,
      error:     String(err),
    } satisfies PortCongestionAPIResponse, { status: 200 }); // 200 so client falls back gracefully
  }
}
