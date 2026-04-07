"use client";

/**
 * TradePulse — company-wide trade intelligence board
 *
 * Layer 1: ShipmentNetworkView — SVG node map of all active shipments
 *   Nodes grouped by corridor. Size = value band. Color = risk class.
 *   Pulse ring = urgency. Hover tooltip. Click → /shipments/[id].
 *
 * Layer 2: Active Impact Score (per shipment, 0–100)
 *   Transparent 5-factor weighted formula:
 *     1. Value score       0–25  declared_value / max value in dataset
 *     2. Urgency score     0–20  ETA proximity (in_transit only)
 *     3. Delay risk        0–30  operational status (customs_hold=30…)
 *     4. Customs severity  0–25  risk_level field
 *     5. Customer proxy    0–10  `priority` field (high=10, medium=5, low=2)
 *   FALLBACK NOTE: No customer_importance field exists on Shipment.
 *   Factor 5 uses `priority` (set by shipper per shipment) as a proxy for
 *   how operationally critical this load was flagged.
 *
 * Layer 3: Corridor Activity — stacked composition bars + CorridorDetailPanel
 *   Preserved from previous implementation, untouched.
 *
 * Corridor pulse scoring weights (unchanged):
 *   customsHold 15 · criticalRisk 12 · delayed 10 · highRisk 7 · atRisk 5 · urgentArrival 3
 * Level thresholds: critical ≥25 · high ≥15 · medium ≥7 · low ≥1 · clear 0
 */

import { useMemo, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  ShieldAlert,
  Clock,
  AlertTriangle,
  Timer,
  CheckCircle2,
  ArrowRight,
  Package,
  X,
  Zap,
  Radio,
  Newspaper,
  FlaskConical,
  Users,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Shipment } from "@/app/lib/supabase/shipment-types";
import { useTradePulseIntelligence } from "@/app/lib/hooks/useTradePulseIntelligence";
import { generateSparklinePoints } from "@/app/lib/trade-pulse-engine";

// ─── Corridor scoring constants ───────────────────────────────────────────────

const PULSE_WEIGHTS = {
  customsHold:   15,
  criticalRisk:  12,
  delayed:       10,
  highRisk:       7,
  atRisk:         5,
  urgentArrival:  3,
} as const;

const LEVEL_THRESHOLDS = { critical: 25, high: 15, medium: 7, low: 1 } as const;

function scoreToLevel(score: number): CorridorPulse["level"] {
  if (score >= LEVEL_THRESHOLDS.critical) return "critical";
  if (score >= LEVEL_THRESHOLDS.high)     return "high";
  if (score >= LEVEL_THRESHOLDS.medium)   return "medium";
  if (score >= LEVEL_THRESHOLDS.low)      return "low";
  return "clear";
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CorridorPulse = {
  corridor:          string;
  shipmentCount:     number;
  activeCount:       number;
  delayedCount:      number;
  atRiskCount:       number;
  customsHolds:      number;
  criticalRiskCount: number;
  highRiskCount:     number;
  urgentArrivals:    number;
  totalValueUSD:     number;
  pulseScore:        number;
  level:             "critical" | "high" | "medium" | "low" | "clear";
};

type ShipmentClass =
  | "customs" | "critical" | "delayed" | "atRisk" | "high" | "normal" | "inactive";

type NetworkNode = {
  id:         string;
  shipment:   Shipment;
  x:          number;   // SVG coordinate
  y:          number;   // SVG coordinate
  r:          number;   // radius
  color:      string;   // hex fill
  cls:        ShipmentClass;
  score:      number;   // Active Impact Score 0–100
  isUrgent:   boolean;  // shows pulse ring
};

// ─── Corridor pulse transformer (unchanged) ───────────────────────────────────

export function buildCorridorPulse(shipments: Shipment[]): CorridorPulse[] {
  const map = new Map<string, CorridorPulse>();

  for (const s of shipments) {
    if (!map.has(s.corridor)) {
      map.set(s.corridor, {
        corridor: s.corridor, shipmentCount: 0, activeCount: 0,
        delayedCount: 0, atRiskCount: 0, customsHolds: 0,
        criticalRiskCount: 0, highRiskCount: 0, urgentArrivals: 0,
        totalValueUSD: 0, pulseScore: 0, level: "clear",
      });
    }
    const c = map.get(s.corridor)!;
    c.shipmentCount++;
    c.totalValueUSD += s.declared_value ?? 0;
    if (s.status !== "delivered")     c.activeCount++;
    if (s.status === "customs_hold")  c.customsHolds++;
    if (s.status === "delayed")       c.delayedCount++;
    if (s.status === "at_risk")       c.atRiskCount++;
    if (s.risk_level === "critical")  c.criticalRiskCount++;
    if (s.risk_level === "high")      c.highRiskCount++;
    if (s.eta_date && s.status === "in_transit") {
      const d = Math.ceil((new Date(s.eta_date).getTime() - Date.now()) / 86_400_000);
      if (d >= 0 && d <= 3) c.urgentArrivals++;
    }
  }

  for (const c of map.values()) {
    const raw =
      c.customsHolds      * PULSE_WEIGHTS.customsHold  +
      c.criticalRiskCount * PULSE_WEIGHTS.criticalRisk  +
      c.delayedCount      * PULSE_WEIGHTS.delayed       +
      c.highRiskCount     * PULSE_WEIGHTS.highRisk      +
      c.atRiskCount       * PULSE_WEIGHTS.atRisk        +
      c.urgentArrivals    * PULSE_WEIGHTS.urgentArrival;
    c.pulseScore = Math.min(100, raw);
    c.level      = scoreToLevel(c.pulseScore);
  }

  return Array.from(map.values())
    .filter((c) => c.shipmentCount > 0)
    .sort((a, b) => b.pulseScore - a.pulseScore || b.activeCount - a.activeCount);
}

function buildFocusReason(c: CorridorPulse): string {
  const parts: string[] = [];
  if (c.customsHolds      > 0) parts.push(`${c.customsHolds} customs hold${c.customsHolds > 1 ? "s" : ""}`);
  if (c.criticalRiskCount > 0) parts.push(`${c.criticalRiskCount} critical`);
  if (c.delayedCount      > 0) parts.push(`${c.delayedCount} delayed`);
  if (c.highRiskCount     > 0) parts.push(`${c.highRiskCount} high risk`);
  if (c.atRiskCount       > 0) parts.push(`${c.atRiskCount} at risk`);
  if (c.urgentArrivals    > 0) parts.push(`${c.urgentArrivals} arriving soon`);
  return parts.slice(0, 3).join(" · ") || "Monitoring";
}

// ─── Risk classification ──────────────────────────────────────────────────────

const SEG: Record<ShipmentClass, { bg: string; label: string; dot: string }> = {
  customs:  { bg: "bg-red-600",    dot: "bg-red-600",    label: "Customs Hold" },
  critical: { bg: "bg-red-400",    dot: "bg-red-400",    label: "Critical Risk" },
  delayed:  { bg: "bg-orange-500", dot: "bg-orange-500", label: "Delayed" },
  atRisk:   { bg: "bg-amber-400",  dot: "bg-amber-400",  label: "At Risk" },
  high:     { bg: "bg-orange-300", dot: "bg-orange-300", label: "High Risk" },
  normal:   { bg: "bg-blue-400",   dot: "bg-blue-400",   label: "In Transit" },
  inactive: { bg: "bg-gray-200",   dot: "bg-gray-300",   label: "Delivered" },
};

const SEG_ORDER: ShipmentClass[] = [
  "customs", "critical", "delayed", "atRisk", "high", "normal", "inactive",
];

function classifyShipment(s: Shipment): ShipmentClass {
  if (s.status === "customs_hold")  return "customs";
  if (s.risk_level === "critical")  return "critical";
  if (s.status === "delayed")       return "delayed";
  if (s.status === "at_risk")       return "atRisk";
  if (s.risk_level === "high")      return "high";
  if (s.status === "delivered")     return "inactive";
  return "normal";
}

function getDominantRisk(shipments: Shipment[]): string {
  if (shipments.length === 0) return "No data";
  const counts: Partial<Record<ShipmentClass, number>> = {};
  for (const s of shipments) { const c = classifyShipment(s); counts[c] = (counts[c] ?? 0) + 1; }
  for (const cls of SEG_ORDER) {
    if (cls !== "normal" && cls !== "inactive" && (counts[cls] ?? 0) > 0) return SEG[cls].label;
  }
  return "Normal Operations";
}

// ─── Active Impact Score ──────────────────────────────────────────────────────

/**
 * Transparent 5-factor impact score for a single shipment (0–100).
 * maxDeclaredValue: pass Math.max of all declared_values in dataset for normalization.
 *
 * Factor 1 — Value (0–25):    declared_value / dataset max → financial exposure
 * Factor 2 — Urgency (0–20):  ETA proximity for in-transit shipments
 * Factor 3 — Delay risk (0–30): operational status severity
 * Factor 4 — Customs/compliance (0–25): risk_level field
 * Factor 5 — Customer importance proxy (0–10): `priority` field
 *   FALLBACK: Shipment type has no customer_importance field.
 *   `priority` (set per-shipment by the shipper) is used as proxy.
 *   high/urgent = 10 pts, medium = 5 pts, low/other = 2 pts.
 */
function computeImpactScore(s: Shipment, maxDeclaredValue: number): number {
  // 1. Value score
  const valueScore = Math.round(25 * Math.min(1, (s.declared_value ?? 0) / maxDeclaredValue));

  // 2. Urgency score (ETA proximity, in-transit only)
  let urgencyScore = 0;
  if (s.eta_date && s.status === "in_transit") {
    const days = Math.ceil((new Date(s.eta_date).getTime() - Date.now()) / 86_400_000);
    urgencyScore = days <= 0 ? 20 : days <= 1 ? 18 : days <= 3 ? 14 : days <= 7 ? 8 : 2;
  }

  // 3. Delay risk / operational status
  const delayScore =
    s.status === "customs_hold" ? 30 :
    s.status === "delayed"      ? 25 :
    s.status === "at_risk"      ? 15 :
    s.status === "in_transit"   ? 5  : 0;

  // 4. Customs/compliance severity
  const customsScore =
    s.risk_level === "critical" ? 25 :
    s.risk_level === "high"     ? 15 :
    s.risk_level === "medium"   ? 8  :
    s.risk_level === "low"      ? 3  : 0;

  // 5. Customer importance proxy (from `priority` field)
  const importanceScore =
    (s.priority === "high" || s.priority === "urgent") ? 10 :
    s.priority === "medium" ? 5 : 2;

  return Math.min(100, valueScore + urgencyScore + delayScore + customsScore + importanceScore);
}

// ─── Network node layout ──────────────────────────────────────────────────────

const NODE_COLORS: Record<ShipmentClass, string> = {
  customs:  "#dc2626", // red-600
  critical: "#f87171", // red-400
  delayed:  "#f97316", // orange-500
  atRisk:   "#fbbf24", // amber-400
  high:     "#fdba74", // orange-300
  normal:   "#60a5fa", // blue-400
  inactive: "#d1d5db", // gray-300
};

/** Deterministic jitter hash — same shipment id always produces same offset. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}

const CANVAS_W   = 800;
const CANVAS_H   = 230;
const LABEL_H    = 20;
const VPAD       = 12;
const MAX_NODES  = 8; // max nodes shown per corridor lane

function computeNodeLayout(
  shipments:       Shipment[],
  corridorNames:   string[],     // ordered list of corridor names (most critical first)
  nodeScores:      Map<string, number>,
  maxDeclaredValue: number,
): NetworkNode[] {
  const active = shipments.filter((s) => s.status !== "delivered");
  const byCorr = new Map<string, Shipment[]>();
  for (const s of active) {
    const arr = byCorr.get(s.corridor) ?? [];
    arr.push(s);
    byCorr.set(s.corridor, arr);
  }

  const visibleCorr = corridorNames.filter((c) => (byCorr.get(c)?.length ?? 0) > 0);
  if (visibleCorr.length === 0) return [];

  const laneW  = CANVAS_W / visibleCorr.length;
  const usableH = CANVAS_H - LABEL_H - VPAD * 2;

  return visibleCorr.flatMap((corr, ci) => {
    const laneCenterX = ci * laneW + laneW / 2;
    const corrShipments = (byCorr.get(corr) ?? [])
      .sort((a, b) => (nodeScores.get(b.id) ?? 0) - (nodeScores.get(a.id) ?? 0))
      .slice(0, MAX_NODES);

    return corrShipments.map((s, ni) => {
      const jitter = ((hashStr(s.id) % 100) / 100 - 0.5) * laneW * 0.38;
      const x = Math.max(10, Math.min(CANVAS_W - 10, laneCenterX + jitter));
      const yPct = corrShipments.length === 1 ? 0.5 : ni / (corrShipments.length - 1);
      const y = LABEL_H + VPAD + yPct * usableH;

      const valNorm = maxDeclaredValue > 0 ? (s.declared_value ?? 0) / maxDeclaredValue : 0;
      const r = valNorm > 0.6 ? 11 : valNorm > 0.2 ? 8 : 5;

      const cls     = classifyShipment(s);
      const score   = nodeScores.get(s.id) ?? 0;
      const isUrgent = cls === "customs" || cls === "critical" || cls === "delayed";

      return { id: s.id, shipment: s, x, y, r, color: NODE_COLORS[cls], cls, score, isUrgent };
    });
  });
}

// ─── CompositionBar — CSS-only stacked risk bar ───────────────────────────────

function CompositionBar({ shipments }: { shipments: Shipment[] }) {
  if (shipments.length === 0) return <div className="h-2 bg-gray-100 rounded-full" />;

  const counts: Partial<Record<ShipmentClass, number>> = {};
  for (const s of shipments) { const c = classifyShipment(s); counts[c] = (counts[c] ?? 0) + 1; }
  const total = shipments.length;

  return (
    <div className="h-2 rounded-full overflow-hidden flex w-full bg-gray-100">
      {SEG_ORDER.map((cls) => {
        const count = counts[cls] ?? 0;
        if (count === 0) return null;
        return (
          <div
            key={cls}
            className={`h-full ${SEG[cls].bg} transition-all duration-500`}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${SEG[cls].label}: ${count}`}
          />
        );
      })}
    </div>
  );
}

// ─── ShipmentNetworkView ──────────────────────────────────────────────────────

function ShipmentNetworkView({
  shipments,
  corridors,
  nodeScores,
  maxDeclaredValue,
  selectedCorridor,
  onCorridorSelect,
}: {
  shipments:        Shipment[];
  corridors:        CorridorPulse[];
  nodeScores:       Map<string, number>;
  maxDeclaredValue: number;
  selectedCorridor: string;
  onCorridorSelect: (c: string) => void;
}) {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mousePos,  setMousePos]  = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const corridorNames = useMemo(() => corridors.map((c) => c.corridor), [corridors]);

  const nodes = useMemo(
    () => computeNodeLayout(shipments, corridorNames, nodeScores, maxDeclaredValue),
    [shipments, corridorNames, nodeScores, maxDeclaredValue],
  );

  // Which corridors actually have active nodes (ordered same as pulse scoring)
  const activeCorridors = useMemo(() => {
    const activeSet = new Set(nodes.map((n) => n.shipment.corridor));
    return corridors.filter((c) => activeSet.has(c.corridor));
  }, [corridors, nodes]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const hoveredNode = hoveredId ? nodes.find((n) => n.id === hoveredId) : null;

  if (nodes.length === 0) return null;

  const laneW = CANVAS_W / Math.max(activeCorridors.length, 1);

  return (
    <div
      ref={containerRef}
      className="relative px-3 pb-1"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredId(null)}
    >
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1.5">
        Active Shipment Network · {nodes.length} nodes · click any node to open
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
        <svg
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          width="100%"
          style={{ display: "block" }}
          aria-label="Shipment network visualization"
        >
          {/* SVG filter defs for glow on urgent nodes */}
          <defs>
            <filter id="tp-glow-red" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="tp-glow-orange" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Lane separator lines */}
          {activeCorridors.slice(0, -1).map((_, i) => (
            <line
              key={i}
              x1={(i + 1) * laneW} y1={0}
              x2={(i + 1) * laneW} y2={CANVAS_H}
              stroke="#e5e7eb" strokeWidth="1"
            />
          ))}

          {/* Corridor labels + level dots */}
          {activeCorridors.map((c, i) => {
            const lx = i * laneW + laneW / 2;
            const isSelected = selectedCorridor === c.corridor;
            const dotColor =
              c.level === "critical" ? "#dc2626" :
              c.level === "high"     ? "#f97316" :
              c.level === "medium"   ? "#f59e0b" :
              c.level === "low"      ? "#60a5fa" : "#10b981";
            const label = c.corridor.length > 16 ? c.corridor.slice(0, 14) + "…" : c.corridor;
            const textW = label.length * 4.4;

            return (
              <g
                key={c.corridor}
                onClick={() => onCorridorSelect(isSelected ? "all" : c.corridor)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={lx - textW / 2 - 5} cy={11} r={3} fill={dotColor} opacity="0.9" />
                <text
                  x={lx - textW / 2 + 1}
                  y={14}
                  fontSize="8"
                  fontWeight="700"
                  fill={isSelected ? "#1d4ed8" : "#6b7280"}
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {label}
                </text>
                {isSelected && (
                  <rect
                    x={i * laneW + 2} y={0}
                    width={laneW - 4} height={CANVAS_H}
                    fill="#eff6ff" opacity="0.3" rx="4"
                  />
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isHovered     = hoveredId === node.id;
            const corrSelected  = selectedCorridor !== "all";
            const sameCorr      = node.shipment.corridor === selectedCorridor;
            const dimmed        = corrSelected && !sameCorr;
            const filterAttr    =
              node.isUrgent && !dimmed
                ? (node.cls === "customs" || node.cls === "critical"
                    ? "url(#tp-glow-red)"
                    : "url(#tp-glow-orange)")
                : undefined;

            return (
              <g
                key={node.id}
                onClick={() => router.push(`/shipments/${node.id}`)}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Pulse ring — urgent nodes only */}
                {node.isUrgent && !dimmed && (
                  <circle
                    cx={node.x} cy={node.y}
                    r={node.r + 4}
                    fill="none"
                    stroke={node.color}
                    strokeWidth="1.5"
                    opacity="0.3"
                  >
                    <animate attributeName="r"
                      values={`${node.r + 3};${node.r + 9}`}
                      dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity"
                      values="0.35;0"
                      dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Hover selection ring */}
                {isHovered && (
                  <circle
                    cx={node.x} cy={node.y}
                    r={node.r + 5}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    opacity="0.8"
                  />
                )}

                {/* Main node */}
                <circle
                  cx={node.x} cy={node.y}
                  r={node.r}
                  fill={node.color}
                  opacity={dimmed ? 0.18 : 0.88}
                  stroke={isHovered ? "#1d4ed8" : "white"}
                  strokeWidth={isHovered ? 2 : 1}
                  filter={filterAttr}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Floating tooltip */}
      {hoveredId && hoveredNode && (
        <div
          className="absolute z-30 pointer-events-none bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2.5 text-xs"
          style={{
            left:    Math.min(mousePos.x + 14, (containerRef.current?.offsetWidth ?? 400) - 200),
            top:     Math.max(8, mousePos.y - 70),
            minWidth: 190,
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: hoveredNode.color }}
            />
            <span className="font-semibold text-gray-900 truncate">
              {hoveredNode.shipment.shipment_code}
            </span>
          </div>
          <div className="space-y-0.5 text-[11px] text-gray-500">
            <div className="flex justify-between gap-4">
              <span>Corridor</span>
              <span className="text-gray-700 font-medium truncate max-w-27.5">
                {hoveredNode.shipment.corridor}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Value</span>
              <span className="text-gray-700 font-medium">
                ${(hoveredNode.shipment.declared_value ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Status</span>
              <span className="text-gray-700 font-medium">{SEG[hoveredNode.cls].label}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Impact Score</span>
              <span className={`font-bold ${
                hoveredNode.score >= 70 ? "text-red-600" :
                hoveredNode.score >= 40 ? "text-orange-600" : "text-blue-600"
              }`}>
                {hoveredNode.score} / 100
              </span>
            </div>
          </div>
          <div className="mt-1.5 text-[10px] text-blue-600 font-semibold">Click to open detail →</div>
        </div>
      )}

      {/* Network legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 mt-2">
        {(["customs", "critical", "delayed", "atRisk", "high", "normal"] as ShipmentClass[]).map((cls) => {
          const count = nodes.filter((n) => n.cls === cls).length;
          if (count === 0) return null;
          return (
            <div key={cls} className="flex items-center gap-1 text-[10px] text-gray-400">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS[cls] }} />
              <span>{SEG[cls].label}</span>
              <span className="font-semibold text-gray-600">{count}</span>
            </div>
          );
        })}
        <div className="ml-auto text-[10px] text-gray-300 italic">
          size = value · color = risk · ring = urgency
        </div>
      </div>
    </div>
  );
}

// ─── TopPrioritiesPanel ───────────────────────────────────────────────────────

function TopPrioritiesPanel({
  shipments,
  nodeScores,
}: {
  shipments:  Shipment[];
  nodeScores: Map<string, number>;
}) {
  const top5 = useMemo(() => {
    return shipments
      .filter((s) => s.status !== "delivered")
      .map((s) => ({ s, score: nodeScores.get(s.id) ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [shipments, nodeScores]);

  if (top5.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-8 text-center rounded-xl bg-emerald-50/40 border border-emerald-100">
        <CheckCircle2 className="w-7 h-7 text-emerald-400 mb-2" />
        <p className="text-xs font-semibold text-gray-600">All clear</p>
        <p className="text-[11px] text-gray-400 mt-0.5">No high-impact shipments detected.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {top5.map(({ s, score }, i) => {
        const cls  = classifyShipment(s);
        const seg  = SEG[cls];
        const isTopUrgent = score >= 70;
        const isMid       = score >= 40 && score < 70;

        return (
          <Link
            key={s.id}
            href={`/shipments/${s.id}`}
            className="flex items-start gap-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl p-3 transition-colors group"
          >
            {/* Rank */}
            <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${
              isTopUrgent ? "bg-red-100 text-red-700" :
              isMid       ? "bg-orange-100 text-orange-700" :
              "bg-blue-100 text-blue-700"
            }`}>
              {i + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${seg.dot}`} />
                <span className="text-xs font-semibold text-gray-800 truncate">
                  {s.shipment_code}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 truncate">
                {seg.label} · {s.corridor}
              </div>
            </div>

            {/* Score badge */}
            <div className="shrink-0 flex flex-col items-end gap-0.5">
              <span className={`text-xs font-bold tabular-nums ${
                isTopUrgent ? "text-red-600" :
                isMid       ? "text-orange-600" : "text-blue-600"
              }`}>
                {score}
              </span>
              <span className="text-[9px] text-gray-400">score</span>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5 group-hover:text-blue-400 transition-colors" />
          </Link>
        );
      })}

      {/* Score legend */}
      <div className="mt-1 px-1 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <Zap className="w-3 h-3 text-violet-400" />
          Impact = value + urgency + delay risk + compliance + priority
        </div>
      </div>
    </div>
  );
}

// ─── CorridorDetailPanel ──────────────────────────────────────────────────────

function CorridorDetailPanel({
  corridor,
  pulse,
  shipments,
  onClose,
}: {
  corridor:  string;
  pulse:     CorridorPulse | undefined;
  shipments: Shipment[];
  onClose:   () => void;
}) {
  if (!pulse) return null;

  const st       = LEVEL[pulse.level];
  const dominant = getDominantRisk(shipments);

  const counts: Partial<Record<ShipmentClass, number>> = {};
  for (const s of shipments) { const c = classifyShipment(s); counts[c] = (counts[c] ?? 0) + 1; }
  const total = shipments.length;

  const legendItems = SEG_ORDER
    .map((cls) => ({ cls, count: counts[cls] ?? 0 }))
    .filter((s) => s.count > 0);

  const affected = shipments.filter((s) => classifyShipment(s) !== "inactive").slice(0, 6);

  const fmtValue = (v: number) =>
    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` :
    v >= 1_000     ? `$${(v / 1_000).toFixed(0)}K`     : `$${v}`;

  return (
    <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${st.badge}`}>
            {pulse.level.toUpperCase()}
          </span>
          <span className="text-sm font-semibold text-gray-900">{corridor}</span>
          <span className="text-[11px] text-gray-400">— {dominant}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-3">
        {[
          { label: "Total",    value: pulse.shipmentCount,            color: "text-gray-700" },
          { label: "Active",   value: pulse.activeCount,              color: "text-blue-600" },
          { label: "Delayed",  value: pulse.delayedCount,             color: "text-orange-600" },
          { label: "Holds",    value: pulse.customsHolds,             color: "text-red-600" },
          { label: "Critical", value: pulse.criticalRiskCount,        color: "text-red-500" },
          { label: "Value",    value: fmtValue(pulse.totalValueUSD),  color: "text-gray-700", isStr: true },
        ].map(({ label, value, color, isStr }) => (
          <div key={label} className="bg-white rounded-lg px-2.5 py-2 border border-gray-200 text-center">
            <div className={`text-sm font-bold ${color}`}>{isStr ? value : (value as number)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="mb-3">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Risk Composition
        </div>
        <CompositionBar shipments={shipments} />
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {legendItems.map(({ cls, count }) => (
            <div key={cls} className="flex items-center gap-1 text-[10px] text-gray-500">
              <div className={`w-2 h-2 rounded-sm ${SEG[cls].dot}`} />
              <span>{SEG[cls].label}</span>
              <span className="font-semibold text-gray-700">
                {count} ({Math.round((count / total) * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {affected.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Shipments Needing Attention
          </div>
          <div className="flex flex-wrap gap-1.5">
            {affected.map((s) => {
              const cls = classifyShipment(s);
              return (
                <Link
                  key={s.id}
                  href={`/shipments/${s.id}`}
                  className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-gray-700 transition-colors"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${SEG[cls].dot}`} />
                  <span className="font-semibold">{s.shipment_code}</span>
                  <span className="text-gray-400 font-normal">{SEG[cls].label}</span>
                  <ArrowRight className="w-2.5 h-2.5 text-gray-300" />
                </Link>
              );
            })}
            {shipments.filter((s) => classifyShipment(s) !== "inactive").length > 6 && (
              <span className="inline-flex items-center px-2.5 py-1.5 text-[11px] text-gray-400">
                +{shipments.filter((s) => classifyShipment(s) !== "inactive").length - 6} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Level style map ──────────────────────────────────────────────────────────

const LEVEL = {
  critical: {
    border: "border-l-red-500",    bar: "bg-red-500",
    badge:  "bg-red-100 text-red-700 border-red-200",
    text:   "text-red-600",        row: "hover:bg-red-50/40",   icon: ShieldAlert,
  },
  high: {
    border: "border-l-orange-400", bar: "bg-orange-400",
    badge:  "bg-orange-100 text-orange-700 border-orange-200",
    text:   "text-orange-600",     row: "hover:bg-orange-50/40", icon: AlertTriangle,
  },
  medium: {
    border: "border-l-amber-400",  bar: "bg-amber-400",
    badge:  "bg-amber-100 text-amber-700 border-amber-200",
    text:   "text-amber-600",      row: "hover:bg-amber-50/20",  icon: Clock,
  },
  low: {
    border: "border-l-blue-400",   bar: "bg-blue-400",
    badge:  "bg-blue-100 text-blue-700 border-blue-200",
    text:   "text-blue-600",       row: "hover:bg-blue-50/20",   icon: Timer,
  },
  clear: {
    border: "border-l-emerald-400", bar: "bg-emerald-400",
    badge:  "bg-emerald-100 text-emerald-700 border-emerald-200",
    text:   "text-emerald-600",     row: "hover:bg-emerald-50/20", icon: CheckCircle2,
  },
} as const;

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ count, label, variant = "neutral" }: {
  count: number; label: string; variant?: "neutral" | "warn" | "danger" | "info";
}) {
  const cls =
    variant === "danger" ? "bg-red-100 text-red-700 border-red-200" :
    variant === "warn"   ? "bg-orange-100 text-orange-700 border-orange-200" :
    variant === "info"   ? "bg-blue-100 text-blue-700 border-blue-200" :
    "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cls}`}>
      <span className="font-bold">{count}</span>
      <span className="font-normal opacity-70">{label}</span>
    </span>
  );
}

// ─── Feature 1+2: Port Congestion + Anomaly Panel ────────────────────────────

function CongestionAnomalyPanel({
  congestion,
  anomalies,
  loading,
}: {
  congestion: import("@/app/lib/trade-pulse-engine").PortCongestionData[];
  anomalies:  import("@/app/lib/trade-pulse-engine").CorridorAnomaly[];
  loading:    boolean;
}) {
  const [open, setOpen] = useState(false);
  const realAnomalies   = anomalies.filter((a) => a.isAnomaly);

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-semibold text-gray-700">Port Congestion & Anomalies</span>
          {realAnomalies.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
              {realAnomalies.length} anomal{realAnomalies.length > 1 ? "ies" : "y"}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {open && (
        <div className="p-3 grid sm:grid-cols-2 gap-3">
          {/* Port Congestion */}
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Live Port Congestion</div>
            {loading ? (
              <div className="text-xs text-gray-400">Loading…</div>
            ) : congestion.length === 0 ? (
              <div className="text-xs text-gray-400">No data</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {congestion.slice(0, 6).map((p) => (
                  <div key={p.port} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] text-gray-700 truncate">{p.port}</span>
                        <span className={`text-[10px] font-bold ml-1 shrink-0 ${p.score >= 70 ? "text-red-600" : p.score >= 50 ? "text-amber-600" : "text-emerald-600"}`}>
                          {p.score}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.score >= 70 ? "bg-red-400" : p.score >= 50 ? "bg-amber-400" : "bg-emerald-400"}`}
                          style={{ width: `${p.score}%` }}
                        />
                      </div>
                    </div>
                    <div className={`shrink-0 ${p.trend === "rising" ? "text-red-500" : p.trend === "falling" ? "text-emerald-500" : "text-gray-400"}`}>
                      {p.trend === "rising" ? <TrendingUp className="w-3 h-3" /> : p.trend === "falling" ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Anomalies */}
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Corridor Anomalies</div>
            {anomalies.length === 0 ? (
              <div className="text-xs text-gray-400">No anomalies detected</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {anomalies.filter((a) => a.isAnomaly).slice(0, 4).map((a) => (
                  <div key={a.corridor} className={`rounded-lg p-2 text-[11px] ${a.direction === "spike" ? "bg-red-50 border border-red-100" : "bg-emerald-50 border border-emerald-100"}`}>
                    <div className="font-semibold text-gray-800 truncate">{a.corridor}</div>
                    <div className={`${a.direction === "spike" ? "text-red-600" : "text-emerald-600"}`}>
                      {a.direction === "spike" ? "▲" : "▼"} {a.message}
                    </div>
                  </div>
                ))}
                {realAnomalies.length === 0 && (
                  <div className="text-[11px] text-emerald-600 bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                    All corridors within normal range
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Feature 3: News Intelligence Panel ──────────────────────────────────────

function NewsIntelligencePanel({
  signals,
  loading,
}: {
  signals: import("@/app/lib/trade-pulse-engine").NewsSignal[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(true);
  const critical = signals.filter((s) => s.relevance === "critical" || s.relevance === "high");

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-xs font-semibold text-gray-700">Trade Intelligence Feed</span>
          {critical.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
              {critical.length} alert{critical.length > 1 ? "s" : ""}
            </span>
          )}
          {loading && <span className="text-[10px] text-gray-400">refreshing…</span>}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {open && (
        <div className="p-3 flex flex-col gap-2">
          {loading && signals.length === 0 ? (
            <div className="text-xs text-gray-400 py-2">Fetching trade signals…</div>
          ) : signals.length === 0 ? (
            <div className="text-xs text-gray-400 py-2">No signals in the last 72 hours</div>
          ) : (
            signals.slice(0, 4).map((s, i) => {
              const colors = {
                critical: "border-l-red-500 bg-red-50",
                high:     "border-l-orange-400 bg-orange-50",
                medium:   "border-l-amber-400 bg-amber-50",
                low:      "border-l-gray-300 bg-gray-50",
              };
              const labelColors = {
                critical: "text-red-700 bg-red-100",
                high:     "text-orange-700 bg-orange-100",
                medium:   "text-amber-700 bg-amber-100",
                low:      "text-gray-600 bg-gray-100",
              };
              return (
                <div key={i} className={`border-l-2 rounded-r-lg p-2.5 ${colors[s.relevance]}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[11px] font-semibold text-gray-800 leading-tight flex-1">{s.headline}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${labelColors[s.relevance]}`}>
                      {s.relevance}
                    </span>
                  </div>
                  {s.affectedCorridors.length > 0 && (
                    <div className="text-[10px] text-gray-500">
                      Corridors: {s.affectedCorridors.slice(0, 2).join(", ")}
                      {s.affectedShipments.length > 0 && ` · ${s.affectedShipments.length} shipment${s.affectedShipments.length > 1 ? "s" : ""} affected`}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Feature 4: ETA Confidence Panel ─────────────────────────────────────────

function ETAConfidencePanel({
  confidence,
}: {
  confidence: import("@/app/lib/trade-pulse-engine").ETAConfidence[];
}) {
  const [open, setOpen]     = useState(false);
  const highRisk = confidence.filter((c) => c.delayRiskPct >= 40);

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Timer className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-gray-700">Predictive ETA Confidence</span>
          {highRisk.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {highRisk.length} at-risk ETA{highRisk.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {open && (
        <div className="p-3">
          {confidence.length === 0 ? (
            <div className="text-xs text-gray-400">No active shipments with ETAs</div>
          ) : (
            <div className="flex flex-col gap-2">
              {confidence.slice(0, 6).map((c) => (
                <div key={c.shipmentId} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <Link href={`/shipments/${c.shipmentId}`} className="text-[11px] font-bold text-blue-600 hover:underline">
                      {c.shipmentCode}
                    </Link>
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${c.delayRiskPct >= 60 ? "bg-red-400" : c.delayRiskPct >= 40 ? "bg-amber-400" : "bg-emerald-400"}`}
                          style={{ width: `${c.delayRiskPct}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold ${c.delayRiskPct >= 60 ? "text-red-600" : c.delayRiskPct >= 40 ? "text-amber-600" : "text-emerald-600"}`}>
                        {c.delayRiskPct}%
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <div className="text-center bg-emerald-50 rounded p-1">
                      <div className="text-gray-500">P50</div>
                      <div className="font-semibold text-emerald-700">{new Date(c.p50).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                    </div>
                    <div className="text-center bg-amber-50 rounded p-1">
                      <div className="text-gray-500">P75</div>
                      <div className="font-semibold text-amber-700">{new Date(c.p75).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                    </div>
                    <div className="text-center bg-red-50 rounded p-1">
                      <div className="text-gray-500">P90</div>
                      <div className="font-semibold text-red-700">{new Date(c.p90).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1.5 truncate">{c.factors[0]}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Feature 5: Sparkline component ──────────────────────────────────────────

function SparkLine({ history, width = 80, height = 20 }: {
  history: import("@/app/lib/trade-pulse-engine").CorridorScorePoint[];
  width?:  number;
  height?: number;
}) {
  const points = generateSparklinePoints(history, width, height);
  if (!points) return <span className="text-[10px] text-gray-300">—</span>;
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const trend = prev ? (last.score > prev.score ? "up" : last.score < prev.score ? "down" : "flat") : "flat";
  const color = trend === "up" ? "#ef4444" : trend === "down" ? "#10b981" : "#94a3b8";

  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Feature 6: What-If Simulator Panel ──────────────────────────────────────

function WhatIfPanel({
  corridors,
  setWhatIf,
  clearWhatIf,
  result,
}: {
  corridors:  string[];
  setWhatIf:  (c: string, d: number) => void;
  clearWhatIf: () => void;
  result:     import("@/app/lib/trade-pulse-engine").WhatIfScenario | null;
}) {
  const [open,      setOpen]     = useState(false);
  const [corridor,  setCorridor] = useState(corridors[0] ?? "");
  const [delayDays, setDelayDays] = useState(3);

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-cyan-500" />
          <span className="text-xs font-semibold text-gray-700">What-If Delay Simulator</span>
          {result && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
              Active
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {open && (
        <div className="p-3">
          <div className="flex flex-wrap gap-2 mb-3">
            <select
              value={corridor}
              onChange={(e) => setCorridor(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {corridors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-gray-500">+</span>
              <input
                type="number"
                min={-5}
                max={30}
                value={delayDays}
                onChange={(e) => setDelayDays(Number(e.target.value))}
                className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-xs text-gray-500">days</span>
            </div>
            <button
              type="button"
              onClick={() => setWhatIf(corridor, delayDays)}
              className="text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              Simulate
            </button>
            {result && (
              <button type="button" onClick={clearWhatIf} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
                Clear
              </button>
            )}
          </div>

          {result && (
            <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-3 flex flex-col gap-2">
              <div className="text-xs font-semibold text-cyan-800">{result.corridorName} · +{result.delayDaysAdded} days</div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="bg-white rounded-lg p-2 text-center border border-cyan-100">
                  <div className="text-gray-500">Shipments</div>
                  <div className="font-bold text-gray-800">{result.affectedShipments}</div>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-cyan-100">
                  <div className="text-gray-500">Cost Impact</div>
                  <div className="font-bold text-red-600">${(result.costImpactUSD / 1000).toFixed(1)}K</div>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-cyan-100">
                  <div className="text-gray-500">New Score</div>
                  <div className={`font-bold ${result.newScore >= 25 ? "text-red-600" : result.newScore >= 7 ? "text-amber-600" : "text-emerald-600"}`}>
                    {result.newScore}
                  </div>
                </div>
              </div>
              {result.newEtas.slice(0, 3).map((e) => (
                <div key={e.code} className="flex items-center gap-2 text-[10px] text-gray-600">
                  <span className="font-mono font-semibold text-blue-600">{e.code}</span>
                  <span>{new Date(e.original).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  <ArrowRight className="w-2.5 h-2.5 text-red-400" />
                  <span className="text-red-600 font-semibold">{new Date(e.revised).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Feature 7: Supplier Risk Panel ──────────────────────────────────────────

function SupplierRiskPanel({
  nodes,
}: {
  nodes: import("@/app/lib/trade-pulse-engine").SupplierRiskNode[];
}) {
  const [open, setOpen] = useState(false);
  const atRisk = nodes.filter((n) => n.riskLevel === "high" || n.riskLevel === "critical");

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-xs font-semibold text-gray-700">Supplier Risk Propagation</span>
          {atRisk.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
              {atRisk.length} at-risk
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {open && (
        <div className="p-3 flex flex-col gap-1.5">
          {nodes.map((n) => {
            const colors = {
              critical: "border-red-200 bg-red-50",
              high:     "border-orange-200 bg-orange-50",
              medium:   "border-amber-200 bg-amber-50",
              low:      "border-gray-200 bg-gray-50",
            };
            const dotColors = {
              critical: "bg-red-500",
              high:     "bg-orange-500",
              medium:   "bg-amber-500",
              low:      "bg-emerald-500",
            };
            return (
              <div key={n.id} className={`rounded-lg border p-2.5 ${colors[n.riskLevel]}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotColors[n.riskLevel]}`} />
                  <span className="text-[11px] font-semibold text-gray-800 truncate flex-1">{n.name}</span>
                  <span className="text-[9px] font-bold text-gray-500 shrink-0">T{n.tier} · {n.country}</span>
                </div>
                {n.riskFlags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {n.riskFlags.map((f) => (
                      <span key={f} className="text-[9px] font-medium bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                {n.linkedShipmentCodes.length > 0 && (
                  <div className="text-[10px] text-gray-500">
                    Links: {n.linkedShipmentCodes.slice(0, 3).join(", ")}
                    {n.linkedShipmentCodes.length > 3 && ` +${n.linkedShipmentCodes.length - 3} more`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── TradePulse (main export) ─────────────────────────────────────────────────

interface TradePulseProps {
  shipments:         Shipment[];
  loading?:          boolean;
  onCorridorSelect?: (corridor: string) => void;
  selectedCorridor?: string;
}

export default function TradePulse({
  shipments,
  loading           = false,
  onCorridorSelect,
  selectedCorridor  = "all",
}: TradePulseProps) {
  const corridors = useMemo(() => buildCorridorPulse(shipments), [shipments]);

  const corridorShipmentsMap = useMemo(() => {
    const map = new Map<string, Shipment[]>();
    for (const s of shipments) {
      const arr = map.get(s.corridor) ?? [];
      arr.push(s);
      map.set(s.corridor, arr);
    }
    return map;
  }, [shipments]);

  // Pre-compute impact scores for all shipments
  const maxDeclaredValue = useMemo(
    () => Math.max(...shipments.map((s) => s.declared_value ?? 0), 1),
    [shipments],
  );

  const nodeScores = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of shipments) m.set(s.id, computeImpactScore(s, maxDeclaredValue));
    return m;
  }, [shipments, maxDeclaredValue]);

  // Corridor scores as plain Record for intelligence engine
  const corridorScores = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of corridors) m[c.corridor] = c.pulseScore;
    return m;
  }, [corridors]);

  // All 7 advanced intelligence features
  const intelligence = useTradePulseIntelligence(shipments, corridorScores);

  const corridorNames = useMemo(() => corridors.map((c) => c.corridor), [corridors]);

  const topFocus   = corridors.filter((c) => c.pulseScore > 0).slice(0, 3);
  const alertCount = corridors.filter((c) => c.level === "critical" || c.level === "high").length;

  const selectedPulse     = selectedCorridor !== "all" ? corridors.find((c) => c.corridor === selectedCorridor) : undefined;
  const selectedShipments = selectedCorridor !== "all" ? (corridorShipmentsMap.get(selectedCorridor) ?? []) : [];

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gray-100" />
          <div className="h-4 bg-gray-100 rounded w-24" />
        </div>
        <div className="h-48 bg-gray-50 rounded-xl mb-3" />
        {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-50 rounded-xl mb-2" />)}
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────────
  if (shipments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-10 text-center">
        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
          <TrendingUp className="w-5 h-5 text-violet-300" />
        </div>
        <p className="text-sm font-semibold text-gray-400">Trade Pulse activates with shipments</p>
        <p className="text-xs text-gray-300 mt-1">
          Corridor priority signals appear once shipments are tracked.
        </p>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-violet-600" />
          </div>
          <h2 className="font-semibold text-gray-900 text-sm">Trade Pulse</h2>
          <span className="text-[11px] text-gray-400">
            {corridors.length} corridor{corridors.length !== 1 ? "s" : ""} ·{" "}
            {shipments.length} shipment{shipments.length !== 1 ? "s" : ""}
          </span>
        </div>
        {alertCount > 0 ? (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
            {alertCount} corridor{alertCount > 1 ? "s" : ""} need attention
          </span>
        ) : corridors.length > 0 ? (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            All corridors clear
          </span>
        ) : null}
      </div>

      {/* ── Layer 1: Shipment Network View ── */}
      <div className="border-b border-gray-100 py-3">
        <ShipmentNetworkView
          shipments={shipments}
          corridors={corridors}
          nodeScores={nodeScores}
          maxDeclaredValue={maxDeclaredValue}
          selectedCorridor={selectedCorridor}
          onCorridorSelect={onCorridorSelect ?? (() => {})}
        />
      </div>

      {/* ── Layer 2 + 3: Corridor grid + Top Priorities ── */}
      <div className="p-4 grid lg:grid-cols-3 gap-4">

        {/* Corridor Activity (2/3) */}
        <div className="lg:col-span-2 flex flex-col gap-1.5">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-0.5">
            Corridor Activity · Risk Composition
          </div>

          {corridors.map((c) => {
            const st          = LEVEL[c.level];
            const isActive    = selectedCorridor === c.corridor;
            const corrShips   = corridorShipmentsMap.get(c.corridor) ?? [];

            return (
              <button
                key={c.corridor}
                type="button"
                onClick={() => onCorridorSelect?.(isActive ? "all" : c.corridor)}
                className={`w-full text-left flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 rounded-xl border-l-4 bg-gray-50 transition-colors cursor-pointer ${st.border} ${st.row} ${
                  isActive ? "ring-1 ring-blue-400 ring-inset bg-blue-50/30" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-gray-800 truncate">{c.corridor}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${st.badge}`}>
                      {c.level.toUpperCase()}
                    </span>
                    {/* Feature 5: Sparkline */}
                    {(intelligence.scoreHistory[c.corridor]?.length ?? 0) >= 2 && (
                      <SparkLine history={intelligence.scoreHistory[c.corridor]} />
                    )}
                    {/* Feature 2: Anomaly badge */}
                    {intelligence.anomalies.find((a) => a.corridor === c.corridor && a.isAnomaly) && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-orange-100 text-orange-700 shrink-0">
                        ANOMALY
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 shrink-0 ml-auto">
                      score {c.pulseScore}
                    </span>
                  </div>
                  <CompositionBar shipments={corrShips} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <Chip count={c.activeCount} label="active" />
                  {c.delayedCount   > 0 && <Chip count={c.delayedCount}   label="delayed"  variant="warn" />}
                  {c.customsHolds   > 0 && <Chip count={c.customsHolds}   label="holds"    variant="danger" />}
                  {c.urgentArrivals > 0 && <Chip count={c.urgentArrivals} label="arriving" variant="info" />}
                </div>
              </button>
            );
          })}

          {selectedCorridor !== "all" && (
            <button
              type="button"
              onClick={() => onCorridorSelect?.("all")}
              className="text-[11px] text-blue-600 hover:text-blue-700 font-medium mt-1 px-1 text-left"
            >
              ← Clear corridor filter
            </button>
          )}
        </div>

        {/* Top Priorities Now (1/3) */}
        <div className="flex flex-col">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">
            Top Priorities Now
          </div>
          <TopPrioritiesPanel shipments={shipments} nodeScores={nodeScores} />

          {/* Corridor Focus First — show below priorities if corridors need attention */}
          {topFocus.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">
                Corridor Focus
              </div>
              <div className="flex flex-col gap-1.5">
                {topFocus.map((c, i) => {
                  const st = LEVEL[c.level];
                  const Icon = st.icon;
                  const isActive = selectedCorridor === c.corridor;
                  return (
                    <button
                      key={c.corridor}
                      type="button"
                      onClick={() => onCorridorSelect?.(isActive ? "all" : c.corridor)}
                      className={`w-full text-left bg-gray-50 hover:bg-gray-100 rounded-xl p-2.5 transition-colors ${
                        isActive ? "ring-1 ring-blue-400 bg-blue-50/30" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                          c.level === "critical" ? "bg-red-100" :
                          c.level === "high"     ? "bg-orange-100" : "bg-amber-100"
                        }`}>
                          <Icon className={`w-2.5 h-2.5 ${st.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className={`text-[10px] font-bold ${st.text}`}>#{i + 1}</span>
                            <span className="text-[11px] font-semibold text-gray-800 truncate">
                              {c.corridor}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fleet summary */}
          <div className="mt-3 px-1 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Package className="w-3 h-3" />
              {shipments.filter((s) => s.status !== "delivered").length} active ·{" "}
              {corridors.filter((c) => c.level === "clear" || c.level === "low").length} corridors on track
            </div>
          </div>
        </div>
      </div>

      {/* ── Advanced Intelligence Panels (7 features) ── */}
      <div className="border-t border-gray-100 p-4 flex flex-col gap-3">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          Advanced Trade Intelligence
        </div>

        {/* Feature 1 + 2: Port Congestion + Anomaly Detection */}
        <CongestionAnomalyPanel
          congestion={intelligence.portCongestion}
          anomalies={intelligence.anomalies}
          loading={intelligence.congestionLoading}
        />

        {/* Feature 3: News Intelligence */}
        <NewsIntelligencePanel
          signals={intelligence.newsSignals}
          loading={intelligence.newsLoading}
        />

        {/* Feature 4: Predictive ETA Confidence */}
        <ETAConfidencePanel confidence={intelligence.etaConfidence} />

        {/* Feature 6: What-If Simulator */}
        <WhatIfPanel
          corridors={corridorNames}
          setWhatIf={intelligence.setWhatIf}
          clearWhatIf={intelligence.clearWhatIf}
          result={intelligence.whatIfScenario}
        />

        {/* Feature 7: Supplier Risk Propagation */}
        <SupplierRiskPanel nodes={intelligence.supplierNodes} />
      </div>

      {/* ── Corridor Detail Panel ── */}
      {selectedCorridor !== "all" && selectedPulse && (
        <CorridorDetailPanel
          corridor={selectedCorridor}
          pulse={selectedPulse}
          shipments={selectedShipments}
          onClose={() => onCorridorSelect?.("all")}
        />
      )}
    </div>
  );
}
