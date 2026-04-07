// ─── Estimation Engine ────────────────────────────────────────────────────────
// Shared backend logic for route estimation. Used by /api/estimate and the
// estimate page. Corridor profiles drive cost, ETA, carbon, compliance outputs.

export type TransportMode = "sea" | "air" | "rail";

export interface CorridorProfile {
  seaDays: number; seaCostPerKg: number; seaDistKm: number;
  seaCarrier: string; seaReliability: number;
  airDays: number; airCostPerKg: number; airDistKm: number;
  hasRail: boolean; railDays: number; railCostPerKg: number;
  compliance: string | null;
  operationalAlert: string | null;
}

export interface RouteEstimate {
  id: string;
  name: string;
  mode: TransportMode;
  carrier: string;
  transitDays: number;
  costUSD: number;
  carbonKgCO2e: number;
  reliability: number;
  isRecommended: boolean;
  score: number;            // 0–100, higher is better
  recommendationReason: string;
  co2VsBaseline: number;    // kg saved vs highest-carbon option (positive = savings)
}

export interface EstimationResult {
  routes: RouteEstimate[];
  etaDate: string;
  complianceNote: string | null;
  operationalAlert: string | null;
  bestCostUSD: number;
  bestCarbonKg: number;
  corridor: string;
}

export interface EstimationInput {
  originCountry: string;
  destinationCountry: string;
  weightKg: number;
  volumeCBM: number;
  modePreference: "any" | "sea" | "air" | "rail";
  priority: "balanced" | "fastest" | "lowest_cost" | "low_carbon";
}

// ─── Corridor Profiles ────────────────────────────────────────────────────────

const CORRIDOR_PROFILES: Record<string, CorridorProfile> = {
  "india-netherlands": {
    seaDays: 28, seaCostPerKg: 0.19, seaDistKm: 12000,
    seaCarrier: "Maersk / MSC", seaReliability: 78,
    airDays: 2, airCostPerKg: 3.2, airDistKm: 7200,
    hasRail: true, railDays: 22, railCostPerKg: 0.42,
    compliance: "EU CBAM reporting applies from 2026 for textiles, metals, and chemicals. EU CSDDD supply chain due diligence required. Ensure no Xinjiang-origin materials if cargo is re-exported to the US.",
    operationalAlert: "Red Sea / Suez disruptions active. Cape of Good Hope reroute adds 8–10 days and ~$900/TEU.",
  },
  "india-germany": {
    seaDays: 30, seaCostPerKg: 0.20, seaDistKm: 12500,
    seaCarrier: "Hapag-Lloyd / CMA CGM", seaReliability: 76,
    airDays: 2, airCostPerKg: 3.3, airDistKm: 7500,
    hasRail: true, railDays: 23, railCostPerKg: 0.44,
    compliance: "EU CBAM from 2026. Dual-use export controls apply for electronics and semiconductors. REACH compliance required for chemical products.",
    operationalAlert: "Red Sea / Suez disruptions active. Cape reroute adds 8–10 days.",
  },
  "india-usa": {
    seaDays: 24, seaCostPerKg: 0.23, seaDistKm: 16000,
    seaCarrier: "Hapag-Lloyd / ONE", seaReliability: 82,
    airDays: 3, airCostPerKg: 3.8, airDistKm: 13500,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "UFLPA applies — full supply chain traceability required. Section 301 tariffs on most Indian goods. FDA prior notice required for pharma and food.",
    operationalAlert: null,
  },
  "india-uk": {
    seaDays: 27, seaCostPerKg: 0.21, seaDistKm: 12000,
    seaCarrier: "Maersk / Evergreen", seaReliability: 80,
    airDays: 2, airCostPerKg: 3.4, airDistKm: 7300,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "UK DCTS preferential rates available for qualifying Indian exports. UK Modern Slavery Act transparency obligation applies.",
    operationalAlert: "Red Sea disruptions may add 5–7 days.",
  },
  "uae-kenya": {
    seaDays: 13, seaCostPerKg: 0.15, seaDistKm: 4000,
    seaCarrier: "DP World / MSC", seaReliability: 85,
    airDays: 1, airCostPerKg: 2.8, airDistKm: 3400,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "Kenya Revenue Authority (KRA) pre-shipment inspection required for electronics and high-value goods. Certificate of conformity must match HS code on manifest.",
    operationalAlert: null,
  },
  "uae-tanzania": {
    seaDays: 14, seaCostPerKg: 0.16, seaDistKm: 4500,
    seaCarrier: "MSC / Evergreen", seaReliability: 83,
    airDays: 2, airCostPerKg: 2.9, airDistKm: 3800,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "EAC Certificate of Origin required for preferential duty within East African Community. Tanzania Revenue Authority import permit may be required.",
    operationalAlert: null,
  },
  "uae-south africa": {
    seaDays: 16, seaCostPerKg: 0.17, seaDistKm: 7000,
    seaCarrier: "MSC / Maersk", seaReliability: 82,
    airDays: 2, airCostPerKg: 3.0, airDistKm: 6500,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "SARS customs clearance required. SADC Certificate of Origin for preferential tariff access where applicable.",
    operationalAlert: null,
  },
  "singapore-netherlands": {
    seaDays: 28, seaCostPerKg: 0.21, seaDistKm: 15000,
    seaCarrier: "CMA CGM / ONE", seaReliability: 84,
    airDays: 3, airCostPerKg: 3.5, airDistKm: 10500,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "EU dual-use export controls for semiconductors and advanced electronics. CBAM from 2026. Singapore Certificate of Origin for EU GSP tariff preferences.",
    operationalAlert: null,
  },
  "singapore-germany": {
    seaDays: 30, seaCostPerKg: 0.22, seaDistKm: 15500,
    seaCarrier: "Evergreen / Hapag-Lloyd", seaReliability: 83,
    airDays: 3, airCostPerKg: 3.6, airDistKm: 10800,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "German import declaration required. Dual-use goods check for electronics. REACH for chemicals. CSDDD from 2026.",
    operationalAlert: null,
  },
  "singapore-usa": {
    seaDays: 22, seaCostPerKg: 0.24, seaDistKm: 15000,
    seaCarrier: "ONE / Maersk", seaReliability: 82,
    airDays: 2, airCostPerKg: 4.0, airDistKm: 15000,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "US-Singapore FTA provides preferential access on qualifying goods. UFLPA traceability required. Semiconductor export controls may require US BIS license.",
    operationalAlert: null,
  },
  "china-usa": {
    seaDays: 18, seaCostPerKg: 0.27, seaDistKm: 11000,
    seaCarrier: "COSCO / Evergreen / ONE", seaReliability: 80,
    airDays: 2, airCostPerKg: 4.2, airDistKm: 9500,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "Section 301 tariffs: 7.5%–25%+ on most goods. UFLPA — US CBP detains goods traceable to Xinjiang. Export controls on advanced semiconductors require US BIS license.",
    operationalAlert: "Trans-Pacific freight rates elevated. Port congestion at Los Angeles may add 2–4 days.",
  },
  "china-netherlands": {
    seaDays: 30, seaCostPerKg: 0.22, seaDistKm: 20000,
    seaCarrier: "COSCO / Maersk", seaReliability: 81,
    airDays: 3, airCostPerKg: 3.8, airDistKm: 9000,
    hasRail: true, railDays: 14, railCostPerKg: 0.40,
    compliance: "EU anti-dumping duties apply on Chinese steel and some electronics. CBAM from 2026. Dual-use export licensing for advanced components.",
    operationalAlert: null,
  },
  "china-germany": {
    seaDays: 32, seaCostPerKg: 0.23, seaDistKm: 21000,
    seaCarrier: "COSCO / Hapag-Lloyd", seaReliability: 80,
    airDays: 3, airCostPerKg: 3.9, airDistKm: 9200,
    hasRail: true, railDays: 14, railCostPerKg: 0.42,
    compliance: "EU anti-dumping duties on Chinese goods. REACH for chemicals. Dual-use export check for electronics.",
    operationalAlert: null,
  },
  "bangladesh-netherlands": {
    seaDays: 25, seaCostPerKg: 0.17, seaDistKm: 11000,
    seaCarrier: "MSC / Maersk", seaReliability: 77,
    airDays: 2, airCostPerKg: 3.1, airDistKm: 7000,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "EU EBA (Everything But Arms) grants 0% duty for qualifying exports. ILO convention compliance required for GSP+ eligibility. CBAM from 2026.",
    operationalAlert: "Red Sea disruptions may add 8 days via Cape reroute.",
  },
  "vietnam-usa": {
    seaDays: 22, seaCostPerKg: 0.24, seaDistKm: 14000,
    seaCarrier: "ONE / Evergreen", seaReliability: 82,
    airDays: 2, airCostPerKg: 3.9, airDistKm: 12000,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "Anti-circumvention checks: US CBP verifies genuine Vietnamese origin. AD/CVD duties apply on steel, solar panels, and furniture.",
    operationalAlert: null,
  },
  "vietnam-netherlands": {
    seaDays: 26, seaCostPerKg: 0.20, seaDistKm: 14000,
    seaCarrier: "CMA CGM / Maersk", seaReliability: 81,
    airDays: 3, airCostPerKg: 3.4, airDistKm: 10000,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "EU-Vietnam FTA (EVFTA) provides preferential access. Certificate of Origin EUR.1 required. CBAM from 2026 for metals.",
    operationalAlert: null,
  },
  "netherlands-nigeria": {
    seaDays: 27, seaCostPerKg: 0.18, seaDistKm: 8500,
    seaCarrier: "Hapag-Lloyd / MSC", seaReliability: 76,
    airDays: 3, airCostPerKg: 3.2, airDistKm: 5000,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "Nigerian Customs SON pre-inspection mandatory for electrical equipment. Form M pre-import declaration required via CBN Single Window. NAFDAC permit for consumables.",
    operationalAlert: "Lagos Port (Apapa/Tin Can) congestion remains elevated — 4–7 day berth wait typical.",
  },
  "china-uae": {
    seaDays: 18, seaCostPerKg: 0.21, seaDistKm: 7500,
    seaCarrier: "COSCO / CMA CGM", seaReliability: 78,
    airDays: 2, airCostPerKg: 3.6, airDistKm: 6500,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "UAE import permit required for heavy machinery and regulated equipment. Chinese export customs clearance (Customs Declaration Form) mandatory. UAE conformity mark (ESMA) required for consumer goods.",
    operationalAlert: null,
  },
  "china-kenya": {
    seaDays: 22, seaCostPerKg: 0.22, seaDistKm: 9500,
    seaCarrier: "COSCO / MSC", seaReliability: 76,
    airDays: 3, airCostPerKg: 3.7, airDistKm: 8000,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "KRA pre-shipment inspection required. Certificate of Conformity mandatory. Kenya Standards Bureau (KEBS) approval needed for electronics and electrical goods.",
    operationalAlert: null,
  },
};

const DEFAULT_PROFILE: CorridorProfile = {
  seaDays: 25, seaCostPerKg: 0.22, seaDistKm: 12000,
  seaCarrier: "Major Ocean Carrier", seaReliability: 80,
  airDays: 3, airCostPerKg: 3.8, airDistKm: 9000,
  hasRail: false, railDays: 0, railCostPerKg: 0,
  compliance: "Verify applicable customs regulations, import duties, and trade compliance requirements for this corridor before booking.",
  operationalAlert: null,
};

export function getCorridorProfile(origin: string, destination: string): CorridorProfile {
  const key = `${origin.toLowerCase()}-${destination.toLowerCase()}`;
  return CORRIDOR_PROFILES[key] ?? DEFAULT_PROFILE;
}

// ─── Recommendation reason builder ───────────────────────────────────────────

function buildReason(
  route: RouteEstimate,
  priority: string,
  all: RouteEstimate[],
): string {
  const cheapest  = all.reduce((a, b) => a.costUSD < b.costUSD ? a : b);
  const fastest   = all.reduce((a, b) => a.transitDays < b.transitDays ? a : b);
  const greenest  = all.reduce((a, b) => a.carbonKgCO2e < b.carbonKgCO2e ? a : b);

  if (priority === "fastest" && route.id === fastest.id)
    return `Fastest option — ${route.transitDays}-day transit, ${route.reliability}% on-time reliability`;
  if (priority === "lowest_cost" && route.id === cheapest.id)
    return `Most cost-effective — $${route.costUSD.toLocaleString()} total, ${route.transitDays} days`;
  if (priority === "low_carbon" && route.id === greenest.id)
    return `Lowest carbon footprint — ${route.carbonKgCO2e} kg CO₂e, ${((route.co2VsBaseline / Math.max(route.carbonKgCO2e + route.co2VsBaseline, 1)) * 100).toFixed(0)}% cleaner than alternatives`;
  if (route.isRecommended) {
    const parts: string[] = [];
    if (route.id === cheapest.id) parts.push("lowest cost");
    if (route.id === fastest.id) parts.push("fastest transit");
    if (route.id === greenest.id) parts.push("lowest carbon");
    if (parts.length > 0) return `Recommended: ${parts.join(" + ")} across available options`;
    return `Best balanced score — cost, speed, carbon, and reliability weighted for ${priority} priority`;
  }
  const deltas: string[] = [];
  const costDiff = route.costUSD - cheapest.costUSD;
  if (costDiff > 0) deltas.push(`+$${costDiff.toLocaleString()} vs cheapest`);
  const dayDiff = route.transitDays - fastest.transitDays;
  if (dayDiff > 0) deltas.push(`+${dayDiff}d vs fastest`);
  return deltas.length > 0 ? `Alternative option — ${deltas.join(", ")}` : "Alternative option";
}

// ─── Core estimation function ─────────────────────────────────────────────────

export function runEstimation(input: EstimationInput): EstimationResult {
  const { originCountry, destinationCountry, weightKg, volumeCBM, modePreference, priority } = input;
  const profile = getCorridorProfile(originCountry, destinationCountry);
  const seaChargeable = Math.max(weightKg, volumeCBM * 1000 * 0.35);
  const airChargeable = Math.max(weightKg, volumeCBM * 167);
  const routes: RouteEstimate[] = [];

  const BLANK = { score: 0, recommendationReason: "", co2VsBaseline: 0 };

  if (modePreference === "any" || modePreference === "sea") {
    routes.push({
      id: "sea", name: "Ocean Freight", mode: "sea",
      carrier: profile.seaCarrier,
      transitDays: profile.seaDays,
      costUSD: Math.round(seaChargeable * profile.seaCostPerKg + 850),
      carbonKgCO2e: Math.max(80, Math.round(weightKg * profile.seaDistKm * 0.016 / 1000)),
      reliability: profile.seaReliability,
      isRecommended: false, ...BLANK,
    });
  }

  if (modePreference === "any" || modePreference === "air") {
    routes.push({
      id: "air", name: "Air Freight", mode: "air",
      carrier: "Emirates SkyCargo / Qatar Airways Cargo",
      transitDays: profile.airDays,
      costUSD: Math.round(airChargeable * profile.airCostPerKg + 380),
      carbonKgCO2e: Math.max(200, Math.round(weightKg * profile.airDistKm * 0.55 / 1000)),
      reliability: 94,
      isRecommended: false, ...BLANK,
    });
  }

  if (profile.hasRail && (modePreference === "any" || modePreference === "rail")) {
    routes.push({
      id: "rail", name: "Multimodal Rail", mode: "rail",
      carrier: "INSTC / China–Europe Rail Consortium",
      transitDays: profile.railDays,
      costUSD: Math.round(seaChargeable * profile.railCostPerKg + 1400),
      carbonKgCO2e: Math.max(30, Math.round(weightKg * profile.seaDistKm * 0.007 / 1000)),
      reliability: 81,
      isRecommended: false, ...BLANK,
    });
  }

  if (routes.length === 0) {
    routes.push({
      id: "sea", name: "Ocean Freight", mode: "sea",
      carrier: profile.seaCarrier,
      transitDays: profile.seaDays,
      costUSD: Math.round(seaChargeable * profile.seaCostPerKg + 850),
      carbonKgCO2e: Math.max(80, Math.round(weightKg * profile.seaDistKm * 0.016 / 1000)),
      reliability: profile.seaReliability,
      isRecommended: false, score: 0, recommendationReason: "", co2VsBaseline: 0,
    });
  }

  // ─── Scoring ──────────────────────────────────────────────────────────────
  const maxCost = Math.max(...routes.map((r) => r.costUSD));
  const minCost = Math.min(...routes.map((r) => r.costUSD));
  const maxDays = Math.max(...routes.map((r) => r.transitDays));
  const minDays = Math.min(...routes.map((r) => r.transitDays));
  const maxCarbon = Math.max(...routes.map((r) => r.carbonKgCO2e));
  const minCarbon = Math.min(...routes.map((r) => r.carbonKgCO2e));
  const minRel = Math.min(...routes.map((r) => r.reliability));
  const maxRel = Math.max(...routes.map((r) => r.reliability));

  const weights = {
    balanced:    { cost: 0.35, time: 0.30, carbon: 0.15, reliability: 0.20 },
    fastest:     { cost: 0.10, time: 0.60, carbon: 0.10, reliability: 0.20 },
    lowest_cost: { cost: 0.60, time: 0.20, carbon: 0.10, reliability: 0.10 },
    low_carbon:  { cost: 0.20, time: 0.20, carbon: 0.50, reliability: 0.10 },
  };
  const w = weights[priority] ?? weights.balanced;

  const norm = (v: number, lo: number, hi: number) =>
    hi === lo ? 0.5 : (v - lo) / (hi - lo);

  routes.forEach((r) => {
    const costN    = norm(r.costUSD,      minCost,   maxCost);   // 0=cheapest
    const timeN    = norm(r.transitDays,  minDays,   maxDays);   // 0=fastest
    const carbonN  = norm(r.carbonKgCO2e, minCarbon, maxCarbon); // 0=greenest
    const relN     = 1 - norm(r.reliability, minRel, maxRel);    // 0=most reliable
    const raw = costN * w.cost + timeN * w.time + carbonN * w.carbon + relN * w.reliability;
    r.score = Math.round((1 - raw) * 100);
    r.co2VsBaseline = maxCarbon - r.carbonKgCO2e; // kg saved vs worst option
  });

  let recommendedId = routes.reduce((a, b) => a.score > b.score ? a : b).id;

  routes.forEach((r) => {
    r.isRecommended = r.id === recommendedId;
    r.recommendationReason = buildReason(r, priority, routes);
  });

  const recommended = routes.find((r) => r.isRecommended)!;
  const eta = new Date();
  eta.setDate(eta.getDate() + recommended.transitDays + 3);

  const corridorLabel = `${originCountry} → ${destinationCountry}`;

  return {
    routes,
    etaDate: eta.toLocaleDateString("en-GB", { dateStyle: "long" }),
    complianceNote: profile.compliance,
    operationalAlert: profile.operationalAlert,
    bestCostUSD: Math.min(...routes.map((r) => r.costUSD)),
    bestCarbonKg: Math.min(...routes.map((r) => r.carbonKgCO2e)),
    corridor: corridorLabel,
  };
}
