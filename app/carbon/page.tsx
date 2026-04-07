"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Leaf,
  Clock,
  DollarSign,
  Shield,
  CheckCircle,
  ArrowRight,
  Star,
  Ship,
  Plane,
  Train,
  Truck,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/app/components/Navbar";
import { getRateOptions, type CarrierOption } from "@/app/lib/rate-options";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

type TransportMode = "sea" | "air" | "rail" | "road";

const modeIcons: Record<TransportMode, React.ReactNode> = {
  sea:  <Ship  className="w-4 h-4" />,
  air:  <Plane className="w-4 h-4" />,
  rail: <Train className="w-4 h-4" />,
  road: <Truck className="w-4 h-4" />,
};

const modeColors: Record<TransportMode, { bg: string; text: string; border: string }> = {
  sea:  { bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-200" },
  air:  { bg: "bg-orange-50",  text: "text-orange-600",  border: "border-orange-200" },
  rail: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  road: { bg: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-200" },
};

const MODE_PROS: Record<string, string[]> = {
  sea:  ["Lowest cost per kg at scale", "High volume / FCL capacity", "Wide global port coverage"],
  air:  ["Fastest transit time", "Highest on-time reliability", "Best for perishables & high-value cargo"],
  rail: ["~70% less carbon vs sea", "Faster than sea on Asia-Europe", "Avoids port congestion"],
  road: ["Door-to-door delivery", "Flexible scheduling", "No transshipment delays"],
};
const MODE_CONS: Record<string, string[]> = {
  sea:  ["Longest transit time", "Port congestion & Red Sea diversion risk", "Carrier schedule dependency"],
  air:  ["Highest freight cost", "Weight & volume limits", "High carbon footprint"],
  rail: ["Limited corridor availability", "Border crossing delays", "Schedule adherence varies"],
  road: ["Distance & border limitations", "Driver availability constraints", "Higher per-km carbon vs rail"],
};

function RouteCard({
  option, isCurrent, selected, onSelect,
}: {
  option: CarrierOption; isCurrent: boolean; selected: boolean; onSelect: () => void;
}) {
  const carbonScore = Math.max(0, 100 - Math.round((option.carbonKgCO2e / 62400) * 100));
  const mc = modeColors[option.mode as TransportMode] ?? modeColors.sea;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl p-4 border-2 transition-all relative ${
        selected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
      }`}
    >
      {isCurrent && (
        <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
          CURRENT
        </span>
      )}
      {option.isRecommended && !isCurrent && (
        <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
          <Star className="w-2.5 h-2.5" /> BEST
        </span>
      )}

      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${mc.bg} ${mc.text}`}>
          {modeIcons[option.mode as TransportMode] ?? <Ship className="w-4 h-4" />}
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900 leading-tight">{option.name} via {option.carrier}</div>
          <div className="text-[11px] text-gray-400">{option.providerNote}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <div className="text-[11px] text-gray-400 mb-0.5">Days</div>
          <div className="text-sm font-bold text-gray-900">{option.transitDays}</div>
        </div>
        <div className="text-center">
          <div className="text-[11px] text-gray-400 mb-0.5">Cost</div>
          <div className="text-sm font-bold text-gray-900">${(option.costUSD / 1000).toFixed(1)}k</div>
        </div>
        <div className="text-center">
          <div className="text-[11px] text-gray-400 mb-0.5">CO₂e</div>
          <div className={`text-sm font-bold ${
            option.carbonKgCO2e < 2000 ? "text-emerald-600" :
            option.carbonKgCO2e < 6000 ? "text-amber-600" : "text-orange-600"
          }`}>
            {(option.carbonKgCO2e / 1000).toFixed(1)}t
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-gray-400 w-14">Carbon</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${carbonScore}%`,
                background: carbonScore > 70 ? "#059669" : carbonScore > 40 ? "#D97706" : "#DC2626",
              }}
            />
          </div>
          <span className="text-gray-500 w-6 text-right font-medium">{carbonScore}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-gray-400 w-14">Reliability</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${option.reliability}%` }} />
          </div>
          <span className="text-gray-500 w-6 text-right font-medium">{option.reliability}</span>
        </div>
      </div>
    </button>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-200 shadow-lg px-3 py-2 rounded-lg text-xs">
        <div className="text-gray-500">{label}</div>
        <div className="text-gray-900 font-bold">{payload[0].value}t</div>
      </div>
    );
  }
  return null;
};

const ORIGIN_COUNTRIES = [
  "India", "UAE", "Singapore", "China", "Bangladesh", "Vietnam",
  "Thailand", "Malaysia", "Germany", "Netherlands", "USA", "UK",
];
const DEST_COUNTRIES = [
  "Netherlands", "Germany", "USA", "UK", "France", "Italy",
  "Kenya", "Tanzania", "UAE", "Singapore", "South Africa",
];

function CarbonRouteContent() {
  const params = useSearchParams();

  // Editable corridor state — pre-filled from URL if coming from a shipment
  const [origin, setOrigin]   = useState(params.get("origin") ?? "India");
  const [dest, setDest]       = useState(params.get("dest")   ?? "Netherlands");
  const [weightKg, setWeightKg] = useState(params.get("weight") ?? "18500");
  const [priority, setPriority] = useState<"balanced" | "fastest" | "lowest_cost" | "low_carbon">(
    (params.get("priority") ?? "balanced") as "balanced" | "fastest" | "lowest_cost" | "low_carbon"
  );

  const weight   = parseFloat(weightKg) || 18500;
  const vol      = parseFloat(params.get("vol")    ?? "40");
  const mode     = params.get("mode")     ?? "sea";
  const code     = params.get("code")     ?? null;
  const currentCarbonKg = parseFloat(params.get("carbon") ?? "0");
  const fromShipment = !!params.get("code");

  // Normalize mode to short key
  const modeKey = mode.startsWith("air") ? "air" : mode.startsWith("rail") ? "rail" : "sea";

  // Compute all route options dynamically
  const result = useMemo(() => getRateOptions({
    originCountry: origin,
    destinationCountry: dest,
    weightKg: weight,
    volumeCBM: vol,
    modePreference: "any",
    priority,
  }), [origin, dest, weight, vol, priority]);

  // profile used only for complianceNote / operationalAlert (already in result)

  const options = result.options;
  const defaultId = options.find((o) => o.isRecommended)?.optionId ?? options[0]?.optionId ?? "";
  const [selectedId, setSelectedId] = useState<string>(defaultId);

  // Reset selection when corridor changes (origin/dest drive new options)
  // We derive the correct default from the new options list
  const effectiveSelectedId = options.find((o) => o.optionId === selectedId)
    ? selectedId
    : defaultId;

  const selected = options.find((o) => o.optionId === effectiveSelectedId) ?? options[0];
  // The "current" option is the one matching the shipment's mode
  const currentOption = options.find((o) => o.mode === modeKey) ?? options[0];

  if (!selected || !currentOption) return null;

  const carbonSaving = currentCarbonKg > 0
    ? currentCarbonKg - selected.carbonKgCO2e
    : currentOption.carbonKgCO2e - selected.carbonKgCO2e;
  const costDelta = selected.costUSD - currentOption.costUSD;
  const daysDelta = selected.transitDays - currentOption.transitDays;

  const chartData = options.map((o) => ({
    name: `${o.carrier.split(" ")[0]} (${o.mode})`,
    carbon: Math.round(o.carbonKgCO2e / 1000 * 10) / 10,
  }));

  const radarData = [
    { subject: "Speed",       value: Math.max(0, 100 - selected.transitDays * 2.5) },
    { subject: "Cost",        value: Math.max(0, 100 - selected.costUSD / 280) },
    { subject: "Carbon",      value: Math.max(0, 100 - selected.carbonKgCO2e / 624) },
    { subject: "Reliability", value: selected.reliability },
    { subject: "Safety",      value: selected.optionId === currentOption.optionId ? 72 : 90 },
  ];

  const pros = MODE_PROS[selected.mode] ?? [];
  const cons = MODE_CONS[selected.mode] ?? [];

  // Build port chain for the selected route
  const originPort = params.get("originPort") ?? origin;
  const destPort   = params.get("destPort")   ?? dest;
  const ports = selected.mode === "air"
    ? [originPort, "Hub Airport", destPort]
    : selected.mode === "rail"
    ? [originPort, "Rail Hub", "Border Crossing", destPort]
    : [originPort, destPort];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-2">
        <div className="max-w-5xl mx-auto flex items-center gap-3 text-xs text-gray-400">
          <Link href="/estimate" className="hover:text-blue-700 transition-colors font-medium">Estimate</Link>
          <span>·</span>
          <Link href="/dashboard" className="hover:text-blue-700 transition-colors font-medium">Dashboard</Link>
          <span>·</span>
          <span className="text-gray-700 font-medium">Carbon Routes</span>
          <span className="ml-auto text-[10px] text-gray-300">Standalone tool for carbon-aware rerouting</span>
        </div>
      </div>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Breadcrumb back to shipment */}
        {code && (
          <div className="flex items-center gap-2 mb-4">
            <Link href="/shipments" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Shipments
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-xs text-gray-500">{code}</span>
            <span className="text-gray-300">/</span>
            <span className="text-xs text-gray-600 font-medium">Reroute</span>
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Leaf className="w-6 h-6 text-emerald-600" />
            Carbon-Aware Corridor Optimiser
          </h1>
          <p className="text-gray-500 text-sm mt-1 mb-4">
            {fromShipment
              ? `Showing route alternatives for shipment ${code} on the ${origin} to ${dest} corridor.`
              : "Select an origin and destination to compare carbon footprints and route alternatives across sea, air, and rail."}
          </p>

          {/* Corridor selector — always visible */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Origin</label>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-36"
              >
                {ORIGIN_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-center pb-2">
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Destination</label>
              <select
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-36"
              >
                {DEST_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Weight (kg)</label>
              <input
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-28"
                placeholder="18500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="balanced">Balanced</option>
                <option value="low_carbon">Low Carbon</option>
                <option value="fastest">Fastest</option>
                <option value="lowest_cost">Lowest Cost</option>
              </select>
            </div>
            {fromShipment && (
              <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-medium self-end">
                From shipment {code}
              </span>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-5">
          {/* Route cards — 2/5 */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 text-xs text-gray-600">
              {code && <span className="font-semibold text-gray-900">{code}</span>}
              {code && " · "}
              {origin} to {dest} · {weight.toLocaleString()} kg · Select a route below to compare
            </div>
            {result.operationalAlert && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                {result.operationalAlert}
              </div>
            )}
            {options.map((o) => (
              <RouteCard
                key={o.optionId}
                option={o}
                isCurrent={o.mode === modeKey}
                selected={selectedId === o.optionId}
                onSelect={() => setSelectedId(o.optionId)}
              />
            ))}
          </div>

          {/* Comparison panel — 3/5 */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Delta KPIs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  icon: Leaf,
                  label: "Carbon Saving",
                  value: `${carbonSaving > 0 ? "-" : "+"}${Math.abs(Math.round(carbonSaving / 100) / 10).toFixed(1)}t`,
                  sub: "vs current route",
                  positive: carbonSaving > 0,
                },
                {
                  icon: DollarSign,
                  label: "Freight Delta",
                  value: `${costDelta > 0 ? "+" : ""}$${Math.abs(costDelta).toLocaleString()}`,
                  sub: costDelta > 0 ? "additional cost" : "savings",
                  positive: costDelta <= 0,
                },
                {
                  icon: Clock,
                  label: "Transit Days",
                  value: `${daysDelta > 0 ? "+" : ""}${daysDelta}d`,
                  sub: `${selected.transitDays} days total`,
                  positive: daysDelta <= 0,
                },
              ].map(({ icon: Icon, label, value, sub, positive }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2 ${positive ? "bg-emerald-50" : "bg-orange-50"}`}>
                    <Icon className={`w-4 h-4 ${positive ? "text-emerald-600" : "text-orange-600"}`} />
                  </div>
                  <div className={`text-xl font-bold ${positive ? "text-emerald-700" : "text-orange-600"}`}>{value}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
                  <div className="text-[11px] text-gray-400">{sub}</div>
                </div>
              ))}
            </div>

            {/* Route details */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">
                {selected.name} via {selected.carrier}
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap mb-4">
                {ports.map((port, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-700 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full font-medium">
                      {port}
                    </span>
                    {i < ports.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2">What works well</div>
                  <div className="flex flex-col gap-1.5">
                    {pros.map((pro) => (
                      <div key={pro} className="flex items-start gap-2 text-xs text-gray-700">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        {pro}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2">What to consider</div>
                  <div className="flex flex-col gap-1.5">
                    {cons.map((con) => (
                      <div key={con} className="flex items-start gap-2 text-xs text-gray-600">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        {con}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {result.complianceNote && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800">
                  <span className="font-semibold">Compliance note. </span>{result.complianceNote}
                </div>
              )}
            </div>

            {/* Radar */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-0.5">
                Route Score for {selected.carrier}
              </h2>
              <p className="text-xs text-gray-400 mb-3">Measured across speed, cost, carbon, reliability, and safety.</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
                    <PolarGrid stroke="#E5E7EB" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#6B7280", fontSize: 11 }} />
                    <Radar dataKey="value" stroke="#059669" fill="#059669" fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CO₂ bar chart */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">
                CO₂ Footprint Comparison for {origin} to {dest} (tCO₂e)
              </h2>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} unit="t" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="carbon" radius={[4, 4, 0, 0]}>
                      {options.map((o) => (
                        <Cell
                          key={o.optionId}
                          fill={
                            o.optionId === selectedId ? "#059669" :
                            o.mode === modeKey ? "#3B82F6" : "#D1D5DB"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recommendation */}
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-emerald-900 mb-1">Recommended Action</h3>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    {selected.recommendationReason || `${selected.carrier} scores highest for ${priority} priority across cost, speed, carbon, and reliability on this corridor.`}
                  </p>
                  {selected.providerNote && (
                    <p className="text-xs text-emerald-700 mt-1 font-medium">{selected.providerNote}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CarbonRoutePage() {
  return (
    <Suspense>
      <CarbonRouteContent />
    </Suspense>
  );
}
