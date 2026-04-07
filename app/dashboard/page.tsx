"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Leaf,
  ArrowRight,
  ExternalLink,
  Bell,
  CheckCircle,
  Percent,
  Globe,
  Languages,
  ChevronDown,
  Search,
  MapPin,
  ShieldAlert,
  Timer,
  Radio,
  WifiOff,
  Calculator,
  Pencil,
  Trash2,
} from "lucide-react";
import { Navbar } from "@/app/components/Navbar";
import { StatusPill } from "@/app/components/ui/StatusPill";
import { Badge } from "@/app/components/ui/Badge";
import { currencies } from "@/app/lib/seed-data";
import type { Shipment } from "@/app/lib/supabase/shipment-types";
import type { ShipmentStatus } from "@/app/types";
import { getHighRiskShipments } from "@/app/lib/delay-prediction";
import { getCorridorCongestionOverview } from "@/app/lib/congestion";
import { useShipments, type RealtimeStatus } from "@/app/lib/hooks/useShipments";
import { useFxRates } from "@/app/lib/hooks/useFxRates";
import TradePulse from "@/app/components/TradePulse";
import { createClient } from "@/app/lib/supabase/client";

// ─── Live status indicator ────────────────────────────────────────────────────

function LiveIndicator({ status }: { status: RealtimeStatus }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        LIVE
      </span>
    );
  }
  if (status === "polling") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
        <Radio className="w-3 h-3" />
        POLLING
      </span>
    );
  }
  if (status === "offline") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
        <WifiOff className="w-3 h-3" />
        OFFLINE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse" />
      CONNECTING
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const CORRIDORS = [
  { id: "all",                  label: "All" },
  { id: "India → EU",           label: "India → EU" },
  { id: "India → US",           label: "India → US" },
  { id: "UAE → East Africa",    label: "UAE → E. Africa" },
  { id: "SE Asia → Europe",     label: "SE Asia → EU" },
  { id: "China → Middle East",  label: "China → ME" },
  { id: "Europe → Africa",      label: "Europe → Africa" },
  { id: "India → UK",           label: "India → UK" },
];

const LANGUAGES = [
  { code: "en", label: "EN", name: "English" },
  { code: "hi", label: "हि", name: "Hindi" },
  { code: "ar", label: "ع",  name: "Arabic" },
];

export default function DashboardPage() {
  const [activeCorridor, setActiveCorridor] = useState("all");
  const [currency, setCurrency] = useState("USD");
  const [lang, setLang] = useState("en");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const { shipments: allShipments, loading, realtimeStatus, recentlyUpdated, removeShipment } = useShipments();
  const { convert: fxConvert, source: fxSource, updatedAt: fxUpdatedAt } = useFxRates();
  const tableRef = useRef<HTMLDivElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string, code: string) {
    if (!window.confirm(`Delete shipment ${code}? This cannot be undone.`)) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("shipment_events").delete().eq("shipment_id", id);
    const { error } = await supabase.from("shipments").delete().eq("id", id);
    setDeletingId(null);
    if (!error) removeShipment(id);
  }

  const handleCorridorSelect = useCallback((corridor: string) => {
    setActiveCorridor(corridor);
    if (corridor !== "all") {
      setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }, []);

  const visibleShipments = useMemo(() => {
    let s = allShipments;
    if (activeCorridor !== "all") s = s.filter((x) => x.corridor === activeCorridor);
    if (statusFilter !== "all") s = s.filter((x) => x.status === statusFilter);
    if (riskFilter !== "all") s = s.filter((x) => x.risk_level === riskFilter);
    if (modeFilter !== "all") s = s.filter((x) => x.shipment_mode === modeFilter);
    if (q) {
      const lq = q.toLowerCase();
      s = s.filter(
        (x) =>
          x.shipment_code.toLowerCase().includes(lq) ||
          x.shipper_company.toLowerCase().includes(lq) ||
          x.origin_port.toLowerCase().includes(lq) ||
          x.destination_port.toLowerCase().includes(lq) ||
          x.corridor.toLowerCase().includes(lq)
      );
    }
    return s;
  }, [allShipments, activeCorridor, statusFilter, riskFilter, modeFilter, q]);

  const riskAlerts = useMemo(() => getHighRiskShipments(allShipments), [allShipments]);

  // Merged alert feed: delay predictions + customs holds + urgent arrivals
  const [expandedAlertId,     setExpandedAlertId]     = useState<string | null>(null);
  const [expandedCongestion,  setExpandedCongestion]  = useState<string | null>(null);

  const liveAlerts = useMemo(() => {
    type AlertEntry = {
      id:          string;
      severity:    "critical" | "high" | "medium";
      icon:        "customs" | "delay" | "risk" | "arrival";
      code:        string;
      title:       string;
      sub:         string;
      shipmentId:  string;
      description: string;
      action:      string;
      carrier:     string | null;
      corridor:    string;
      eta:         string | null;
      value:       number;
      riskLevel:   string;
    };
    const alerts: AlertEntry[] = [];

    allShipments.forEach((s) => {
      if (s.status === "customs_hold") {
        alerts.push({
          id: `customs-${s.id}`, severity: "critical", icon: "customs",
          code: s.shipment_code,
          title: `Customs Hold · ${s.destination_country}`,
          sub: `${s.cargo_category} · ${s.corridor}`,
          shipmentId: s.id,
          description: `This shipment is held at ${s.destination_port ?? s.destination_country} customs. Authorities may require additional documentation, re-inspection, or duty payment before release. Every day on hold accumulates demurrage charges.`,
          action: "Submit missing documents immediately. Contact your customs broker to check hold reason. Prepare proof of origin and HS code classification.",
          carrier: s.carrier, corridor: s.corridor, eta: s.eta_date, value: s.declared_value ?? 0, riskLevel: s.risk_level,
        });
        return;
      }
      if (s.status === "delayed") {
        const daysLate = s.eta_date ? Math.max(0, Math.ceil((Date.now() - new Date(s.eta_date).getTime()) / 86_400_000)) : 0;
        alerts.push({
          id: `delay-${s.id}`, severity: "high", icon: "delay",
          code: s.shipment_code,
          title: "Delay Confirmed",
          sub: `${s.cargo_category} · ${s.corridor}`,
          shipmentId: s.id,
          description: `Shipment is confirmed delayed${daysLate > 0 ? ` by approximately ${daysLate} day${daysLate > 1 ? "s" : ""}` : ""}. Carrier ${s.carrier ?? "unknown"} has reported a disruption on the ${s.corridor} corridor. This may be due to port congestion, vessel schedule changes, or route disruptions.`,
          action: "Contact carrier for revised ETA. Notify consignee of delay. Check if alternate routing is available via carbon reroute tool.",
          carrier: s.carrier, corridor: s.corridor, eta: s.eta_date, value: s.declared_value ?? 0, riskLevel: s.risk_level,
        });
        return;
      }
      if (s.status === "at_risk") {
        alerts.push({
          id: `atrisk-${s.id}`, severity: "medium", icon: "delay",
          code: s.shipment_code,
          title: "At Risk of Delay",
          sub: `${s.cargo_category} · ${s.corridor}`,
          shipmentId: s.id,
          description: `This shipment is flagged as at risk based on corridor conditions, port congestion signals, or carrier reliability on the ${s.corridor} route. No delay confirmed yet but proactive monitoring is recommended.`,
          action: "Monitor shipment status daily. Pre-alert consignee of potential delay. Run tariff simulation if re-routing becomes necessary.",
          carrier: s.carrier, corridor: s.corridor, eta: s.eta_date, value: s.declared_value ?? 0, riskLevel: s.risk_level,
        });
        return;
      }
      if ((s.risk_level === "critical" || s.risk_level === "high") && s.status !== "delivered") {
        alerts.push({
          id: `risk-${s.id}`, severity: s.risk_level as "critical" | "high", icon: "risk",
          code: s.shipment_code,
          title: `${s.risk_level.charAt(0).toUpperCase() + s.risk_level.slice(1)} Risk Detected`,
          sub: `${s.cargo_category} · ${s.corridor}`,
          shipmentId: s.id,
          description: `Automated risk screening has flagged this shipment as ${s.risk_level} risk. This may indicate sanctions exposure, restricted HS code classification, compliance gaps, or elevated corridor risk on the ${s.corridor} route.`,
          action: "Review sanctions screening results on the shipment detail page. Verify HS code classification. Check OFAC, UFLPA, and corridor-specific compliance flags.",
          carrier: s.carrier, corridor: s.corridor, eta: s.eta_date, value: s.declared_value ?? 0, riskLevel: s.risk_level,
        });
        return;
      }
      if (s.eta_date && s.status === "in_transit") {
        const daysLeft = Math.ceil((new Date(s.eta_date).getTime() - Date.now()) / 86_400_000);
        if (daysLeft >= 0 && daysLeft <= 3) {
          alerts.push({
            id: `arrival-${s.id}`, severity: "medium", icon: "arrival",
            code: s.shipment_code,
            title: daysLeft === 0 ? "Arriving Today" : `Arriving in ${daysLeft}d`,
            sub: `${s.destination_port} · ${s.cargo_category}`,
            shipmentId: s.id,
            description: `Shipment is arriving at ${s.destination_port} ${daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`}. Cargo: ${s.cargo_category}. Carrier: ${s.carrier ?? "unknown"}. Ensure consignee is ready for pickup and customs clearance documentation is in order.`,
            action: "Confirm delivery appointment with consignee. Ensure import documentation is ready. Pre-clear customs if possible to avoid port demurrage.",
            carrier: s.carrier, corridor: s.corridor, eta: s.eta_date, value: s.declared_value ?? 0, riskLevel: s.risk_level,
          });
        }
      }
    });

    const order = { critical: 0, high: 1, medium: 2 };
    return alerts.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 10);
  }, [allShipments]);

  // Congestion panel: sort corridors by active shipment presence, then score
  const normCorr = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const congestionOverview = useMemo(() => {
    const activeCorridors = new Set(
      allShipments.filter((s) => s.status !== "delivered").map((s) => normCorr(s.corridor))
    );
    return getCorridorCongestionOverview()
      .sort((a, b) => {
        const aActive = activeCorridors.has(normCorr(a.corridor)) ? 1 : 0;
        const bActive = activeCorridors.has(normCorr(b.corridor)) ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return b.congestionScore - a.congestionScore;
      })
      .slice(0, 4);
  }, [allShipments]);

  // Active shipment count per corridor (for congestion panel labels)
  const activeShipmentsPerCorridor = useMemo(() => {
    const counts: Record<string, number> = {};
    allShipments.filter((s) => s.status !== "delivered").forEach((s) => {
      const k = normCorr(s.corridor);
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return counts;
  }, [allShipments]);

  // Carbon insight: dynamic text from actual shipment data
  const carbonInsight = useMemo(() => {
    if (allShipments.length === 0) return "No shipments tracked yet";
    const sea  = allShipments.filter((s) => s.shipment_mode === "sea");
    const air  = allShipments.filter((s) => s.shipment_mode === "air");
    const rail = allShipments.filter((s) => s.shipment_mode === "rail");
    const avg = (arr: typeof allShipments) =>
      arr.length > 0 ? arr.reduce((s, x) => s + (x.carbon_kg ?? 0), 0) / arr.length : 0;
    const seaAvg = avg(sea);
    const railAvg = avg(rail);
    const airAvg = avg(air);
    if (rail.length > 0 && seaAvg > 0 && seaAvg > railAvg) {
      const saving = ((seaAvg - railAvg) / 1000).toFixed(1);
      return `${sea.length} sea · ${rail.length} rail shipment${rail.length !== 1 ? "s" : ""} — rail saves avg ${saving}t CO₂e per shipment`;
    }
    if (air.length > 0 && seaAvg > 0) {
      const ratio = Math.round(airAvg / Math.max(seaAvg, 1));
      return `${sea.length} sea · ${air.length} air — air freight emits ~${ratio}× more CO₂e per shipment`;
    }
    return `${sea.length} sea · ${air.length} air · ${rail.length} rail freight shipments tracked`;
  }, [allShipments]);
  const activeShipments = visibleShipments.filter((s) => s.status !== "delivered");
  const totalValue  = visibleShipments.reduce((sum, s) => sum + (s.declared_value ?? 0), 0);
  const totalCarbon = visibleShipments.reduce((sum, s) => sum + (s.carbon_kg ?? 0), 0);

  // KPI: new metrics
  const delayedCount   = visibleShipments.filter((s) => ["delayed", "at_risk"].includes(s.status)).length;
  const customsRisk    = visibleShipments.filter(
    (s) => s.status === "customs_hold" || s.risk_level === "high" || s.risk_level === "critical",
  ).length;
  const onTrack        = visibleShipments.filter(
    (s) => s.status === "delivered" || (s.status === "in_transit" && !["high", "critical"].includes(s.risk_level)),
  ).length;
  const onTimePct      = visibleShipments.length
    ? Math.round((onTrack / visibleShipments.length) * 100)
    : 100;

  const SELECT_CLS =
    "text-xs font-medium pl-2.5 pr-6 py-1 rounded-full border border-gray-300 bg-white text-gray-700 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar unreadAlerts={riskAlerts.length} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <LiveIndicator status={realtimeStatus} />
            </div>
            <p className="text-gray-500 text-sm">
              Cross-border operations ·{" "}
              {new Date().toLocaleDateString("en-GB", { dateStyle: "long" })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/estimate"
              className="inline-flex items-center gap-2 border border-gray-300 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 text-gray-600 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Calculator className="w-4 h-4" /> Estimate
            </Link>
            <Link
              href="/shipments/new"
              className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <Package className="w-4 h-4" /> New Shipment
            </Link>
          </div>
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3 mb-5 p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Corridor pills */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium shrink-0">
            <Globe className="w-3.5 h-3.5" />
            Corridor:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CORRIDORS.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCorridor(c.id)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  activeCorridor === c.id
                    ? "bg-blue-700 text-white border-blue-700"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-700"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-gray-200 hidden sm:block mx-1" />

          {/* Status */}
          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={SELECT_CLS}>
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="booked">Booked</option>
              <option value="in_transit">In Transit</option>
              <option value="customs_hold">Customs Hold</option>
              <option value="delayed">Delayed</option>
              <option value="delivered">Delivered</option>
              <option value="at_risk">At Risk</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>

          {/* Risk */}
          <div className="relative">
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className={SELECT_CLS}>
              <option value="all">All Risk</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>

          {/* Mode */}
          <div className="relative">
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className={SELECT_CLS}>
              <option value="all">All Modes</option>
              <option value="sea">Sea</option>
              <option value="air">Air</option>
              <option value="rail">Rail</option>
              <option value="multimodal">Multimodal</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>

          <div className="h-4 w-px bg-gray-200 hidden sm:block mx-1" />

          {/* Currency */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium shrink-0">
            <DollarSign className="w-3.5 h-3.5" />
            Currency:
            {fxSource === "live" && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                LIVE
              </span>
            )}
          </div>
          <div className="relative">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={SELECT_CLS}
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          {fxUpdatedAt && (
            <span className="text-[10px] text-gray-400 hidden lg:block">
              Rates updated {new Date(fxUpdatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}

          <div className="h-4 w-px bg-gray-200 hidden sm:block mx-1" />

          {/* Language */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium shrink-0">
            <Languages className="w-3.5 h-3.5" />
          </div>
          <div className="flex gap-1">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                title={l.name}
                className={`text-xs font-semibold px-2 py-1 rounded border transition-colors ${
                  lang === l.code
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
                }`}
              >
                {l.label}
              </button>
            ))}
            {lang !== "en" && (
              <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded ml-1">
                Coming soon
              </span>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm animate-pulse">
                <div className="w-9 h-9 rounded-lg bg-gray-100 mb-3" />
                <div className="h-7 bg-gray-100 rounded w-12 mb-1" />
                <div className="h-3 bg-gray-100 rounded w-24 mb-1" />
                <div className="h-3 bg-gray-100 rounded w-32" />
              </div>
            ))
          ) : (
            [
              {
                title: "Total Shipments",
                value: visibleShipments.length,
                sub: `${activeShipments.length} active · ${visibleShipments.filter(s => s.status === "delivered").length} delivered`,
                accent: "text-blue-600 bg-blue-50",
                icon: Package,
                badge: null,
              },
              {
                title: "Delayed",
                value: delayedCount,
                sub: "at-risk or confirmed delay",
                accent: delayedCount > 0 ? "text-orange-600 bg-orange-50" : "text-gray-400 bg-gray-50",
                icon: Clock,
                badge: delayedCount > 0 ? "action" : null,
              },
              {
                title: "Customs Risk",
                value: customsRisk,
                sub: "holds, high & critical risk",
                accent: customsRisk > 0 ? "text-red-600 bg-red-50" : "text-gray-400 bg-gray-50",
                icon: ShieldAlert,
                badge: customsRisk > 0 ? "alert" : null,
              },
              {
                title: "On-Time",
                value: `${onTimePct}%`,
                sub: `${onTrack} of ${visibleShipments.length} shipments on track`,
                accent: onTimePct >= 80 ? "text-emerald-600 bg-emerald-50" : onTimePct >= 60 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50",
                icon: onTimePct >= 80 ? TrendingUp : TrendingDown,
                badge: null,
              },
            ].map(({ title, value, sub, accent, icon: Icon, badge }) => (
              <div key={title} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  {badge === "alert" && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">ALERT</span>
                  )}
                  {badge === "action" && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 border border-orange-200">ACTION</span>
                  )}
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-0.5">{value}</div>
                <div className="text-xs text-gray-500 mb-1 font-medium">{title}</div>
                <div className="text-[11px] text-gray-400">{sub}</div>
              </div>
            ))
          )}
        </div>

        {/* Two column layout */}
        <div className="grid lg:grid-cols-5 gap-5">
          {/* Shipments table — 3/5 */}
          <div ref={tableRef} className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {activeCorridor !== "all" && (
              <div className="flex items-center justify-between px-5 py-2 bg-blue-50 border-b border-blue-100">
                <span className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                  Filtered by corridor: {activeCorridor}
                </span>
                <button
                  onClick={() => setActiveCorridor("all")}
                  className="text-[11px] text-blue-500 hover:text-blue-700 font-medium"
                >
                  Clear ×
                </button>
              </div>
            )}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 gap-3">
              <h2 className="font-semibold text-gray-900 text-sm shrink-0">Active Shipments</h2>
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search shipments…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                />
              </div>
              <Link
                href="/shipments"
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium shrink-0"
              >
                View all <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 font-medium">Shipment</th>
                    <th className="text-left px-4 py-3 font-medium">Corridor</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Value</th>
                    <th className="text-left px-4 py-3 font-medium">Risk</th>
                    <th className="text-left px-4 py-3 font-medium">ETA</th>
                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleShipments.map((s) => {
                    const delta = recentlyUpdated.get(s.id);
                    return (
                    <tr
                      key={s.id}
                      className={`border-b border-gray-50 last:border-0 transition-colors duration-500 ${
                        delta ? "bg-emerald-50/60 hover:bg-emerald-50/80" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-gray-800">{s.shipment_code}</span>
                          {delta && (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-1 py-0.5 rounded uppercase tracking-wide animate-pulse">
                              live
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5 truncate max-w-30">{s.cargo_category}</div>
                        {delta && delta.changedFields.filter(f => f !== "new").length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {delta.changedFields.filter(f => f !== "new").map((f) => (
                              <span key={f} className="text-[9px] text-emerald-600 font-medium">
                                ↺ {f.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 min-w-[140px]">
                        <div className="text-xs text-gray-800 font-medium whitespace-nowrap">{s.origin_port} → {s.destination_port}</div>
                        <div className="text-[11px] text-gray-400 whitespace-nowrap">{s.origin_country} → {s.destination_country}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusPill status={s.status as ShipmentStatus} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-700 font-medium">
                        {fxConvert(s.declared_value ?? 0, currency)}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          label={s.risk_level.charAt(0).toUpperCase() + s.risk_level.slice(1)}
                          variant={s.risk_level as "low" | "medium" | "high" | "critical"}
                          dot
                        />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                        {s.eta_date
                          ? new Date(s.eta_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/shipments/${s.id}`}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            View
                          </Link>
                          <Link
                            href={`/shipments/new?editId=${s.id}`}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-0.5"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(s.id, s.shipment_code)}
                            disabled={deletingId === s.id}
                            className="text-xs font-semibold text-red-400 hover:text-red-600 flex items-center gap-0.5 disabled:opacity-40"
                          >
                            <Trash2 className="w-3 h-3" /> {deletingId === s.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})}
                  {!loading && allShipments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center">
                        <Package className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                        <p className="text-xs font-semibold text-gray-500 mb-1">No active shipments yet</p>
                        <p className="text-[11px] text-gray-400 mb-4">Create your first shipment to start tracking logistics operations.</p>
                        <Link
                          href="/shipments/new"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Package className="w-3.5 h-3.5" /> New Shipment
                        </Link>
                      </td>
                    </tr>
                  )}
                  {!loading && allShipments.length > 0 && visibleShipments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-xs text-gray-400">
                        No shipments match the selected filters
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-xs text-gray-400">
                        Loading…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Alerts panel */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <Bell className="w-4 h-4 text-orange-500" />
                  Live Alerts
                  {liveAlerts.length > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {liveAlerts.length}
                    </span>
                  )}
                </h2>
                {liveAlerts.length > 0 && (
                  <Link href="/shipments" className="text-[11px] text-blue-600 hover:text-blue-700 font-medium">
                    View all
                  </Link>
                )}
              </div>
              {liveAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mb-3" />
                  <p className="text-xs font-semibold text-gray-700 mb-1">All clear</p>
                  <p className="text-[11px] text-gray-400">No delays, customs holds, or risk alerts detected.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
                  {liveAlerts.map((alert) => {
                    const sevCls =
                      alert.severity === "critical" ? "text-red-600" :
                      alert.severity === "high"     ? "text-orange-600" : "text-amber-600";
                    const bgCls =
                      alert.severity === "critical" ? "bg-red-50/40" :
                      alert.severity === "high"     ? "bg-orange-50/30" : "";
                    const expandedBg =
                      alert.severity === "critical" ? "bg-red-50 border-red-100" :
                      alert.severity === "high"     ? "bg-orange-50 border-orange-100" : "bg-amber-50 border-amber-100";
                    const IconEl =
                      alert.icon === "customs" ? ShieldAlert :
                      alert.icon === "arrival" ? Timer :
                      AlertTriangle;
                    const isExpanded = expandedAlertId === alert.id;
                    return (
                      <div key={alert.id}>
                        {/* Alert row — click to expand */}
                        <button
                          type="button"
                          onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${bgCls} ${isExpanded ? "border-b border-gray-100" : ""}`}
                        >
                          <div className={`flex items-center gap-1.5 text-xs font-semibold mb-0.5 ${sevCls}`}>
                            <IconEl className="w-3.5 h-3.5 shrink-0" />
                            <span>{alert.title}</span>
                            <span className="font-mono ml-auto text-gray-400 font-normal text-[10px]">{alert.code}</span>
                            <span className={`text-gray-400 ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                              ▾
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 leading-snug">{alert.sub}</div>
                        </button>

                        {/* Expanded detail card */}
                        {isExpanded && (
                          <div className={`px-4 py-3 border-b ${expandedBg}`}>
                            {/* Description */}
                            <p className="text-[11px] text-gray-700 leading-relaxed mb-3">
                              {alert.description}
                            </p>

                            {/* Key details grid */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3 text-[11px]">
                              {alert.carrier && (
                                <>
                                  <span className="text-gray-400 font-medium">Carrier</span>
                                  <span className="text-gray-700 font-semibold">{alert.carrier}</span>
                                </>
                              )}
                              <span className="text-gray-400 font-medium">Corridor</span>
                              <span className="text-gray-700 font-semibold truncate">{alert.corridor}</span>
                              {alert.eta && (
                                <>
                                  <span className="text-gray-400 font-medium">ETA</span>
                                  <span className="text-gray-700 font-semibold">
                                    {new Date(alert.eta).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                </>
                              )}
                              <span className="text-gray-400 font-medium">Cargo Value</span>
                              <span className="text-gray-700 font-semibold">${(alert.value / 1000).toFixed(1)}K</span>
                              <span className="text-gray-400 font-medium">Risk Level</span>
                              <span className={`font-bold capitalize ${alert.riskLevel === "critical" ? "text-red-600" : alert.riskLevel === "high" ? "text-orange-600" : "text-amber-600"}`}>
                                {alert.riskLevel}
                              </span>
                            </div>

                            {/* Recommended action */}
                            <div className="bg-white/70 rounded-lg p-2.5 mb-3 border border-white">
                              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Recommended Action</div>
                              <p className="text-[11px] text-gray-700 leading-relaxed">{alert.action}</p>
                            </div>

                            {/* View Shipment CTA */}
                            <Link
                              href={`/shipments/${alert.shipmentId}`}
                              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors text-white ${
                                alert.severity === "critical" ? "bg-red-600 hover:bg-red-700" :
                                alert.severity === "high"     ? "bg-orange-500 hover:bg-orange-600" :
                                "bg-amber-500 hover:bg-amber-600"
                              }`}
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              View Shipment {alert.code}
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Corridor congestion */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                <MapPin className="w-4 h-4 text-blue-600" />
                <h2 className="font-semibold text-gray-900 text-sm">Port Congestion</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {congestionOverview.map((c) => {
                  const barCls =
                    c.riskLevel === "severe"   ? "bg-red-500" :
                    c.riskLevel === "high"     ? "bg-orange-400" :
                    c.riskLevel === "moderate" ? "bg-amber-400" : "bg-emerald-400";
                  const textCls =
                    c.riskLevel === "severe"   ? "text-red-600" :
                    c.riskLevel === "high"     ? "text-orange-600" :
                    c.riskLevel === "moderate" ? "text-amber-600" : "text-emerald-600";
                  const expandBg =
                    c.riskLevel === "severe"   ? "bg-red-50 border-red-100" :
                    c.riskLevel === "high"     ? "bg-orange-50 border-orange-100" :
                    c.riskLevel === "moderate" ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100";
                  const isExpanded = expandedCongestion === c.corridor;
                  const activeCount = activeShipmentsPerCorridor[normCorr(c.corridor)] ?? 0;

                  return (
                    <div key={c.corridor}>
                      {/* Row — click to expand */}
                      <button
                        type="button"
                        onClick={() => setExpandedCongestion(isExpanded ? null : c.corridor)}
                        className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-gray-800 truncate max-w-36">{c.corridor}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {activeCount > 0 && (
                              <span className="text-[10px] text-blue-600 font-semibold">{activeCount}</span>
                            )}
                            <span className={`text-[10px] font-bold ${textCls}`}>{c.riskLevel.toUpperCase()}</span>
                            <span className="text-gray-300 text-[10px]">{isExpanded ? "▴" : "▾"}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barCls}`} style={{ width: `${c.congestionScore}%` }} />
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                          <span>{c.congestionScore}/100</span>
                          {c.likelyDelayDays > 0 && <span>+{c.likelyDelayDays}d est.</span>}
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className={`px-5 py-3 border-t border-b ${expandBg}`}>
                          {/* Signal */}
                          <p className="text-[11px] text-gray-700 leading-relaxed mb-3">
                            {c.signal}
                          </p>

                          {/* Delay breakdown */}
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {[
                              { label: "P50 Delay", val: `+${c.likelyDelayDays}d`,  cls: "bg-white border-gray-200 text-gray-700" },
                              { label: "P75 Delay", val: `+${c.p75DelayDays}d`,      cls: "bg-white border-amber-200 text-amber-700" },
                              { label: "P90 Delay", val: `+${c.p90DelayDays}d`,      cls: "bg-white border-red-200 text-red-700" },
                            ].map(({ label, val, cls }) => (
                              <div key={label} className={`rounded-lg border p-2 text-center ${cls}`}>
                                <div className="text-[9px] text-gray-400 font-medium mb-0.5">{label}</div>
                                <div className="text-xs font-bold">{val}</div>
                              </div>
                            ))}
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-[11px]">
                            <span className="text-gray-400">Congestion Score</span>
                            <span className={`font-bold ${textCls}`}>{c.congestionScore}/100</span>
                            <span className="text-gray-400">Weekly Vessel Calls</span>
                            <span className="text-gray-700 font-semibold">{c.weeklyVesselCalls}</span>
                            <span className="text-gray-400">Active Shipments</span>
                            <span className="text-gray-700 font-semibold">{activeCount > 0 ? activeCount : "None tracked"}</span>
                          </div>

                          {/* Recommendation */}
                          <div className="bg-white/80 rounded-lg p-2.5 border border-white">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Recommendation</div>
                            <p className="text-[11px] text-gray-700 leading-relaxed">{c.recommendation}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-3 border-t border-gray-100">
                <Link href="/chat" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  Ask about congestion <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Quick actions */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h3>
              <div className="flex flex-col gap-2">
                {[
                  { label: "New Shipment",          href: "/shipments/new", icon: Package, cls: "text-blue-600 bg-blue-50" },
                  { label: "Estimate a Route",      href: "/estimate",      icon: DollarSign, cls: "text-emerald-600 bg-emerald-50" },
                  { label: "Logistics Copilot",     href: "/chat",          icon: Bell,    cls: "text-violet-600 bg-violet-50" },
                ].map(({ label, href, icon: Icon, cls }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${cls}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700">{label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 ml-auto group-hover:text-blue-500" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Trade Pulse */}
        <div className="mt-5">
          <TradePulse
            shipments={allShipments}
            loading={loading}
            selectedCorridor={activeCorridor}
            onCorridorSelect={handleCorridorSelect}
          />
        </div>

        {/* Carbon strip */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mt-4 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Leaf className="w-4.5 h-4.5 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Carbon Footprint Across Active Trade Portfolio</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {(totalCarbon / 1000).toFixed(1)} tCO₂e across visible shipments · {carbonInsight}
              </div>
            </div>
          </div>
          <Link
            href="/carbon"
            className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 text-xs font-semibold transition-colors shrink-0"
          >
            Compare Routes <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
