export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Leaf, Percent,
  FileCheck, CheckCircle2, AlertTriangle, ShieldAlert, AlertCircle,
} from "lucide-react";
import { Navbar }              from "@/app/components/Navbar";
import { createClient }        from "@/app/lib/supabase/server";
import type { Shipment }       from "@/app/lib/supabase/shipment-types";
import { getCorridorProfile }  from "@/app/lib/estimation";
import { validateShipment }    from "@/app/lib/document-validation";
import { runSanctionsCheck }   from "@/app/lib/sanctions-check";
import ShipmentLiveStatus      from "@/app/components/ShipmentLiveStatus";
import LiveTimeline            from "@/app/components/LiveTimeline";
import LiveIntelligenceSidebar from "@/app/components/LiveIntelligenceSidebar";
import RouteOptimizationPanel  from "@/app/components/RouteOptimizationPanel";
import DocumentIntelligence    from "@/app/components/DocumentIntelligence";
import ShipmentNotifyPanel     from "@/app/components/ShipmentNotifyPanel";

interface PageProps {
  params: Promise<{ id: string }>;
}

// ─── Enrich missing derived fields (ETA, carbon, carrier) ────────────────────
// Runs server-side for initial render only. LiveIntelligenceSidebar keeps
// these accurate after real-time updates via the useShipment hook.

function enrichShipment(s: Shipment): Shipment {
  if (!s.origin_country || !s.destination_country) return s;

  const modeKey = s.shipment_mode?.startsWith("air")  ? "air"
                : s.shipment_mode?.startsWith("rail") ? "rail" : "sea";
  const profile = getCorridorProfile(s.origin_country, s.destination_country);

  if (!s.eta_date && s.expected_dispatch_date) {
    const days = modeKey === "air" ? profile.airDays
               : (modeKey === "rail" && profile.hasRail) ? profile.railDays : profile.seaDays;
    const eta  = new Date(new Date(s.expected_dispatch_date).getTime() + days * 86_400_000);
    s = { ...s, eta_date: eta.toISOString().split("T")[0] };
  }

  if (!s.carbon_kg || s.carbon_kg === 0) {
    const distKm = modeKey === "air" ? profile.airDistKm : profile.seaDistKm;
    const factor = modeKey === "air" ? 0.55 : modeKey === "rail" ? 0.007 : 0.016;
    s = { ...s, carbon_kg: Math.max(80, Math.round((s.weight ?? 1000) * distKm * factor / 1000)) };
  }

  if (!s.carrier) {
    const carrier = modeKey === "sea" ? profile.seaCarrier.split(" / ")[0]
                  : modeKey === "air" ? "Emirates SkyCargo" : "DB Schenker Rail";
    s = { ...s, carrier };
  }

  return s;
}

// ─── Build timeline from shipment data ────────────────────────────────────────
// Used as fallback when the shipment_events table has no rows for this shipment.
// Generates 7 realistic stages based on status, dates, and route.

type TimelineEventLocal = {
  id: string;
  event_type: string;
  event_label: string;
  location: string;
  status: "completed" | "active" | "pending";
  occurred_at: string | null;
};

function buildTimelineEvents(s: Shipment): TimelineEventLocal[] {
  const shipStatus = s.status;
  const bookedAt   = s.created_at ? s.created_at.split("T")[0] : null;
  const dispatchAt = s.expected_dispatch_date ?? null;
  const etaAt      = s.eta_date ?? null;

  // Derive midpoint dates for in-transit events
  const dispatchMs  = dispatchAt  ? new Date(dispatchAt).getTime()  : null;
  const etaMs       = etaAt       ? new Date(etaAt).getTime()       : null;
  const midMs       = dispatchMs && etaMs ? Math.round((dispatchMs + etaMs) / 2) : null;
  const customsMs   = midMs && etaMs ? Math.round((midMs + etaMs) / 2) : null;

  const fmt = (ms: number | null) =>
    ms ? new Date(ms).toISOString().split("T")[0] : null;

  const docsDate    = dispatchMs ? fmt(dispatchMs - 2 * 86_400_000) : null;
  const transitDate = fmt(midMs);
  const customsDate = fmt(customsMs);
  const deliveryDate = etaMs ? fmt(etaMs + 2 * 86_400_000) : null;

  // Which statuses count as "past this stage"
  const POST_DISPATCH  = ["in_transit", "at_risk", "customs_hold", "delayed", "delivered"];
  const POST_CUSTOMS   = ["delivered"];
  const TRANSIT_ACTIVE = ["in_transit", "at_risk", "delayed"];
  const CUSTOMS_ACTIVE = ["customs_hold"];

  function st(
    completedIf: string[],
    activeIf:    string[]
  ): "completed" | "active" | "pending" {
    if (completedIf.includes(shipStatus)) return "completed";
    if (activeIf.includes(shipStatus))    return "active";
    return "pending";
  }

  const inTransitLabel =
    shipStatus === "delayed"  ? "In Transit — Delay Reported"
    : shipStatus === "at_risk" ? "In Transit — Flagged At Risk"
    : "In Transit";

  const customsLabel =
    shipStatus === "customs_hold" ? "Customs Hold — Pending Clearance"
    : "Customs Clearance";

  return [
    {
      id: "ev-1",
      event_type: "booked",
      event_label: "Shipment Booked",
      location: s.origin_country,
      status: "completed",
      occurred_at: bookedAt,
    },
    {
      id: "ev-2",
      event_type: "docs_submitted",
      event_label: "Export Documentation Submitted",
      location: s.origin_port,
      status: st(POST_DISPATCH, ["booked"]),
      occurred_at: docsDate,
    },
    {
      id: "ev-3",
      event_type: "departed",
      event_label: "Cargo Loaded and Departed",
      location: `${s.origin_port}, ${s.origin_country}`,
      status: st(POST_DISPATCH, []),
      occurred_at: dispatchAt,
    },
    {
      id: "ev-4",
      event_type: "in_transit",
      event_label: inTransitLabel,
      location: s.corridor,
      status: st(POST_CUSTOMS, TRANSIT_ACTIVE),
      occurred_at: transitDate,
    },
    {
      id: "ev-5",
      event_type: "customs",
      event_label: customsLabel,
      location: `${s.destination_port}, ${s.destination_country}`,
      status: st(POST_CUSTOMS, CUSTOMS_ACTIVE),
      occurred_at: customsDate,
    },
    {
      id: "ev-6",
      event_type: "arrived",
      event_label: "Arrived at Destination Port",
      location: `${s.destination_port}, ${s.destination_country}`,
      status: st(["delivered"], []),
      occurred_at: etaAt,
    },
    {
      id: "ev-7",
      event_type: "delivered",
      event_label: "Delivered to Consignee",
      location: s.destination_country,
      status: st(["delivered"], []),
      occurred_at: deliveryDate,
    },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ShipmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rawShipment } = await supabase
    .from("shipments")
    .select("*")
    .eq("id", id)
    .single();

  if (!rawShipment) notFound();

  const s = enrichShipment(rawShipment as Shipment);

  // Load real events from DB — passed to LiveTimeline as initial state
  const { data: dbEvents } = await supabase
    .from("shipment_events")
    .select("*")
    .eq("shipment_id", id)
    .order("occurred_at", { ascending: true });

  const dbMapped = (dbEvents ?? []).map((e) => ({
    id:          e.id as string,
    event_type:  e.event_type as string,
    event_label: e.event_label as string,
    location:    (e.location as string) ?? "",
    status:      e.status as "completed" | "active" | "pending",
    occurred_at: e.occurred_at as string | null,
  }));

  // Use DB events when present; otherwise derive timeline from shipment data
  const initialEvents = dbMapped.length > 0 ? dbMapped : buildTimelineEvents(s);

  // Quick server-side pass for the compliance summary badges (static until page reload)
  const validation = validateShipment(s);
  const sanctions  = runSanctionsCheck(s);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-5">
          <Link href="/shipments"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Shipments
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-xs text-gray-500 font-mono">{s.shipment_code}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1.5">{s.shipment_code}</h1>
            {/* Live status — subscribes to realtime updates */}
            <ShipmentLiveStatus shipment={s} />
            <p className="text-gray-600 text-sm mt-2">{s.cargo_category} · {s.shipper_company}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.corridor} · {s.carrier ?? s.shipment_mode}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href={`/tariff?hs=${encodeURIComponent(s.hs_code ?? "")}&value=${s.declared_value ?? ""}&dest=${encodeURIComponent(s.destination_country ?? "")}`}
              className="flex items-center gap-1.5 border border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-gray-600 hover:text-amber-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors">
              <Percent className="w-3.5 h-3.5" /> Tariff Sim
            </Link>
            <Link
              href={`/carbon?origin=${encodeURIComponent(s.origin_country)}&dest=${encodeURIComponent(s.destination_country)}&weight=${s.weight}&vol=${s.volume ?? 0}&mode=${s.shipment_mode ?? "sea"}&priority=${s.priority ?? "balanced"}&code=${s.shipment_code}&carbon=${s.carbon_kg ?? 0}&originPort=${encodeURIComponent(s.origin_port ?? s.origin_country)}&destPort=${encodeURIComponent(s.destination_port ?? s.destination_country)}`}
              className="flex items-center gap-1.5 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors">
              <Leaf className="w-3.5 h-3.5" /> Reroute
            </Link>
          </div>
        </div>

        {/* Route progress bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-900">
                {s.origin_port} → {s.destination_port}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {s.eta_date
                ? `ETA ${new Date(s.eta_date).toLocaleDateString("en-GB", { dateStyle: "medium" })}`
                : "ETA TBC"}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                s.status === "delivered" ? "bg-emerald-500"
                : s.status === "customs_hold" || s.status === "delayed" ? "bg-amber-500"
                : "bg-blue-600"
              }`}
              style={{
                width: s.status === "delivered" ? "100%"
                     : s.status === "in_transit"    ? "55%"
                     : s.status === "at_risk"       ? "50%"
                     : s.status === "customs_hold"  ? "70%"
                     : s.status === "delayed"       ? "45%"
                     : s.status === "booked"        ? "10%"
                     : "0%",
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[11px] text-gray-400">
            <span>{s.origin_port}, {s.origin_country}</span>
            <span>{s.destination_port}, {s.destination_country}</span>
          </div>
        </div>

        {/* Main grid: Timeline (2/3) + Sidebar (1/3) */}
        <div className="grid lg:grid-cols-3 gap-5">
          {/* ── Real-time timeline — client component ── */}
          <LiveTimeline
            shipmentId={s.id}
            initialEvents={initialEvents}
            shipment={s}
          />

          {/* ── Live intelligence sidebar — client component ── */}
          <LiveIntelligenceSidebar initial={s} />
        </div>

        {/* ── Compliance summary bar ── */}
        <div className="mt-5 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-violet-600" />
              <h2 className="text-sm font-semibold text-gray-900">Compliance Intelligence</h2>
              <span className="text-[10px] text-gray-400">· re-computes live on shipment updates</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                validation.score >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : validation.score >= 60 ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-red-50 text-red-700 border-red-200"
              }`}>
                Readiness {validation.score}/100
              </span>
              {sanctions.riskScore > 0 ? (
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  sanctions.riskLevel === "critical" ? "bg-red-50 text-red-700 border-red-200"
                  : sanctions.riskLevel === "high"   ? "bg-orange-50 text-orange-700 border-orange-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  <ShieldAlert className="w-3 h-3" />
                  Sanctions {sanctions.riskLevel.toUpperCase()}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Sanctions Clear
                </span>
              )}
            </div>
          </div>
          {(!validation.isValid || sanctions.riskScore > 0) && (
            <div className="px-5 py-3 flex flex-wrap gap-x-6 gap-y-2">
              {validation.issues.filter((i) => i.severity === "error").length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {validation.issues.filter((i) => i.severity === "error").length} customs error(s) need fixing
                </div>
              )}
              {validation.issues.filter((i) => i.severity === "warning").length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {validation.issues.filter((i) => i.severity === "warning").length} warning(s) to review
                </div>
              )}
              {sanctions.flags.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-700">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  {sanctions.flags.length} sanctions flag{sanctions.flags.length !== 1 ? "s" : ""} detected. {sanctions.recommendation}
                </div>
              )}
            </div>
          )}
          {validation.isValid && sanctions.riskScore === 0 && (
            <div className="px-5 py-3 text-xs text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Automated checks passed. Upload trade documents below for AI verification.
            </div>
          )}
        </div>

        {/* ── Route Optimization (booked only) or Current Route display ── */}
        <div className="mt-4">
          {s.status === "booked" ? (
            <RouteOptimizationPanel shipment={s} />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-900">Current Route</h2>
                <span className="text-[11px] bg-blue-50 text-blue-600 border border-blue-100 font-medium px-2 py-0.5 rounded-full">
                  {s.shipment_mode ?? "sea"}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {[s.origin_port, s.destination_port].map((port, i, arr) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium border ${
                      i === 0 ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {port}
                    </span>
                    {i < arr.length - 1 && <span className="text-gray-300 text-sm">→</span>}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[11px] text-gray-400 mb-1">Carrier</p>
                  <p className="text-xs font-semibold text-gray-800">{s.carrier ?? s.shipment_mode}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[11px] text-gray-400 mb-1">ETA</p>
                  <p className="text-xs font-semibold text-gray-800">
                    {s.eta_date ? new Date(s.eta_date).toLocaleDateString("en-GB", { dateStyle: "medium" }) : "TBC"}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[11px] text-gray-400 mb-1">Carbon</p>
                  <p className="text-xs font-semibold text-emerald-700">
                    {s.carbon_kg ? `${(s.carbon_kg / 1000).toFixed(2)} tCO₂e` : "N/A"}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                Route optimization is available before departure. Use the Reroute button above to explore carbon-aware alternatives.
              </p>
            </div>
          )}
        </div>

        {/* ── Notify Panel ── */}
        <div className="mt-4">
          <ShipmentNotifyPanel
            shipmentId={s.id}
            shipmentCode={s.shipment_code}
            shipmentStatus={s.status}
          />
        </div>

        {/* ── AI Document Intelligence ── */}
        <div className="mt-4">
          <DocumentIntelligence
            shipment={s}
            initialExpanded={!validation.isValid || sanctions.riskScore > 0}
          />
        </div>

        {/* Back */}
        <div className="mt-6">
          <Link href="/shipments"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Shipments
          </Link>
        </div>
      </main>
    </div>
  );
}

export async function generateStaticParams() { return []; }
