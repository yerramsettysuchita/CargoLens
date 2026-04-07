"use client";

import { useMemo, useEffect, useState } from "react";
import {
  Ship, Package, Calendar, DollarSign, Weight, Leaf,
  FileCheck, AlertTriangle, ShieldAlert,
  CheckCircle2, AlertCircle, Hash, CreditCard, Activity, Wifi,
} from "lucide-react";
import { useShipment }           from "@/app/lib/hooks/useShipment";
import { validateShipment }      from "@/app/lib/document-validation";
import { runSanctionsCheck }     from "@/app/lib/sanctions-check";
import { predictCongestion, applyPortWatchOverride } from "@/app/lib/congestion";
import { predictDelay }          from "@/app/lib/delay-prediction";
import type { Shipment }         from "@/app/lib/supabase/shipment-types";
import type { PortCongestionAPIResponse, PortWatchEntry } from "@/app/lib/port-watch-types";

interface Props { initial: Shipment }

// ── Live badge ────────────────────────────────────────────────────────────────
function LiveBadge({ status }: { status: "connecting" | "live" | "offline" }) {
  if (status === "live")
    return (
      <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Live
      </span>
    );
  if (status === "offline")
    return (
      <span className="flex items-center gap-1 text-[10px] text-red-500 font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Offline
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[10px] text-gray-400 font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse" />
      Connecting
    </span>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width="52" height="52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#F3F4F6" strokeWidth="4" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 26 26)"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text x="26" y="31" textAnchor="middle" fontSize="12" fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({
  icon: Icon, title, badge, headerColor, children,
}: {
  icon: React.ElementType;
  title: string;
  badge?: React.ReactNode;
  headerColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 ${headerColor ?? "bg-gray-50"}`}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        {badge}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

// ── Detail row (label left, value right) ──────────────────────────────────────
function DetailRow({
  icon: Icon, label, value, highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string | undefined | null;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 px-1 rounded-lg ${highlight ? "bg-emerald-50" : ""}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon className="w-3 h-3 text-gray-300 shrink-0" />
        <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">{label}</span>
      </div>
      <span className={`text-[11px] font-semibold ml-3 text-right truncate max-w-[55%] ${
        highlight ? "text-emerald-700" : "text-gray-800"
      }`}>
        {value || "—"}
      </span>
    </div>
  );
}

// ── Mini bar ──────────────────────────────────────────────────────────────────
function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveIntelligenceSidebar({ initial }: Props) {
  const { shipment, liveStatus, deltas, lastUpdatedAt } = useShipment(initial.id, initial, "sidebar");

  const validation      = useMemo(() => validateShipment(shipment),  [shipment]);
  const sanctions       = useMemo(() => runSanctionsCheck(shipment), [shipment]);
  const baseCongestion  = useMemo(() => predictCongestion(shipment), [shipment]);
  const delay           = useMemo(() => predictDelay(shipment),      [shipment]);

  // ── IMF PortWatch real-time congestion ──────────────────────────────────────
  type PWSource = "loading" | "live" | "estimated";
  const [portWatchEntry, setPortWatchEntry] = useState<PortWatchEntry | null>(null);
  const [pwSource,       setPwSource]       = useState<PWSource>("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res  = await fetch("/api/port-congestion");
        const data = (await res.json()) as PortCongestionAPIResponse;
        if (cancelled) return;

        if (data.source !== "imf_portwatch" || Object.keys(data.ports).length === 0) {
          setPwSource("estimated"); return;
        }

        // Try to match origin port, then destination port
        const candidates = [shipment.origin_port, shipment.destination_port]
          .filter(Boolean)
          .map(p => p!.toLowerCase().trim());

        let match: PortWatchEntry | null = null;

        for (const candidate of candidates) {
          // 1. Exact key match
          if (data.ports[candidate]) { match = data.ports[candidate]; break; }

          // 2. Partial match — our name contains PortWatch name or vice-versa
          for (const [key, entry] of Object.entries(data.ports)) {
            const parts = candidate.split(/[/,\s]+/).filter(p => p.length > 3);
            if (
              key.includes(candidate) || candidate.includes(key) ||
              parts.some(p => key.includes(p))
            ) { match = entry; break; }
          }
          if (match) break;
        }

        if (match) { setPortWatchEntry(match); setPwSource("live"); }
        else        setPwSource("estimated");

      } catch {
        if (!cancelled) setPwSource("estimated");
      }
    }
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipment.origin_port, shipment.destination_port]);

  // Merge real data into congestion result when available
  const congestion = useMemo(() => {
    if (portWatchEntry && pwSource === "live") {
      return applyPortWatchOverride(
        baseCongestion,
        portWatchEntry.waitingTimeDays,
        portWatchEntry.vesselCalls,
        portWatchEntry.portName,
      );
    }
    return baseCongestion;
  }, [baseCongestion, portWatchEntry, pwSource]);

  const sinceMs  = lastUpdatedAt ? Date.now() - lastUpdatedAt.getTime() : null;
  const sinceStr = sinceMs !== null
    ? sinceMs < 60_000       ? "just now"
    : sinceMs < 3_600_000   ? `${Math.floor(sinceMs / 60_000)}m ago`
    : `${Math.floor(sinceMs / 3_600_000)}h ago`
    : null;

  const isChanged = (label: string) =>
    deltas.some((d) => ({ eta_date: "Est. Arrival", carrier: "Carrier", status: "Status" }[d.field] === label));

  // Congestion colour helpers
  const cBorder = congestion.riskLevel === "severe"   ? "border-red-200"
                : congestion.riskLevel === "high"     ? "border-orange-200"
                : congestion.riskLevel === "moderate" ? "border-amber-200"
                : "border-emerald-200";
  const cBadgeBg = congestion.riskLevel === "severe"   ? "bg-red-100 text-red-700"
                 : congestion.riskLevel === "high"     ? "bg-orange-100 text-orange-700"
                 : congestion.riskLevel === "moderate" ? "bg-amber-100 text-amber-700"
                 : "bg-emerald-100 text-emerald-700";
  const cBarColor = congestion.riskLevel === "severe"   ? "bg-red-500"
                  : congestion.riskLevel === "high"     ? "bg-orange-500"
                  : congestion.riskLevel === "moderate" ? "bg-amber-500"
                  : "bg-emerald-500";

  return (
    <div className="flex flex-col gap-3">

      {/* ── Live update banner ─────────────────────────────────────────────── */}
      {deltas.length > 0 && lastUpdatedAt && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs font-semibold text-emerald-800">Updated {sinceStr}</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {deltas.slice(0, 2).map((d, i) => (
              <span key={i} className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-mono">
                {d.field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Delay alert ────────────────────────────────────────────────────── */}
      {delay.risk !== "none" && delay.risk !== "low" && (
        <div className={`rounded-xl px-4 py-3.5 border ${
          delay.risk === "critical" ? "bg-red-50 border-red-200"
          : delay.risk === "high"  ? "bg-orange-50 border-orange-200"
          : "bg-amber-50 border-amber-200"
        }`}>
          <div className={`flex items-center gap-2 mb-2 text-xs font-bold ${
            delay.risk === "critical" ? "text-red-800"
            : delay.risk === "high"  ? "text-orange-800" : "text-amber-800"
          }`}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Delay Risk: {delay.risk.toUpperCase()} · Est. +{delay.estimatedDelayDays} days
          </div>
          <ul className="space-y-1 mb-2">
            {delay.reasons.map((r, i) => (
              <li key={i} className="text-[11px] text-gray-700 flex items-start gap-1.5">
                <span className="text-gray-300 shrink-0 mt-0.5">•</span>{r}
              </li>
            ))}
          </ul>
          <p className="text-[11px] font-semibold text-gray-700 border-t border-black/5 pt-2">
            {delay.recommendation}
          </p>
        </div>
      )}

      {/* ── Shipment Details ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Shipment Details</h3>
          </div>
          <LiveBadge status={liveStatus} />
        </div>
        <div className="px-3 py-2 divide-y divide-gray-50">
          <DetailRow icon={Ship}       label="Carrier"      value={shipment.carrier ?? shipment.shipment_mode} highlight={isChanged("Carrier")} />
          <DetailRow icon={Package}    label="Mode"         value={shipment.shipment_mode} />
          <DetailRow icon={Package}    label="Category"     value={shipment.cargo_category} />
          <DetailRow icon={Weight}     label="Weight"       value={`${(shipment.weight ?? 0).toLocaleString()} kg`} />
          <DetailRow icon={DollarSign} label="Cargo Value"  value={`${(shipment.declared_value ?? 0).toLocaleString()} ${shipment.currency ?? "USD"}`} />
          <DetailRow icon={Calendar}   label="Dispatch"     value={shipment.expected_dispatch_date
            ? new Date(shipment.expected_dispatch_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "TBC"} />
          <DetailRow icon={Calendar}   label="Est. Arrival" value={shipment.eta_date
            ? new Date(shipment.eta_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "TBC"} highlight={isChanged("Est. Arrival")} />
          <DetailRow icon={Leaf}       label="Carbon"       value={shipment.carbon_kg ? `${(shipment.carbon_kg / 1000).toFixed(2)} tCO₂e` : "N/A"} />
          <DetailRow icon={Hash}       label="HS Code"      value={shipment.hs_code} />
          <DetailRow icon={CreditCard} label="Incoterm"     value={shipment.incoterm} />
        </div>
      </div>

      {/* ── Customs Readiness ──────────────────────────────────────────────── */}
      <div className={`bg-white rounded-xl border overflow-hidden ${
        validation.isValid ? "border-emerald-200" : "border-amber-200"
      }`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${
          validation.isValid ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"
        }`}>
          <div className="flex items-center gap-2">
            {validation.isValid
              ? <FileCheck className="w-4 h-4 text-emerald-600" />
              : <AlertTriangle className="w-4 h-4 text-amber-600" />}
            <h3 className="text-sm font-semibold text-gray-900">Customs Readiness</h3>
          </div>
          <LiveBadge status={liveStatus} />
        </div>
        <div className="px-4 py-3">
          {/* Score row */}
          <div className="flex items-center gap-3 mb-3">
            <ScoreRing
              score={validation.score}
              color={validation.score >= 80 ? "#10b981" : validation.score >= 60 ? "#f59e0b" : "#ef4444"}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800 mb-0.5">{validation.score}/100</p>
              <p className="text-[11px] text-gray-500 leading-relaxed">{validation.summary}</p>
            </div>
          </div>
          {/* Issues */}
          {validation.issues.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {validation.issues.slice(0, 3).map((issue, i) => (
                <div key={i} className={`text-[11px] rounded-lg px-3 py-2 flex items-start gap-2 leading-snug ${
                  issue.severity === "error"   ? "bg-red-50 text-red-700 border border-red-100"
                  : issue.severity === "warning" ? "bg-amber-50 text-amber-700 border border-amber-100"
                  : "bg-blue-50 text-blue-600 border border-blue-100"
                }`}>
                  <span className="shrink-0 mt-0.5">
                    {issue.severity === "error" ? "✗" : issue.severity === "warning" ? "⚠" : "ℹ"}
                  </span>
                  {issue.message}
                </div>
              ))}
              {validation.issues.length > 3 && (
                <p className="text-[10px] text-gray-400 pl-1">+{validation.issues.length - 3} more to review</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Compliance Notes ───────────────────────────────────────────────── */}
      {shipment.compliance_notes && (
        <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-blue-100 bg-blue-50">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">Compliance Notes</h3>
            </div>
            <LiveBadge status={liveStatus} />
          </div>
          <div className="px-4 py-3">
            {/* Split compliance notes into bullet points */}
            {shipment.compliance_notes.includes("—") || shipment.compliance_notes.includes(".") ? (
              <ul className="space-y-1.5">
                {shipment.compliance_notes
                  .split(/[.—]/)
                  .map(s => s.trim())
                  .filter(Boolean)
                  .map((note, i) => (
                    <li key={i} className="text-[11px] text-gray-700 flex items-start gap-1.5 leading-snug">
                      <span className="text-blue-400 shrink-0 mt-0.5">•</span>
                      {note}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-[11px] text-gray-700 leading-relaxed">{shipment.compliance_notes}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Sanctions Screening ────────────────────────────────────────────── */}
      {sanctions.riskScore > 0 && (
        <div className={`bg-white rounded-xl border overflow-hidden ${
          sanctions.riskLevel === "critical" || sanctions.riskLevel === "high"
            ? "border-red-200" : sanctions.riskLevel === "medium"
            ? "border-amber-200" : "border-gray-200"
        }`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${
            sanctions.riskLevel === "critical" || sanctions.riskLevel === "high"
              ? "bg-red-50 border-red-100" : sanctions.riskLevel === "medium"
              ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-100"
          }`}>
            <div className="flex items-center gap-2">
              <ShieldAlert className={`w-4 h-4 ${
                sanctions.riskLevel === "critical" || sanctions.riskLevel === "high"
                  ? "text-red-600" : sanctions.riskLevel === "medium"
                  ? "text-amber-600" : "text-gray-500"
              }`} />
              <h3 className="text-sm font-semibold text-gray-900">Sanctions</h3>
            </div>
            <div className="flex items-center gap-2">
              <LiveBadge status={liveStatus} />
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                sanctions.riskLevel === "critical" ? "bg-red-100 text-red-700"
                : sanctions.riskLevel === "high"   ? "bg-orange-100 text-orange-700"
                : sanctions.riskLevel === "medium" ? "bg-amber-100 text-amber-700"
                : "bg-gray-100 text-gray-600"
              }`}>
                {sanctions.riskLevel.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="px-4 py-3 flex flex-col gap-1.5">
            {sanctions.flags.slice(0, 3).map((flag, i) => (
              <div key={i} className={`text-[11px] rounded-lg px-3 py-2 flex items-start gap-2 leading-snug ${
                flag.severity === "critical" ? "bg-red-50 text-red-700 border border-red-100"
                : flag.severity === "warning" ? "bg-amber-50 text-amber-700 border border-amber-100"
                : "bg-blue-50 text-blue-600 border border-blue-100"
              }`}>
                <span className="shrink-0 mt-0.5">{flag.severity === "critical" ? "✗" : "⚠"}</span>
                {flag.message}
              </div>
            ))}
            {sanctions.flags.length > 3 && (
              <p className="text-[10px] text-gray-400">+{sanctions.flags.length - 3} more flags</p>
            )}
            <p className="text-[11px] text-gray-700 font-semibold leading-relaxed border-t border-gray-100 pt-2 mt-1">
              {sanctions.recommendation}
            </p>
          </div>
        </div>
      )}

      {/* ── Port Congestion ────────────────────────────────────────────────── */}
      <div className={`bg-white rounded-xl border overflow-hidden ${cBorder}`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${
          congestion.riskLevel === "severe"   ? "bg-red-50 border-red-100"
          : congestion.riskLevel === "high"   ? "bg-orange-50 border-orange-100"
          : congestion.riskLevel === "moderate" ? "bg-amber-50 border-amber-100"
          : "bg-emerald-50 border-emerald-100"
        }`}>
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${
              congestion.riskLevel === "severe"   ? "text-red-500"
              : congestion.riskLevel === "high"   ? "text-orange-500"
              : congestion.riskLevel === "moderate" ? "text-amber-500"
              : "text-emerald-500"
            }`} />
            <h3 className="text-sm font-semibold text-gray-900">Port Congestion</h3>
            {/* IMF PortWatch data source indicator — only shown when live */}
            {pwSource === "live" && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                <Wifi className="w-2.5 h-2.5" /> IMF PortWatch
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <LiveBadge status={liveStatus} />
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cBadgeBg}`}>
              {congestion.riskLevel.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3">
          {/* Live waiting time (shown only when IMF PortWatch data is available) */}
          {pwSource === "live" && portWatchEntry && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
              <div>
                <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide mb-0.5">Avg Anchorage Wait</p>
                <p className="text-lg font-bold text-blue-700">{portWatchEntry.waitingTimeDays.toFixed(1)} <span className="text-sm font-normal">days</span></p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-blue-400 mb-0.5">Vessel calls</p>
                <p className="text-sm font-bold text-blue-600">{portWatchEntry.vesselCalls > 0 ? portWatchEntry.vesselCalls : "—"}</p>
              </div>
            </div>
          )}

          {/* Score bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Congestion Score</span>
              <span className="text-[11px] font-bold text-gray-700">{congestion.congestionScore}/100</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${cBarColor}`}
                   style={{ width: `${congestion.congestionScore}%` }} />
            </div>
          </div>

          {/* P50 / P75 / P90 */}
          {congestion.likelyDelayDays > 0 && (
            <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg py-2.5">
              {[
                { label: "P50", value: congestion.delayDistribution.p50 },
                { label: "P75", value: congestion.delayDistribution.p75 },
                { label: "P90", value: congestion.delayDistribution.p90 },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-sm font-bold text-gray-800">+{value}d</p>
                  <p className="text-[10px] text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Signal factors */}
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2">Signal Factors</p>
            <div className="flex flex-col gap-1.5">
              {([
                ["Infrastructure", congestion.factorBreakdown.infrastructure],
                ["Utilization",    congestion.factorBreakdown.utilization],
                ["Geopolitical",   congestion.factorBreakdown.geopolitical],
                ["Seasonal",       congestion.factorBreakdown.seasonal],
                ["Carrier",        congestion.factorBreakdown.carrier],
                ["Cargo Type",     congestion.factorBreakdown.cargoType],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-20 shrink-0">{label}</span>
                  <MiniBar value={val} color={
                    val >= 70 ? "bg-red-400" : val >= 50 ? "bg-orange-400"
                    : val >= 30 ? "bg-amber-400" : "bg-emerald-400"
                  } />
                  <span className="text-[10px] text-gray-600 w-5 text-right font-semibold">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active disruptions */}
          {congestion.activeDisruptions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {congestion.activeDisruptions.map((d, i) => (
                <span key={i} className="text-[10px] bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-medium">
                  {d}
                </span>
              ))}
            </div>
          )}

          {/* Signals */}
          {congestion.signals.slice(0, 2).map((sig, i) => (
            <p key={i} className="text-[11px] text-gray-600 flex items-start gap-1.5 leading-snug">
              <span className="text-gray-300 shrink-0 mt-0.5">•</span>{sig}
            </p>
          ))}

          <p className="text-[11px] text-gray-700 font-semibold leading-snug">{congestion.recommendation}</p>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-[10px] text-gray-400">
              {congestion.carrierReliabilityPct !== null
                ? `Carrier reliability: ${congestion.carrierReliabilityPct}%`
                : "Carrier data inferred"}
            </span>
            <span className={`text-[10px] font-semibold ${
              congestion.confidenceLevel === "high"   ? "text-emerald-600"
              : congestion.confidenceLevel === "medium" ? "text-amber-600"
              : "text-gray-400"
            }`}>
              {congestion.confidenceLevel.toUpperCase()} conf.
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
