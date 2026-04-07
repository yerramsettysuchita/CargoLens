// ─── Freight Rate Options Model ───────────────────────────────────────────────
// Returns multiple carrier/provider options per mode for a given corridor.
// Extends the base estimation engine with carrier-level granularity.

import { getCorridorProfile, type EstimationInput, type RouteEstimate } from "./estimation";

export interface CarrierOption extends RouteEstimate {
  optionId: string;       // e.g. "sea-maersk"
  providerNote: string;   // e.g. "Direct service via Suez / Cape"
  validUntil: string;     // indicative rate validity
}

export interface RateComparisonResult {
  options: CarrierOption[];
  corridor: string;
  complianceNote: string | null;
  operationalAlert: string | null;
  cheapestUSD: number;
  fastestDays: number;
  lowestCarbonKg: number;
  summary: string;
}

// ─── Carrier variant definitions ──────────────────────────────────────────────
// Multipliers applied to base corridor profile per carrier.

interface CarrierVariant {
  carrier: string;
  costMult: number;
  daysMult: number;
  reliability: number;
  carbonMult: number;
  providerNote: string;
}

const SEA_CARRIERS: CarrierVariant[] = [
  { carrier: "Maersk",        costMult: 1.00, daysMult: 1.00, reliability: 84, carbonMult: 1.00, providerNote: "Weekly direct service, digital tracking via Maersk.com" },
  { carrier: "MSC",           costMult: 0.92, daysMult: 1.06, reliability: 79, carbonMult: 1.03, providerNote: "High capacity, competitive rates, 2–3 day buffer built in" },
  { carrier: "CMA CGM",       costMult: 0.96, daysMult: 1.03, reliability: 81, carbonMult: 0.97, providerNote: "Strong EU network, LNG-powered vessels on key corridors" },
  { carrier: "Hapag-Lloyd",   costMult: 1.04, daysMult: 0.97, reliability: 86, carbonMult: 0.98, providerNote: "Premium reliability, biweekly direct departure" },
];

const AIR_CARRIERS: CarrierVariant[] = [
  { carrier: "Emirates SkyCargo",    costMult: 1.00, daysMult: 1.00, reliability: 96, carbonMult: 1.00, providerNote: "Daily freighter, Dubai hub, strong pharma/perishable handling" },
  { carrier: "Qatar Airways Cargo",  costMult: 0.94, daysMult: 1.00, reliability: 94, carbonMult: 1.01, providerNote: "Doha hub, competitive spot rates, cold chain certified" },
  { carrier: "Lufthansa Cargo",      costMult: 1.07, daysMult: 0.95, reliability: 97, carbonMult: 0.99, providerNote: "Frankfurt hub, priority handling, strong EU inbound capacity" },
];

const RAIL_CARRIERS: CarrierVariant[] = [
  { carrier: "DB Schenker Rail",    costMult: 1.00, daysMult: 1.00, reliability: 82, carbonMult: 1.00, providerNote: "China–Europe block train, weekly departures, customs at border" },
  { carrier: "FESCO / INSTC",       costMult: 0.86, daysMult: 1.10, reliability: 74, carbonMult: 0.95, providerNote: "India–Russia–Europe via INSTC; lower cost but variable schedule" },
];

// Validity date: 7 days from now (indicative for demo)
function rateValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("en-GB", { dateStyle: "medium" });
}

function normalize(v: number, lo: number, hi: number) {
  return hi === lo ? 0.5 : (v - lo) / (hi - lo);
}

export function getRateOptions(input: EstimationInput): RateComparisonResult {
  const { originCountry, destinationCountry, weightKg, volumeCBM, modePreference, priority } = input;
  const profile = getCorridorProfile(originCountry, destinationCountry);
  const seaChargeable = Math.max(weightKg, volumeCBM * 1000 * 0.35);
  const airChargeable = Math.max(weightKg, volumeCBM * 167);
  const validity = rateValidUntil();
  const options: CarrierOption[] = [];

  // ─── Sea options ────────────────────────────────────────────────────────────
  if (modePreference === "any" || modePreference === "sea") {
    SEA_CARRIERS.forEach((v) => {
      options.push({
        optionId: `sea-${v.carrier.toLowerCase().replace(/\s/g, "-")}`,
        id: "sea",
        name: "Ocean Freight",
        mode: "sea",
        carrier: v.carrier,
        transitDays: Math.round(profile.seaDays * v.daysMult),
        costUSD: Math.round(seaChargeable * profile.seaCostPerKg * v.costMult + 850),
        carbonKgCO2e: Math.max(80, Math.round(weightKg * profile.seaDistKm * 0.016 * v.carbonMult / 1000)),
        reliability: v.reliability,
        isRecommended: false,
        score: 0,
        recommendationReason: "",
        co2VsBaseline: 0,
        providerNote: v.providerNote,
        validUntil: validity,
      });
    });
  }

  // ─── Air options ────────────────────────────────────────────────────────────
  if (modePreference === "any" || modePreference === "air") {
    AIR_CARRIERS.forEach((v) => {
      options.push({
        optionId: `air-${v.carrier.toLowerCase().replace(/\s/g, "-")}`,
        id: "air",
        name: "Air Freight",
        mode: "air",
        carrier: v.carrier,
        transitDays: Math.round(profile.airDays * v.daysMult),
        costUSD: Math.round(airChargeable * profile.airCostPerKg * v.costMult + 380),
        carbonKgCO2e: Math.max(200, Math.round(weightKg * profile.airDistKm * 0.55 * v.carbonMult / 1000)),
        reliability: v.reliability,
        isRecommended: false,
        score: 0,
        recommendationReason: "",
        co2VsBaseline: 0,
        providerNote: v.providerNote,
        validUntil: validity,
      });
    });
  }

  // ─── Rail options ────────────────────────────────────────────────────────────
  if (profile.hasRail && (modePreference === "any" || modePreference === "rail")) {
    RAIL_CARRIERS.forEach((v) => {
      options.push({
        optionId: `rail-${v.carrier.toLowerCase().replace(/\s/g, "-")}`,
        id: "rail",
        name: "Multimodal Rail",
        mode: "rail",
        carrier: v.carrier,
        transitDays: Math.round(profile.railDays * v.daysMult),
        costUSD: Math.round(seaChargeable * profile.railCostPerKg * v.costMult + 1400),
        carbonKgCO2e: Math.max(30, Math.round(weightKg * profile.seaDistKm * 0.007 * v.carbonMult / 1000)),
        reliability: v.reliability,
        isRecommended: false,
        score: 0,
        recommendationReason: "",
        co2VsBaseline: 0,
        providerNote: v.providerNote,
        validUntil: validity,
      });
    });
  }

  // ─── Score all options ────────────────────────────────────────────────────
  const maxCarbon  = Math.max(...options.map((o) => o.carbonKgCO2e));
  const maxCost    = Math.max(...options.map((o) => o.costUSD));
  const minCost    = Math.min(...options.map((o) => o.costUSD));
  const maxDays    = Math.max(...options.map((o) => o.transitDays));
  const minDays    = Math.min(...options.map((o) => o.transitDays));
  const minCarbon  = Math.min(...options.map((o) => o.carbonKgCO2e));
  const minRel     = Math.min(...options.map((o) => o.reliability));
  const maxRel     = Math.max(...options.map((o) => o.reliability));

  const weights = {
    balanced:    { cost: 0.35, time: 0.30, carbon: 0.15, reliability: 0.20 },
    fastest:     { cost: 0.10, time: 0.60, carbon: 0.10, reliability: 0.20 },
    lowest_cost: { cost: 0.60, time: 0.20, carbon: 0.10, reliability: 0.10 },
    low_carbon:  { cost: 0.20, time: 0.20, carbon: 0.50, reliability: 0.10 },
  };
  const w = weights[priority] ?? weights.balanced;

  options.forEach((o) => {
    o.co2VsBaseline = maxCarbon - o.carbonKgCO2e;
    const raw =
      normalize(o.costUSD,      minCost,  maxCost)  * w.cost +
      normalize(o.transitDays,  minDays,  maxDays)  * w.time +
      normalize(o.carbonKgCO2e, minCarbon,maxCarbon) * w.carbon +
      (1 - normalize(o.reliability, minRel, maxRel)) * w.reliability;
    o.score = Math.round((1 - raw) * 100);
  });

  // Mark recommended
  const best = options.reduce((a, b) => a.score > b.score ? a : b);
  options.forEach((o) => {
    o.isRecommended = o.optionId === best.optionId;
    o.recommendationReason = buildOptionReason(o, priority, options);
  });

  options.sort((a, b) => b.score - a.score);

  const corridor = `${originCountry} → ${destinationCountry}`;
  return {
    options,
    corridor,
    complianceNote: profile.compliance,
    operationalAlert: profile.operationalAlert,
    cheapestUSD: minCost,
    fastestDays: minDays,
    lowestCarbonKg: minCarbon,
    summary: `${options.length} carrier options found for ${corridor}. Recommended: ${best.carrier} (${best.mode}, score ${best.score}/100).`,
  };
}

function buildOptionReason(o: CarrierOption, priority: string, all: CarrierOption[]): string {
  const cheapest = all.reduce((a, b) => a.costUSD < b.costUSD ? a : b);
  const fastest  = all.reduce((a, b) => a.transitDays < b.transitDays ? a : b);
  const greenest = all.reduce((a, b) => a.carbonKgCO2e < b.carbonKgCO2e ? a : b);

  const tags: string[] = [];
  if (o.optionId === cheapest.optionId) tags.push("lowest cost");
  if (o.optionId === fastest.optionId)  tags.push("fastest");
  if (o.optionId === greenest.optionId) tags.push("lowest carbon");

  if (o.isRecommended && tags.length > 0)
    return `Recommended: ${tags.join(" + ")} among all ${all.length} options`;
  if (o.isRecommended)
    return `Highest composite score for ${priority} priority across cost, speed, carbon, and reliability`;
  if (tags.length > 0)
    return `Best for ${tags.join(" / ")} — score ${o.score}/100`;
  const savingPct = o.co2VsBaseline > 0
    ? ` · saves ${Math.round((o.co2VsBaseline / (o.co2VsBaseline + o.carbonKgCO2e)) * 100)}% CO₂ vs worst`
    : "";
  return `Score ${o.score}/100${savingPct}`;
}
