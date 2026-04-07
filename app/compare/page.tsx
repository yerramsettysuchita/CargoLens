"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Ship, Plane, Train, Leaf, Clock, DollarSign, ArrowRight,
  Star, Shield, AlertTriangle, Package, ChevronDown,
} from "lucide-react";
import { Navbar } from "@/app/components/Navbar";
import type { CarrierOption, RateComparisonResult } from "@/app/lib/rate-options";

const MODE_ICON: Record<string, React.ReactNode> = {
  sea:  <Ship className="w-4 h-4" />,
  air:  <Plane className="w-4 h-4" />,
  rail: <Train className="w-4 h-4" />,
};
const MODE_COLOR: Record<string, { bg: string; text: string }> = {
  sea:  { bg: "bg-blue-50",    text: "text-blue-600" },
  air:  { bg: "bg-orange-50",  text: "text-orange-600" },
  rail: { bg: "bg-emerald-50", text: "text-emerald-600" },
};

const ORIGIN_COUNTRIES = [
  "India", "UAE", "Singapore", "China", "Bangladesh", "Vietnam",
  "Thailand", "Malaysia", "Germany", "Netherlands",
];
const DEST_COUNTRIES = [
  "Netherlands", "Germany", "USA", "UK", "France", "Italy",
  "Kenya", "Tanzania", "UAE", "Singapore", "South Africa",
];

const SELECT_CLS =
  "w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-emerald-500" : score >= 55 ? "bg-blue-500" : "bg-gray-300";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-7 text-right">{score}</span>
    </div>
  );
}

function OptionCard({ option, onBook }: { option: CarrierOption; onBook: (o: CarrierOption) => void }) {
  const mc = MODE_COLOR[option.mode] ?? MODE_COLOR.sea;
  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm p-5 transition-all hover:shadow-md ${
      option.isRecommended ? "border-blue-500" : "border-gray-200"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mc.bg} ${mc.text}`}>
            {MODE_ICON[option.mode]}
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{option.carrier}</div>
            <div className="text-[11px] text-gray-400">{option.name}</div>
          </div>
        </div>
        {option.isRecommended && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <Star className="w-3 h-3" /> RECOMMENDED
          </span>
        )}
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <div className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Match Score</div>
        <ScoreBar score={option.score} />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <DollarSign className="w-3.5 h-3.5 text-gray-400 mx-auto mb-0.5" />
          <div className="text-xs font-bold text-gray-900">${option.costUSD.toLocaleString()}</div>
          <div className="text-[10px] text-gray-400">Est. Cost</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <Clock className="w-3.5 h-3.5 text-gray-400 mx-auto mb-0.5" />
          <div className="text-xs font-bold text-gray-900">{option.transitDays}d</div>
          <div className="text-[10px] text-gray-400">Transit</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <Leaf className="w-3.5 h-3.5 text-emerald-500 mx-auto mb-0.5" />
          <div className="text-xs font-bold text-gray-900">{option.carbonKgCO2e}</div>
          <div className="text-[10px] text-gray-400">kg CO₂</div>
        </div>
      </div>

      {/* Reliability + CO2 saving */}
      <div className="flex items-center justify-between text-xs mb-3">
        <div className="flex items-center gap-1 text-gray-500">
          <Shield className="w-3.5 h-3.5" />
          <span>{option.reliability}% on-time</span>
        </div>
        {option.co2VsBaseline > 0 && (
          <div className="flex items-center gap-1 text-emerald-600 font-medium">
            <Leaf className="w-3.5 h-3.5" />
            <span>saves {option.co2VsBaseline} kg CO₂</span>
          </div>
        )}
      </div>

      {/* Reason */}
      <p className="text-[11px] text-gray-500 leading-relaxed mb-3 border-t border-gray-100 pt-2">
        {option.recommendationReason}
      </p>

      {/* Provider note */}
      <p className="text-[11px] text-gray-400 italic mb-4">{option.providerNote}</p>

      {/* Valid until + Book */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">Rate valid until {option.validUntil}</span>
        <button
          onClick={() => onBook(option)}
          className="inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          Book This Rate <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Main page content ─────────────────────────────────────────────────────────

function CompareContent() {
  const params = useSearchParams();
  const router = useRouter();

  const [origin, setOrigin] = useState(params.get("origin") ?? "India");
  const [destination, setDestination] = useState(params.get("dest") ?? "Netherlands");
  const [weightKg, setWeightKg] = useState(params.get("weight") ?? "5000");
  const [volumeCBM, setVolumeCBM] = useState(params.get("volume") ?? "20");
  const [priority, setPriority] = useState(params.get("priority") ?? "balanced");
  const [modeFilter, setModeFilter] = useState("any");

  const [result, setResult] = useState<RateComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originCountry: origin,
          destinationCountry: destination,
          weightKg: Number(weightKg),
          volumeCBM: Number(volumeCBM),
          modePreference: modeFilter,
          priority,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch rates");
      setResult(data as RateComparisonResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [origin, destination, weightKg, volumeCBM, modeFilter, priority]);

  // Auto-fetch on mount if params present
  useEffect(() => {
    if (params.get("origin")) fetchRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBook(option: CarrierOption) {
    const qs = new URLSearchParams({
      origin, dest: destination,
      mode: option.mode, carrier: option.carrier,
      cost: String(option.costUSD), priority,
    }).toString();
    router.push(`/shipments/new?${qs}`);
  }

  const visible = result?.options.filter(
    (o) => modeFilter === "any" || o.mode === modeFilter
  ) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-2">
        <div className="max-w-6xl mx-auto flex items-center gap-3 text-xs text-gray-400">
          <Link href="/estimate" className="hover:text-blue-700 transition-colors font-medium">Estimate</Link>
          <span>·</span>
          <Link href="/dashboard" className="hover:text-blue-700 transition-colors font-medium">Dashboard</Link>
          <span>·</span>
          <span className="text-gray-700 font-medium">Rate Compare</span>
          <span className="ml-auto text-[10px] text-gray-300">Standalone tool. Use the Estimator for the full end-to-end workflow.</span>
        </div>
      </div>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" /> Freight Rate Comparison
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Compare freight carriers across sea, air, and rail routes and book your preferred option directly.</p>
        </div>

        {/* Input form */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Origin</label>
              <select value={origin} onChange={(e) => setOrigin(e.target.value)} className={SELECT_CLS}>
                {ORIGIN_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Destination</label>
              <select value={destination} onChange={(e) => setDestination(e.target.value)} className={SELECT_CLS}>
                {DEST_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Weight (kg)</label>
              <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={SELECT_CLS} placeholder="5000" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Volume (CBM)</label>
              <input type="number" value={volumeCBM} onChange={(e) => setVolumeCBM(e.target.value)} className={SELECT_CLS} placeholder="20" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Priority</label>
              <div className="relative">
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className={SELECT_CLS}>
                  <option value="balanced">Balanced</option>
                  <option value="fastest">Fastest</option>
                  <option value="lowest_cost">Lowest Cost</option>
                  <option value="low_carbon">Low Carbon</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchRates}
                disabled={loading}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {loading ? "Loading…" : "Compare"}
              </button>
            </div>
          </div>

          {/* Mode filter pills */}
          {result && (
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              {["any", "sea", "air", "rail"].map((m) => (
                <button
                  key={m}
                  onClick={() => setModeFilter(m)}
                  className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                    modeFilter === m
                      ? "bg-blue-700 text-white border-blue-700"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                  }`}
                >
                  {m === "any" ? "All Modes" : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-gray-400 self-center">
                {visible.length} option{visible.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-5">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Summary strip */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 mb-5 flex flex-wrap gap-4 items-center text-xs text-gray-500">
              <span className="font-semibold text-gray-800">{result.corridor}</span>
              <span>From <strong className="text-gray-900">${result.cheapestUSD.toLocaleString()}</strong></span>
              <span>Fastest <strong className="text-gray-900">{result.fastestDays} days</strong></span>
              <span className="flex items-center gap-1">
                <Leaf className="w-3.5 h-3.5 text-emerald-500" />
                Min CO₂ <strong className="text-gray-900">{result.lowestCarbonKg} kg</strong>
              </span>
              {result.operationalAlert && (
                <span className="flex items-center gap-1 text-orange-600 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> {result.operationalAlert}
                </span>
              )}
            </div>

            {/* Compliance note */}
            {result.complianceNote && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 mb-5 leading-relaxed">
                <strong>Compliance:</strong> {result.complianceNote}
              </div>
            )}

            {/* Option grid */}
            {visible.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visible.map((option) => (
                  <OptionCard key={option.optionId} option={option} onBook={handleBook} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-xs text-gray-400">
                No options match selected mode filter
              </div>
            )}
          </>
        )}

        {!result && !loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Package className="w-10 h-10 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-semibold text-gray-700 mb-1">Enter your corridor details to compare freight rates</p>
            <p className="text-xs text-gray-400">Choose an origin, destination, cargo weight, and priority then hit Compare to see your options.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense>
      <CompareContent />
    </Suspense>
  );
}
