"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/app/components/Navbar";
import {
  ArrowRight,
  Ship,
  Plane,
  Train,
  Leaf,
  Clock,
  DollarSign,
  Shield,
  AlertTriangle,
  Star,
  Calculator,
  Globe,
  CheckCircle,
  Zap,
  ShieldCheck,
  TrendingUp,
  Box,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ORIGIN_COUNTRIES = [
  "India", "UAE", "Singapore", "China", "Bangladesh", "Vietnam",
  "Thailand", "Malaysia", "Germany", "Netherlands", "USA", "UK", "Australia",
];

const DEST_COUNTRIES = [
  "Netherlands", "Germany", "USA", "UK", "France", "Italy",
  "Kenya", "Tanzania", "UAE", "Singapore", "Australia", "Canada", "Japan",
];

const PORTS: Record<string, string[]> = {
  India:       ["Nhava Sheva (Mumbai)", "Chennai", "Mundra", "Kolkata", "Cochin"],
  UAE:         ["Jebel Ali", "Abu Dhabi (Khalifa Port)", "Sharjah"],
  Singapore:   ["Singapore (PSA — Tanjong Pagar)"],
  China:       ["Shanghai", "Shenzhen / Yantian", "Ningbo", "Qingdao"],
  Bangladesh:  ["Chittagong"],
  Vietnam:     ["Ho Chi Minh City (Cat Lai)", "Hai Phong"],
  Thailand:    ["Laem Chabang", "Bangkok (Ta Phut)"],
  Malaysia:    ["Port Klang", "Penang"],
  Germany:     ["Hamburg", "Bremen / Bremerhaven"],
  Netherlands: ["Rotterdam", "Amsterdam"],
  USA:         ["New York / Newark", "Los Angeles / Long Beach", "Houston", "Savannah"],
  UK:          ["Felixstowe", "Southampton", "London Gateway"],
  France:      ["Le Havre", "Marseille"],
  Italy:       ["Genoa", "La Spezia"],
  Kenya:       ["Mombasa"],
  Tanzania:    ["Dar es Salaam"],
  Australia:   ["Melbourne", "Sydney"],
  Canada:      ["Vancouver", "Montreal"],
  Japan:       ["Yokohama", "Kobe"],
};

const CARGO_CATEGORIES = [
  "General Cargo",
  "Textiles & Apparel",
  "Electronics & Technology",
  "Pharmaceuticals & Life Sciences",
  "Chemicals & Petrochemicals",
  "Food & Agriculture",
  "Machinery & Industrial Equipment",
  "Automotive & Spare Parts",
  "Construction Materials",
  "Furniture & Home Goods",
  "Dangerous Goods (DG)",
];

// ─── Corridor profiles ────────────────────────────────────────────────────────

type CorridorProfile = {
  seaDays: number; seaCostPerKg: number; seaDistKm: number;
  seaCarrier: string; seaReliability: number;
  airDays: number; airCostPerKg: number; airDistKm: number;
  hasRail: boolean; railDays: number; railCostPerKg: number;
  compliance: string | null; operationalAlert: string | null;
};

const CORRIDORS: Record<string, CorridorProfile> = {
  "india-netherlands": {
    seaDays: 28, seaCostPerKg: 0.19, seaDistKm: 12000,
    seaCarrier: "Maersk / MSC", seaReliability: 78,
    airDays: 2, airCostPerKg: 3.2, airDistKm: 7200,
    hasRail: true, railDays: 22, railCostPerKg: 0.42,
    compliance: "EU CBAM reporting applies from 2026 for textiles, metals, and chemicals. EU CSDDD supply chain due diligence required from 2026. Ensure no Xinjiang-origin materials if cargo is re-exported to the US.",
    operationalAlert: "Red Sea / Suez disruptions active. Cape of Good Hope reroute adds 8–10 days and ~$900/TEU. Monitor corridor status daily.",
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
    compliance: "UFLPA applies — full supply chain traceability required. US CBP may detain goods with Xinjiang-origin material. Section 301 tariffs on most Indian goods. FDA prior notice required for pharma and food.",
    operationalAlert: null,
  },
  "india-uk": {
    seaDays: 27, seaCostPerKg: 0.21, seaDistKm: 12000,
    seaCarrier: "Maersk / Evergreen", seaReliability: 80,
    airDays: 2, airCostPerKg: 3.4, airDistKm: 7300,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "UK DCTS preferential rates available for qualifying Indian exports (0% duty with 35% rules of origin value addition). UK Modern Slavery Act transparency obligation applies.",
    operationalAlert: "Red Sea disruptions may add 5–7 days. Monitor UK Border Force post-Brexit import requirements.",
  },
  "india-france": {
    seaDays: 29, seaCostPerKg: 0.20, seaDistKm: 12200,
    seaCarrier: "CMA CGM / MSC", seaReliability: 79,
    airDays: 2, airCostPerKg: 3.3, airDistKm: 7100,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "EU CBAM from 2026. EU GSP for qualifying Indian goods. French customs: Déclaration en douane required.",
    operationalAlert: "Red Sea disruptions active.",
  },
  "india-italy": {
    seaDays: 26, seaCostPerKg: 0.19, seaDistKm: 10500,
    seaCarrier: "MSC / Hapag-Lloyd", seaReliability: 80,
    airDays: 2, airCostPerKg: 3.2, airDistKm: 6800,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "EU CBAM from 2026. REACH compliance for chemicals. Mediterranean routing via Suez or Gibraltar.",
    operationalAlert: "Red Sea / Suez active disruption zone.",
  },
  "uae-kenya": {
    seaDays: 13, seaCostPerKg: 0.15, seaDistKm: 4000,
    seaCarrier: "DP World / MSC", seaReliability: 85,
    airDays: 1, airCostPerKg: 2.8, airDistKm: 3400,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "Kenya Revenue Authority (KRA) pre-shipment inspection required for electronics and high-value goods. Certificate of conformity must match HS code on manifest. KEBS product standards apply.",
    operationalAlert: null,
  },
  "uae-tanzania": {
    seaDays: 14, seaCostPerKg: 0.16, seaDistKm: 4500,
    seaCarrier: "MSC / Evergreen", seaReliability: 83,
    airDays: 2, airCostPerKg: 2.9, airDistKm: 3800,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "EAC Certificate of Origin for preferential duty within East African Community. Tanzania Revenue Authority (TRA) import permit may be required for restricted goods.",
    operationalAlert: null,
  },
  "singapore-netherlands": {
    seaDays: 28, seaCostPerKg: 0.21, seaDistKm: 15000,
    seaCarrier: "CMA CGM / ONE", seaReliability: 84,
    airDays: 3, airCostPerKg: 3.5, airDistKm: 10500,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "EU dual-use export controls apply for semiconductors and advanced electronics. CBAM from 2026. Singapore Certificate of Origin for EU GSP tariff preferences.",
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
    compliance: "US-Singapore FTA provides preferential access on qualifying goods. UFLPA traceability required if supply chain touches Xinjiang. Semiconductor export controls may require US BIS license.",
    operationalAlert: null,
  },
  "china-usa": {
    seaDays: 18, seaCostPerKg: 0.27, seaDistKm: 11000,
    seaCarrier: "COSCO / Evergreen / ONE", seaReliability: 80,
    airDays: 2, airCostPerKg: 4.2, airDistKm: 9500,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "Section 301 tariffs: 7.5%–25%+ on most goods. UFLPA — US CBP detains goods traceable to Xinjiang. Export controls on advanced semiconductors and AI chips require US BIS license.",
    operationalAlert: "Trans-Pacific freight rates elevated. Port congestion at Los Angeles may add 2–4 days.",
  },
  "china-netherlands": {
    seaDays: 30, seaCostPerKg: 0.22, seaDistKm: 20000,
    seaCarrier: "COSCO / Maersk", seaReliability: 81,
    airDays: 3, airCostPerKg: 3.8, airDistKm: 9000,
    hasRail: true, railDays: 14, railCostPerKg: 0.40,
    compliance: "EU anti-dumping duties apply on Chinese steel and some electronics. CBAM from 2026 for metals and cement. Dual-use export licensing for advanced components.",
    operationalAlert: null,
  },
  "china-germany": {
    seaDays: 32, seaCostPerKg: 0.23, seaDistKm: 21000,
    seaCarrier: "COSCO / Hapag-Lloyd", seaReliability: 80,
    airDays: 3, airCostPerKg: 3.9, airDistKm: 9200,
    hasRail: true, railDays: 14, railCostPerKg: 0.42,
    compliance: "EU anti-dumping duties on Chinese goods. REACH for chemicals. Dual-use export check for electronics. Germany FDI screening may apply for strategic goods.",
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
  "bangladesh-usa": {
    seaDays: 26, seaCostPerKg: 0.22, seaDistKm: 15000,
    seaCarrier: "Hapag-Lloyd / ONE", seaReliability: 79,
    airDays: 3, airCostPerKg: 3.7, airDistKm: 12000,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "UFLPA traceability required. Anti-circumvention audits apply if Chinese-origin inputs detected. OTEXA textile quotas may apply.",
    operationalAlert: null,
  },
  "vietnam-usa": {
    seaDays: 22, seaCostPerKg: 0.24, seaDistKm: 14000,
    seaCarrier: "ONE / Evergreen", seaReliability: 82,
    airDays: 2, airCostPerKg: 3.9, airDistKm: 12000,
    hasRail: false, railDays: 0, railCostPerKg: 0,
    compliance: "Anti-circumvention checks: US CBP verifies genuine Vietnamese origin. AD/CVD duties apply on steel, solar panels, and furniture. Country of origin documentation critical.",
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
};

const DEFAULT_PROFILE: CorridorProfile = {
  seaDays: 25, seaCostPerKg: 0.22, seaDistKm: 12000,
  seaCarrier: "Major Ocean Carrier", seaReliability: 80,
  airDays: 3, airCostPerKg: 3.8, airDistKm: 9000,
  hasRail: false, railDays: 0, railCostPerKg: 0,
  compliance: "Verify applicable customs regulations, import duties, and trade compliance requirements for this corridor before booking.",
  operationalAlert: null,
};

function getProfile(origin: string, dest: string): CorridorProfile {
  const key = `${origin.toLowerCase()}-${dest.toLowerCase()}`;
  return CORRIDORS[key] ?? DEFAULT_PROFILE;
}

// ─── Duty rate table (avg import duty by destination) ─────────────────────────

const DUTY_RATES: Record<string, number> = {
  Netherlands: 0.045, Germany: 0.045, France: 0.045, Italy: 0.045,
  USA: 0.055, UK: 0.04, Kenya: 0.14, Tanzania: 0.14,
  UAE: 0.05, Singapore: 0.0, Australia: 0.05, Canada: 0.035, Japan: 0.03,
};
function getDutyRate(dest: string) { return DUTY_RATES[dest] ?? 0.05; }

// ─── Types ────────────────────────────────────────────────────────────────────

interface RouteEstimate {
  id: string;
  name: string;
  mode: "sea" | "air" | "rail";
  carrier: string;
  transitDays: number;
  costUSD: number;
  landedCostUSD: number;   // freight + insurance + est. duty
  carbonKgCO2e: number;
  reliability: number;
  isRecommended: boolean;
  recommendReason: string; // why this is the best pick
  batterySurcharge: number;
}

interface EstResult {
  routes: RouteEstimate[];
  etaDate: string;
  complianceNote: string | null;
  operationalAlert: string | null;
  bestCostUSD: number;
  bestCarbonKg: number;
  bestLandedCostUSD: number;
  insuranceCostUSD: number;
  dutyEstimateUSD: number;
}

// ─── Estimation logic ─────────────────────────────────────────────────────────

function runEstimation(
  originCountry: string,
  destCountry: string,
  weightKg: number,
  volumeCBM: number,
  modePreference: string,
  priority: string,
  declaredValueUSD: number,
  insuranceRequired: boolean,
  hasBattery: boolean,
): EstResult {
  const profile = getProfile(originCountry, destCountry);
  const seaChargeable = Math.max(weightKg, volumeCBM * 1000 * 0.35);
  const airChargeable = Math.max(weightKg, volumeCBM * 167);

  // Landed cost components
  const insuranceCostUSD = insuranceRequired ? Math.round(declaredValueUSD * 0.0045) : 0;
  const dutyEstimateUSD  = Math.round(declaredValueUSD * getDutyRate(destCountry));
  const batterySea = hasBattery ? 150 : 0;
  const batteryAir = hasBattery ? 350 : 0;

  const routes: RouteEstimate[] = [];

  if (modePreference === "any" || modePreference === "sea") {
    const freight = Math.round(seaChargeable * profile.seaCostPerKg + 850) + batterySea;
    routes.push({
      id: "sea", name: "Ocean Freight", mode: "sea",
      carrier: profile.seaCarrier,
      transitDays: profile.seaDays,
      costUSD: freight,
      landedCostUSD: freight + insuranceCostUSD + dutyEstimateUSD,
      carbonKgCO2e: Math.max(80, Math.round(weightKg * profile.seaDistKm * 0.016 / 1000)),
      reliability: profile.seaReliability,
      isRecommended: false, recommendReason: "", batterySurcharge: batterySea,
    });
  }

  if (modePreference === "any" || modePreference === "air") {
    const freight = Math.round(airChargeable * profile.airCostPerKg + 380) + batteryAir;
    routes.push({
      id: "air", name: "Air Freight", mode: "air",
      carrier: "Emirates SkyCargo / Qatar Airways Cargo",
      transitDays: profile.airDays,
      costUSD: freight,
      landedCostUSD: freight + insuranceCostUSD + dutyEstimateUSD,
      carbonKgCO2e: Math.max(200, Math.round(weightKg * profile.airDistKm * 0.55 / 1000)),
      reliability: 94,
      isRecommended: false, recommendReason: "", batterySurcharge: batteryAir,
    });
  }

  if (profile.hasRail && (modePreference === "any" || modePreference === "rail")) {
    const freight = Math.round(seaChargeable * profile.railCostPerKg + 1400);
    routes.push({
      id: "rail", name: "Multimodal Rail", mode: "rail",
      carrier: "INSTC / China–Europe Rail Consortium",
      transitDays: profile.railDays,
      costUSD: freight,
      landedCostUSD: freight + insuranceCostUSD + dutyEstimateUSD,
      carbonKgCO2e: Math.max(30, Math.round(weightKg * profile.seaDistKm * 0.007 / 1000)),
      reliability: 81,
      isRecommended: false, recommendReason: "", batterySurcharge: 0,
    });
  }

  if (routes.length === 0) {
    const freight = Math.round(seaChargeable * profile.seaCostPerKg + 850) + batterySea;
    routes.push({
      id: "sea", name: "Ocean Freight", mode: "sea",
      carrier: profile.seaCarrier,
      transitDays: profile.seaDays,
      costUSD: freight,
      landedCostUSD: freight + insuranceCostUSD + dutyEstimateUSD,
      carbonKgCO2e: Math.max(80, Math.round(weightKg * profile.seaDistKm * 0.016 / 1000)),
      reliability: profile.seaReliability,
      isRecommended: false, recommendReason: "", batterySurcharge: batterySea,
    });
  }

  // Pick recommended
  let recommendedId: string;
  if (priority === "fastest") {
    recommendedId = routes.reduce((a, b) => a.transitDays < b.transitDays ? a : b).id;
  } else if (priority === "lowest_cost") {
    recommendedId = routes.reduce((a, b) => a.costUSD < b.costUSD ? a : b).id;
  } else if (priority === "low_carbon") {
    recommendedId = routes.reduce((a, b) => a.carbonKgCO2e < b.carbonKgCO2e ? a : b).id;
  } else {
    const maxCost  = Math.max(...routes.map((r) => r.costUSD));
    const maxDays  = Math.max(...routes.map((r) => r.transitDays));
    const maxCarbon = Math.max(...routes.map((r) => r.carbonKgCO2e));
    recommendedId = routes
      .map((r) => ({
        id: r.id,
        score: (r.costUSD / maxCost) * 0.35 + (r.transitDays / maxDays) * 0.30
          + (r.carbonKgCO2e / maxCarbon) * 0.15 - (r.reliability / 100) * 0.20,
      }))
      .reduce((a, b) => (a.score < b.score ? a : b)).id;
  }

  // Annotate recommended with reason
  const seaRoute = routes.find((r) => r.mode === "sea");
  const airRoute = routes.find((r) => r.mode === "air");
  routes.forEach((r) => {
    r.isRecommended = r.id === recommendedId;
    if (!r.isRecommended) return;
    if (priority === "fastest") {
      const saved = seaRoute && seaRoute.id !== r.id ? seaRoute.transitDays - r.transitDays : 0;
      r.recommendReason = saved > 0
        ? `Arrives ${saved} days faster than sea freight`
        : "Fastest available option for this corridor";
    } else if (priority === "lowest_cost") {
      const max = Math.max(...routes.map((x) => x.costUSD));
      const saves = max - r.costUSD;
      r.recommendReason = saves > 100
        ? `Saves $${saves.toLocaleString()} vs next-fastest option`
        : "Most cost-efficient mode for this corridor";
    } else if (priority === "low_carbon") {
      if (airRoute && r.carbonKgCO2e < airRoute.carbonKgCO2e) {
        const pct = Math.round((1 - r.carbonKgCO2e / airRoute.carbonKgCO2e) * 100);
        r.recommendReason = `${pct}% lower CO₂e than air freight`;
      } else {
        r.recommendReason = "Lowest carbon footprint for this corridor";
      }
    } else {
      if (r.mode === "sea")  r.recommendReason = `Best cost-transit balance · ${r.reliability}% on-time rate`;
      else if (r.mode === "rail") r.recommendReason = "Faster than sea, greener than air · mid-range cost";
      else r.recommendReason = `High reliability · suits time-sensitive or high-value cargo`;
    }
  });

  const recommended = routes.find((r) => r.id === recommendedId)!;
  const eta = new Date();
  eta.setDate(eta.getDate() + recommended.transitDays + 3);

  return {
    routes,
    etaDate: eta.toLocaleDateString("en-GB", { dateStyle: "long" }),
    complianceNote: profile.compliance,
    operationalAlert: profile.operationalAlert,
    bestCostUSD:       Math.min(...routes.map((r) => r.costUSD)),
    bestCarbonKg:      Math.min(...routes.map((r) => r.carbonKgCO2e)),
    bestLandedCostUSD: Math.min(...routes.map((r) => r.landedCostUSD)),
    insuranceCostUSD,
    dutyEstimateUSD,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const MODE_ICONS: Record<string, React.ReactNode> = {
  sea:  <Ship className="w-4 h-4" />,
  air:  <Plane className="w-4 h-4" />,
  rail: <Train className="w-4 h-4" />,
};
const MODE_COLORS: Record<string, { bg: string; text: string }> = {
  sea:  { bg: "bg-blue-50",    text: "text-blue-600" },
  air:  { bg: "bg-orange-50",  text: "text-orange-600" },
  rail: { bg: "bg-emerald-50", text: "text-emerald-600" },
};

function ToggleField({
  label, hint, value, onChange,
}: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-600 mb-1 block font-medium">
        {label}
        {hint && <span className="ml-1 font-normal text-gray-400">{hint}</span>}
      </label>
      <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-semibold h-9">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 transition-colors ${!value ? "bg-gray-100 text-gray-800" : "bg-white text-gray-400 hover:bg-gray-50"}`}
        >
          No
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 transition-colors ${value ? "bg-blue-700 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
        >
          Yes
        </button>
      </div>
    </div>
  );
}

function RouteCard({ route, bookHref }: { route: RouteEstimate; bookHref?: string }) {
  const mc = MODE_COLORS[route.mode] ?? MODE_COLORS.sea;
  const carbonColor =
    route.carbonKgCO2e < 500 ? "text-emerald-600" :
    route.carbonKgCO2e < 5000 ? "text-amber-600" : "text-orange-600";
  const carbonLabel = route.carbonKgCO2e < 1000
    ? `${route.carbonKgCO2e} kg`
    : `${(route.carbonKgCO2e / 1000).toFixed(1)} t`;

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm p-4 ${route.isRecommended ? "border-blue-500" : "border-gray-200"}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${mc.bg} ${mc.text}`}>
            {MODE_ICONS[route.mode]}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">{route.name}</div>
            <div className="text-[11px] text-gray-400">{route.carrier}</div>
          </div>
        </div>
        {route.isRecommended && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 shrink-0">
            <Star className="w-2.5 h-2.5" /> BEST PICK
          </span>
        )}
      </div>

      {/* Metrics grid — 5 columns */}
      <div className="grid grid-cols-5 gap-1.5 text-center mb-3">
        <div className="bg-gray-50 rounded-lg py-2">
          <div className="text-[10px] text-gray-400 mb-0.5">Transit</div>
          <div className="text-sm font-bold text-gray-900">{route.transitDays}d</div>
        </div>
        <div className="bg-gray-50 rounded-lg py-2">
          <div className="text-[10px] text-gray-400 mb-0.5">Freight</div>
          <div className="text-sm font-bold text-gray-900">${route.costUSD.toLocaleString()}</div>
        </div>
        <div className="bg-gray-50 rounded-lg py-2 col-span-1">
          <div className="text-[10px] text-gray-400 mb-0.5">Landed</div>
          <div className="text-sm font-bold text-blue-700">${route.landedCostUSD.toLocaleString()}</div>
        </div>
        <div className="bg-gray-50 rounded-lg py-2">
          <div className="text-[10px] text-gray-400 mb-0.5">CO₂e</div>
          <div className={`text-sm font-bold ${carbonColor}`}>{carbonLabel}</div>
        </div>
        <div className="bg-gray-50 rounded-lg py-2">
          <div className="text-[10px] text-gray-400 mb-0.5">On-time</div>
          <div className="text-sm font-bold text-gray-900">{route.reliability}%</div>
        </div>
      </div>

      {/* Recommendation reason */}
      {route.isRecommended && route.recommendReason && (
        <div className="flex items-center gap-1.5 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 mb-3">
          <Star className="w-3 h-3 shrink-0" />
          {route.recommendReason}
        </div>
      )}

      {/* Battery surcharge notice */}
      {route.batterySurcharge > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mb-3">
          <Zap className="w-3 h-3 shrink-0" />
          DG / battery surcharge: +${route.batterySurcharge} included in freight cost
        </div>
      )}

      {bookHref && (
        <Link
          href={bookHref}
          className="w-full flex items-center justify-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
        >
          Create Shipment <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EstimatePage() {
  const [form, setForm] = useState({
    // Route
    originCountry:      "India",
    originPort:         "Nhava Sheva (Mumbai)",
    destinationCountry: "Netherlands",
    destinationPort:    "Rotterdam",
    // Cargo Details
    cargoCategory:    "Textiles & Apparel",
    weightKg:         "5000",
    volumeCBM:        "18",
    packageCount:     "",
    declaredValueUSD: "10000",
    hasBattery:       false,
    // Shipment Preferences
    modePreference:      "any",
    priority:            "balanced",
    incoterm:            "FOB",
    insuranceRequired:   false,
  });
  const [result, setResult] = useState<EstResult | null>(null);

  function handleOriginCountry(value: string) {
    const ports = PORTS[value] ?? [];
    setForm((f) => ({ ...f, originCountry: value, originPort: ports[0] ?? "" }));
  }
  function handleDestCountry(value: string) {
    const ports = PORTS[value] ?? [];
    setForm((f) => ({ ...f, destinationCountry: value, destinationPort: ports[0] ?? "" }));
  }

  function calculate() {
    const weight   = Math.max(parseFloat(form.weightKg) || 1000, 1);
    const volume   = Math.max(parseFloat(form.volumeCBM) || 3, 0.1);
    const declared = Math.max(parseFloat(form.declaredValueUSD) || 0, 0);
    setResult(runEstimation(
      form.originCountry, form.destinationCountry,
      weight, volume, form.modePreference, form.priority,
      declared, form.insuranceRequired, form.hasBattery,
    ));
  }

  function buildBookHref(route: RouteEstimate): string {
    const p = new URLSearchParams({
      origin:     form.originCountry,
      dest:       form.destinationCountry,
      originPort: form.originPort,
      destPort:   form.destinationPort,
      mode:       route.mode,
      cargo:      form.cargoCategory,
      weight:     form.weightKg,
      volume:     form.volumeCBM,
      cost:       String(route.costUSD),
      days:       String(route.transitDays),
      carrier:    route.carrier,
      priority:   form.priority,
      carbon:     String(route.carbonKgCO2e),
      value:      form.declaredValueUSD,
      incoterm:   form.incoterm,
    });
    return `/shipments/new?${p.toString()}`;
  }

  const originPorts = PORTS[form.originCountry] ?? ["—"];
  const destPorts   = PORTS[form.destinationCountry] ?? ["—"];
  const inputCls    = "w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const sectionHdr  = "text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-blue-600" />
            Shipping Estimator
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Get instant estimates covering freight cost, landed cost, ETA, carbon footprint, and compliance notes. No account required.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-5 items-start">

          {/* ── Form — 2/5 ──────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-5">

              {/* ── Route ── */}
              <div>
                <div className={sectionHdr}>
                  <Globe className="w-3.5 h-3.5" /> Route
                </div>
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block font-medium">Origin Country</label>
                      <select value={form.originCountry} onChange={(e) => handleOriginCountry(e.target.value)} className={inputCls}>
                        {ORIGIN_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block font-medium">Origin Port</label>
                      <select value={form.originPort} onChange={(e) => setForm((f) => ({ ...f, originPort: e.target.value }))} className={inputCls}>
                        {originPorts.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
                    <ArrowRight className="w-3 h-3" />
                    <span>to</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block font-medium">Destination Country</label>
                      <select value={form.destinationCountry} onChange={(e) => handleDestCountry(e.target.value)} className={inputCls}>
                        {DEST_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block font-medium">Destination Port</label>
                      <select value={form.destinationPort} onChange={(e) => setForm((f) => ({ ...f, destinationPort: e.target.value }))} className={inputCls}>
                        {destPorts.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Cargo Details ── */}
              <div>
                <div className={sectionHdr}>
                  <Box className="w-3.5 h-3.5" /> Cargo Details
                </div>
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block font-medium">Cargo Category</label>
                    <select value={form.cargoCategory} onChange={(e) => setForm((f) => ({ ...f, cargoCategory: e.target.value }))} className={inputCls}>
                      {CARGO_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block font-medium">Weight (kg)</label>
                      <input type="number" value={form.weightKg} onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))} placeholder="5000" className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block font-medium">Volume (CBM)</label>
                      <input type="number" value={form.volumeCBM} onChange={(e) => setForm((f) => ({ ...f, volumeCBM: e.target.value }))} placeholder="18" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block font-medium">
                        Declared Value <span className="font-normal text-gray-400">(USD)</span>
                      </label>
                      <input type="number" value={form.declaredValueUSD} onChange={(e) => setForm((f) => ({ ...f, declaredValueUSD: e.target.value }))} placeholder="10000" className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block font-medium">
                        Cartons / Packages <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <input type="number" value={form.packageCount} onChange={(e) => setForm((f) => ({ ...f, packageCount: e.target.value }))} placeholder="200" className={inputCls} />
                    </div>
                  </div>
                  <ToggleField
                    label="Battery / Restricted Goods"
                    hint="(DG / lithium)"
                    value={form.hasBattery}
                    onChange={(v) => setForm((f) => ({ ...f, hasBattery: v }))}
                  />
                </div>
              </div>

              {/* ── Shipment Preferences ── */}
              <div>
                <div className={sectionHdr}>
                  <TrendingUp className="w-3.5 h-3.5" /> Shipment Preferences
                </div>
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block font-medium">Transport Mode</label>
                      <select value={form.modePreference} onChange={(e) => setForm((f) => ({ ...f, modePreference: e.target.value }))} className={inputCls}>
                        <option value="any">Compare All</option>
                        <option value="sea">Sea Only</option>
                        <option value="air">Air Only</option>
                        <option value="rail">Rail Only</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block font-medium">Delivery Priority</label>
                      <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className={inputCls}>
                        <option value="balanced">Balanced</option>
                        <option value="lowest_cost">Cost Priority</option>
                        <option value="fastest">Urgent / Express</option>
                        <option value="low_carbon">Green Logistics</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block font-medium">
                      Incoterm <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <select value={form.incoterm} onChange={(e) => setForm((f) => ({ ...f, incoterm: e.target.value }))} className={inputCls}>
                      <option value="FOB">FOB — Free on Board</option>
                      <option value="CIF">CIF — Cost, Insurance & Freight</option>
                      <option value="DAP">DAP — Delivered at Place</option>
                      <option value="DDP">DDP — Delivered Duty Paid</option>
                      <option value="CFR">CFR — Cost & Freight</option>
                      <option value="EXW">EXW — Ex Works</option>
                    </select>
                  </div>
                  <ToggleField
                    label="Marine Insurance"
                    hint="(~0.45% of cargo value)"
                    value={form.insuranceRequired}
                    onChange={(v) => setForm((f) => ({ ...f, insuranceRequired: v }))}
                  />
                </div>
              </div>

              <button
                onClick={calculate}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Calculator className="w-4 h-4" />
                {result ? "Recalculate" : "Get Estimate"}
              </button>

              {!result && (
                <p className="text-[11px] text-gray-400 text-center -mt-2">
                  No account required · Instant results
                </p>
              )}
            </div>
          </div>

          {/* ── Results — 3/5 ────────────────────────────────────── */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {!result ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center p-14 text-center h-full min-h-[420px]">
                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                  <Globe className="w-7 h-7 text-blue-600" />
                </div>
                <p className="text-gray-700 font-semibold mb-1">Your estimate will appear here</p>
                <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                  Fill in the form and click <strong>Get Estimate</strong> to compare routes across
                  freight cost, landed cost, ETA, and carbon footprint.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-gray-500">
                  {["Freight cost", "Landed cost", "ETA forecast", "CO₂ comparison", "Compliance notes"].map((t) => (
                    <div key={t} className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> {t}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* KPI strip — 4 cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      icon: DollarSign,
                      label: "Freight",
                      value: `from $${result.bestCostUSD.toLocaleString()}`,
                      sub: "est. freight only",
                      cls: "text-emerald-600 bg-emerald-50",
                    },
                    {
                      icon: TrendingUp,
                      label: "Landed Cost",
                      value: `~$${result.bestLandedCostUSD.toLocaleString()}`,
                      sub: `incl. duty${result.insuranceCostUSD ? " + insurance" : ""}`,
                      cls: "text-blue-600 bg-blue-50",
                    },
                    {
                      icon: Clock,
                      label: "Best ETA",
                      value: result.etaDate,
                      sub: `${result.routes.find((r) => r.isRecommended)?.transitDays}d transit`,
                      cls: "text-violet-600 bg-violet-50",
                    },
                    {
                      icon: Leaf,
                      label: "CO₂e (best)",
                      value: result.bestCarbonKg < 1000
                        ? `${result.bestCarbonKg} kg`
                        : `${(result.bestCarbonKg / 1000).toFixed(1)} t`,
                      sub: "lowest mode",
                      cls: "text-emerald-600 bg-emerald-50",
                    },
                  ].map(({ icon: Icon, label, value, sub, cls }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 text-center">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-2 ${cls}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-sm font-bold text-gray-900 leading-tight">{value}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5 font-medium">{label}</div>
                      <div className="text-[10px] text-gray-400">{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Insurance / duty breakdown hint */}
                {(result.insuranceCostUSD > 0 || result.dutyEstimateUSD > 0) && (
                  <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 bg-white border border-gray-100 rounded-xl px-4 py-2.5">
                    <span className="font-medium text-gray-700">Landed cost breakdown:</span>
                    {result.insuranceCostUSD > 0 && (
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-blue-500" />
                        Insurance ~${result.insuranceCostUSD.toLocaleString()}
                      </span>
                    )}
                    {result.dutyEstimateUSD > 0 && (
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3 text-violet-500" />
                        Est. import duty ~${result.dutyEstimateUSD.toLocaleString()}
                      </span>
                    )}
                    <span className="text-gray-400 ml-auto">Duty figures are indicative. Verify the final amount with your customs broker.</span>
                  </div>
                )}

                {/* Route cards */}
                {result.routes.map((r) => (
                  <RouteCard key={r.id} route={r} bookHref={buildBookHref(r)} />
                ))}

                {/* Operational alert */}
                {result.operationalAlert && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-amber-800 mb-0.5">Operational Notice</div>
                      <div className="text-xs text-amber-700 leading-relaxed">{result.operationalAlert}</div>
                    </div>
                  </div>
                )}

                {/* Compliance note */}
                {result.complianceNote && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-blue-800 mb-0.5">Compliance &amp; Regulatory Notes</div>
                      <div className="text-xs text-blue-700 leading-relaxed">{result.complianceNote}</div>
                    </div>
                  </div>
                )}

                {/* CTA */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <p className="text-sm font-semibold text-gray-900 mb-0.5">Ready to create this shipment?</p>
                  <p className="text-xs text-gray-500 mb-4">
                    Your estimate details carry over into the booking form automatically. Add your shipper information, run the AI compliance check, and your shipment is live in minutes.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Link
                      href={buildBookHref(result.routes.find((r) => r.isRecommended) ?? result.routes[0])}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors"
                    >
                      Create Shipment <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      href="/dashboard"
                      className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 hover:text-blue-700 text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
                    >
                      View Dashboard
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
