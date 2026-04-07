"use client";

// ─── Route Optimization Panel ─────────────────────────────────────────────────
// Client component: wraps RouteMap + comparison table. Calls optimizeRoutes()
// with the shipment data, lets user toggle between route options.

import { useState, useMemo } from "react";
import {
  Ship, Plane, Train, GitBranch,
  Clock, DollarSign, Leaf, Shield,
  Star, ChevronDown, ChevronUp, AlertTriangle, Info,
} from "lucide-react";
import RouteMap from "./RouteMap";
import { optimizeRoutes, getPortCoords } from "@/app/lib/route-optimizer";
import type { OptimizedRoute } from "@/app/lib/route-optimizer";
import type { Shipment } from "@/app/lib/supabase/shipment-types";

const MODE_ICONS: Record<string, React.ReactNode> = {
  sea:        <Ship  className="w-3.5 h-3.5" />,
  air:        <Plane className="w-3.5 h-3.5" />,
  rail:       <Train className="w-3.5 h-3.5" />,
  multimodal: <GitBranch className="w-3.5 h-3.5" />,
};

const MODE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  sea:        { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200" },
  air:        { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200" },
  rail:       { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  multimodal: { bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200" },
};

const ROUTE_DOT_COLORS: Record<string, string> = {
  sea_standard: "#38bdf8",
  sea_alt:      "#818cf8",
  air_express:  "#fb923c",
  rail:         "#4ade80",
  multimodal:   "#f472b6",
};

function formatCost(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000)     return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd}`;
}

function formatCarbon(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} tCO₂e`;
  return `${kg} kg CO₂e`;
}

// ─── Mini metric bar ──────────────────────────────────────────────────────────

function MetricBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.round(Math.min(100, (value / max) * 100));
  return (
    <div className="h-1 bg-gray-100 rounded-full overflow-hidden w-full">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RouteOptimizationPanel({ shipment }: { shipment: Shipment }) {
  const result = useMemo(() => optimizeRoutes(shipment), [shipment]);
  const [selectedId, setSelectedId] = useState(result.recommended.id);
  const [expanded, setExpanded] = useState(false);

  const selectedRoute = result.routes.find((r) => r.id === selectedId) ?? result.recommended;

  const originCoords = getPortCoords(shipment.origin_port)
    ?? { lat: 20, lon: 73 };
  const destCoords   = getPortCoords(shipment.destination_port)
    ?? { lat: 52, lon: 4 };

  // Relative values for comparison bars
  const maxCost    = Math.max(...result.routes.map((r) => r.totalCostUSD));
  const maxDays    = Math.max(...result.routes.map((r) => r.transitDays));
  const maxCarbon  = Math.max(...result.routes.map((r) => r.carbonKgCO2e));
  const maxRisk    = Math.max(...result.routes.map((r) => r.riskScore));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-gray-900">Route Optimization</h2>
          <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium px-2 py-0.5 rounded-full">
            {result.routes.length} options
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Recommended route teaser */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-[11px] text-gray-400">Recommended:</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
              <span className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: ROUTE_DOT_COLORS[result.recommended.id] }} />
              {result.recommended.name}
            </span>
            <span className="text-[11px] text-gray-400">·</span>
            <span className="text-[11px] text-gray-600">{result.recommended.transitDays}d</span>
            <span className="text-[11px] text-gray-400">·</span>
            <span className="text-[11px] text-gray-600">{formatCost(result.recommended.totalCostUSD)}</span>
          </div>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="p-5">
          {/* Map */}
          <RouteMap
            originPort={shipment.origin_port}
            destPort={shipment.destination_port}
            originLat={originCoords.lat}
            originLon={originCoords.lon}
            destLat={destCoords.lat}
            destLon={destCoords.lon}
            routes={result.routes}
            selectedRouteId={selectedId}
            onSelectRoute={setSelectedId}
            className="h-52 mb-4"
          />

          {/* Alert banner */}
          {result.alert && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-4 text-xs text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
              {result.alert}
            </div>
          )}

          {/* Route option cards */}
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {result.routes.map((route) => {
              const modeColor = MODE_COLORS[route.mode] ?? MODE_COLORS.sea;
              const dotColor  = ROUTE_DOT_COLORS[route.id] ?? "#94a3b8";
              const isSelected = route.id === selectedId;

              return (
                <button
                  key={route.id}
                  onClick={() => setSelectedId(route.id)}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    isSelected
                      ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200 shadow-sm"
                      : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30"
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                      <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${modeColor.bg} ${modeColor.text} border ${modeColor.border}`}>
                        {MODE_ICONS[route.mode]}
                        {route.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {route.isRecommended && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                          <Star className="w-2.5 h-2.5" /> Best
                        </span>
                      )}
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                        route.score >= 75 ? "bg-emerald-100 text-emerald-700"
                        : route.score >= 55 ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-600"
                      }`}>
                        {route.score}pts
                      </span>
                    </div>
                  </div>

                  {/* Route via */}
                  <p className="text-[10px] text-gray-400 font-mono mb-3">{route.via}</p>

                  {/* 4 key metrics grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Clock className="w-2.5 h-2.5 text-gray-400" />
                        <span className="text-[10px] text-gray-400">Transit</span>
                      </div>
                      <p className="text-xs font-bold text-gray-900">{route.transitDays}d</p>
                      <MetricBar value={route.transitDays} max={maxDays} color="bg-blue-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <DollarSign className="w-2.5 h-2.5 text-gray-400" />
                        <span className="text-[10px] text-gray-400">Cost</span>
                      </div>
                      <p className="text-xs font-bold text-gray-900">{formatCost(route.totalCostUSD)}</p>
                      <MetricBar value={route.totalCostUSD} max={maxCost} color="bg-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Leaf className="w-2.5 h-2.5 text-gray-400" />
                        <span className="text-[10px] text-gray-400">Carbon</span>
                      </div>
                      <p className="text-xs font-bold text-gray-900">{formatCarbon(route.carbonKgCO2e)}</p>
                      <MetricBar value={route.carbonKgCO2e} max={maxCarbon} color="bg-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Shield className="w-2.5 h-2.5 text-gray-400" />
                        <span className="text-[10px] text-gray-400">Reliability</span>
                      </div>
                      <p className="text-xs font-bold text-gray-900">{route.scheduleReliabilityPct}%</p>
                      <MetricBar value={route.scheduleReliabilityPct} max={100} color="bg-violet-400" />
                    </div>
                  </div>

                  {/* Recommendation reason */}
                  <p className="text-[11px] text-gray-600 leading-relaxed">{route.recommendation}</p>
                </button>
              );
            })}
          </div>

          {/* Selected route detail */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ROUTE_DOT_COLORS[selectedRoute.id] }} />
              <h3 className="text-sm font-semibold text-gray-900">{selectedRoute.name}</h3>
              <span className="text-xs text-gray-400 font-mono">via {selectedRoute.carrier}</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-3">
              {/* Highlights */}
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1.5">Route Highlights</p>
                <div className="flex flex-col gap-1">
                  {selectedRoute.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-gray-700">
                      <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                      {h}
                    </div>
                  ))}
                </div>
              </div>

              {/* Warnings */}
              {selectedRoute.warnings.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1.5">Considerations</p>
                  <div className="flex flex-col gap-1">
                    {selectedRoute.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700">
                        <Info className="w-2.5 h-2.5 shrink-0 mt-0.5" />
                        {w}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Waypoints */}
            <div className="flex items-center gap-1 flex-wrap">
              {selectedRoute.waypoints.map((wp, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    wp.type === "origin"          ? "bg-blue-100 text-blue-700"
                    : wp.type === "destination"   ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-600"
                  }`}>
                    {wp.port}
                  </span>
                  {i < selectedRoute.waypoints.length - 1 && (
                    <span className="text-gray-300 text-xs">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Compliance note */}
          {result.complianceNote && (
            <div className="mt-3 flex items-start gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2.5 text-[11px] text-violet-800">
              <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-violet-500" />
              {result.complianceNote}
            </div>
          )}

          {/* Priority note */}
          <p className="mt-3 text-[10px] text-gray-400 text-right">
            Optimized for <span className="font-semibold text-gray-600">{result.priorityApplied}</span> priority
            · Scores: cost {Math.round(100/5)}% · time {Math.round(100/5)}% · carbon {Math.round(100/5)}% · reliability {Math.round(100/5)}% · risk {Math.round(100/5)}%
          </p>
        </div>
      )}
    </div>
  );
}
