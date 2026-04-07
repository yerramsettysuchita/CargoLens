// ─── Route Optimization Engine ────────────────────────────────────────────────
// Given a shipment, generates 4–5 alternative routes (sea direct, sea alternate
// via Cape/different transshipment, express air, rail where available, and a
// multimodal option) then scores each against the shipment's priority.
//
// Scoring formula:
//   score = costW*(1-normCost) + timeW*(1-normDays) + carbonW*(1-normCarbon)
//           + reliabilityW*normReliability + riskW*(1-normRisk)
// Weights are tuned per priority:
//   urgent     : time 40%, cost 10%, carbon 5%, reliability 35%, risk 10%
//   low-cost   : cost 40%, time 15%, carbon 15%, reliability 20%, risk 10%
//   balanced   : cost 22%, time 22%, carbon 22%, reliability 22%, risk 12%
//   green      : carbon 40%, cost 18%, time 12%, reliability 18%, risk 12%

import type { Shipment } from "@/app/lib/supabase/shipment-types";
import { getCorridorProfile } from "./estimation";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RouteMode = "sea" | "air" | "rail" | "multimodal";

export interface RouteWaypoint {
  port:    string;
  country: string;
  lat:     number;
  lon:     number;
  type:    "origin" | "transshipment" | "destination";
}

export interface OptimizedRoute {
  id:              string;
  name:            string;
  mode:            RouteMode;
  carrier:         string;
  transitDays:     number;
  totalCostUSD:    number;
  carbonKgCO2e:    number;
  scheduleReliabilityPct: number;
  riskScore:       number;       // 0–100 (higher = riskier)
  score:           number;       // 0–100 (higher = better)
  isRecommended:   boolean;
  recommendation:  string;
  waypoints:       RouteWaypoint[];
  highlights:      string[];     // bullet points
  warnings:        string[];     // amber/red flags
  via:             string;       // human-readable routing e.g. "via Suez Canal"
}

export interface RouteOptimizationResult {
  routes:          OptimizedRoute[];
  recommended:     OptimizedRoute;
  priorityApplied: string;
  originPort:      string;
  destinationPort: string;
  complianceNote:  string | null;
  alert:           string | null;
}

// ─── Port coordinate database ──────────────────────────────────────────────────
// lat/lon used by RouteMap for positioning and arc drawing

export const PORT_COORDS: Record<string, { lat: number; lon: number; country: string }> = {
  // Indian Subcontinent
  "Nhava Sheva":         { lat: 18.9, lon: 72.9, country: "India" },
  "Mundra":              { lat: 22.8, lon: 70.0, country: "India" },
  "Chennai":             { lat: 13.1, lon: 80.3, country: "India" },
  "Kolkata":             { lat: 22.5, lon: 88.3, country: "India" },
  "Visakhapatnam":       { lat: 17.7, lon: 83.3, country: "India" },
  "Kochi":               { lat: 9.9,  lon: 76.3, country: "India" },
  "Colombo":             { lat: 6.9,  lon: 79.8, country: "Sri Lanka" },
  "Chittagong":          { lat: 22.3, lon: 91.8, country: "Bangladesh" },
  "Karachi":             { lat: 24.8, lon: 67.0, country: "Pakistan" },

  // Middle East
  "Jebel Ali":           { lat: 25.0, lon: 55.1, country: "UAE" },
  "Abu Dhabi":           { lat: 24.5, lon: 54.4, country: "UAE" },
  "Bandar Abbas":        { lat: 27.2, lon: 56.3, country: "Iran" },
  "Aqaba":               { lat: 29.5, lon: 35.0, country: "Jordan" },
  "Salalah":             { lat: 16.9, lon: 54.0, country: "Oman" },
  "Dammam":              { lat: 26.4, lon: 50.1, country: "Saudi Arabia" },

  // SE Asia
  "Singapore Port":      { lat: 1.3,  lon: 103.8, country: "Singapore" },
  "Port Klang":          { lat: 3.0,  lon: 101.4, country: "Malaysia" },
  "Ho Chi Minh City":    { lat: 10.7, lon: 106.9, country: "Vietnam" },
  "Jakarta":             { lat: -6.1, lon: 106.8, country: "Indonesia" },
  "Bangkok":             { lat: 13.5, lon: 100.9, country: "Thailand" },
  "Manila":              { lat: 14.6, lon: 120.9, country: "Philippines" },

  // China
  "Shanghai":            { lat: 31.2, lon: 121.5, country: "China" },
  "Shenzhen / Yantian":  { lat: 22.5, lon: 114.2, country: "China" },
  "Ningbo":              { lat: 29.9, lon: 121.6, country: "China" },
  "Qingdao":             { lat: 36.1, lon: 120.4, country: "China" },
  "Tianjin":             { lat: 38.9, lon: 117.7, country: "China" },
  "Guangzhou":           { lat: 23.1, lon: 113.3, country: "China" },
  "Yantian":             { lat: 22.5, lon: 114.2, country: "China" },

  // NE Asia
  "Busan":               { lat: 35.1, lon: 129.0, country: "South Korea" },
  "Tokyo":               { lat: 35.7, lon: 139.7, country: "Japan" },
  "Yokohama":            { lat: 35.4, lon: 139.6, country: "Japan" },

  // Europe
  "Rotterdam":           { lat: 51.9, lon: 4.5,  country: "Netherlands" },
  "Hamburg":             { lat: 53.5, lon: 9.9,  country: "Germany" },
  "Antwerp":             { lat: 51.2, lon: 4.4,  country: "Belgium" },
  "Felixstowe":          { lat: 51.9, lon: 1.3,  country: "UK" },
  "Barcelona":           { lat: 41.4, lon: 2.2,  country: "Spain" },
  "Piraeus":             { lat: 37.9, lon: 23.6, country: "Greece" },
  "Le Havre":            { lat: 49.5, lon: 0.1,  country: "France" },
  "Genoa":               { lat: 44.4, lon: 8.9,  country: "Italy" },
  "Valencia":            { lat: 39.5, lon: -0.3, country: "Spain" },

  // Africa
  "Mombasa":             { lat: -4.0, lon: 39.7, country: "Kenya" },
  "Dar es Salaam":       { lat: -6.8, lon: 39.3, country: "Tanzania" },
  "Durban":              { lat: -29.9, lon: 31.0, country: "South Africa" },
  "Lagos Apapa":         { lat: 6.4,  lon: 3.4,  country: "Nigeria" },
  "Tema":                { lat: 5.6,  lon: -0.0, country: "Ghana" },
  "Abidjan":             { lat: 5.2,  lon: -4.0, country: "Ivory Coast" },
  "Alexandria":          { lat: 31.2, lon: 29.9, country: "Egypt" },
  "Cape Town":           { lat: -33.9, lon: 18.4, country: "South Africa" },

  // Americas
  "Los Angeles / Long Beach": { lat: 33.8, lon: -118.2, country: "USA" },
  "New York / Newark":   { lat: 40.7, lon: -74.0, country: "USA" },
  "Houston":             { lat: 29.7, lon: -95.0, country: "USA" },
  "Savannah":            { lat: 32.0, lon: -81.1, country: "USA" },
  "Miami":               { lat: 25.7, lon: -80.2, country: "USA" },
  "Seattle / Tacoma":    { lat: 47.6, lon: -122.4, country: "USA" },
  "Santos":              { lat: -23.9, lon: -46.3, country: "Brazil" },
  "Buenaventura":        { lat: 3.9,  lon: -77.1, country: "Colombia" },
  "Vancouver":           { lat: 49.3, lon: -123.1, country: "Canada" },

  // Australia/Pacific
  "Sydney":              { lat: -33.9, lon: 151.2, country: "Australia" },
  "Melbourne":           { lat: -37.8, lon: 144.9, country: "Australia" },
  "Auckland":            { lat: -36.8, lon: 174.8, country: "New Zealand" },
};

// Lookup port coords with fuzzy matching
export function getPortCoords(portName: string): { lat: number; lon: number; country: string } | null {
  if (!portName) return null;
  const key = portName.trim();
  if (PORT_COORDS[key]) return PORT_COORDS[key];
  const keyLow = key.toLowerCase();
  for (const [name, data] of Object.entries(PORT_COORDS)) {
    if (name.toLowerCase().includes(keyLow) || keyLow.includes(name.toLowerCase().split(" ")[0])) {
      return data;
    }
  }
  return null;
}

// ─── Priority weight sets ──────────────────────────────────────────────────────

interface PriorityWeights {
  cost: number; time: number; carbon: number; reliability: number; risk: number;
}

const PRIORITY_WEIGHTS: Record<string, PriorityWeights> = {
  "urgent":    { cost: 0.10, time: 0.40, carbon: 0.05, reliability: 0.35, risk: 0.10 },
  "low-cost":  { cost: 0.40, time: 0.15, carbon: 0.15, reliability: 0.20, risk: 0.10 },
  "balanced":  { cost: 0.22, time: 0.22, carbon: 0.22, reliability: 0.22, risk: 0.12 },
  "green":     { cost: 0.18, time: 0.12, carbon: 0.40, reliability: 0.18, risk: 0.12 },
  "medium":    { cost: 0.22, time: 0.22, carbon: 0.22, reliability: 0.22, risk: 0.12 },
  "high":      { cost: 0.10, time: 0.35, carbon: 0.10, reliability: 0.35, risk: 0.10 },
};

// ─── Geopolitical risk overlay for specific routes ─────────────────────────────

const ROUTE_RISKS: Record<string, number> = {
  "suez":            40,  // Active Red Sea disruption
  "cape":            15,  // Longer but safer
  "trans-siberian":  30,  // Geopolitical risk Russia transit
  "instc":           35,  // Iran/Russia corridor sanctions risk
  "transpacific":    20,
  "transatlantic":   12,
  "default":         18,
};

// ─── Carbon emission factors (kg CO₂e per tonne-km) ──────────────────────────

const EMISSION_FACTORS = {
  sea:          0.016,  // container ship, GLEC Framework
  sea_cape:     0.018,  // slightly higher (longer route, older vessels)
  air:          0.55,   // narrowbody/widebody cargo aircraft
  rail:         0.007,  // electrified rail
  rail_diesel:  0.022,  // diesel rail (Russia, some BRI segments)
};

// ─── Waypoint builder ─────────────────────────────────────────────────────────

function buildWaypoints(
  originPort: string,
  destPort: string,
  originCountry: string,
  destCountry: string,
  via: string[],
): RouteWaypoint[] {
  const originCoords = getPortCoords(originPort);
  const destCoords   = getPortCoords(destPort);

  const wps: RouteWaypoint[] = [];

  wps.push({
    port: originPort, country: originCountry,
    lat: originCoords?.lat ?? 0, lon: originCoords?.lon ?? 0, type: "origin",
  });

  for (const v of via) {
    const vc = getPortCoords(v);
    if (vc) {
      wps.push({ port: v, country: vc.country, lat: vc.lat, lon: vc.lon, type: "transshipment" });
    }
  }

  wps.push({
    port: destPort, country: destCountry,
    lat: destCoords?.lat ?? 0, lon: destCoords?.lon ?? 0, type: "destination",
  });

  return wps;
}

// ─── Core route generator ─────────────────────────────────────────────────────

export function optimizeRoutes(shipment: Shipment): RouteOptimizationResult {
  const profile = getCorridorProfile(shipment.origin_country, shipment.destination_country);
  const weightKg  = shipment.weight ?? 1000;
  const volumeCBM = shipment.volume ?? 5;

  // Chargeable weight (higher of actual weight and volumetric)
  const seaChargeable = Math.max(weightKg, volumeCBM * 1000 * 0.35);
  const airChargeable = Math.max(weightKg, volumeCBM * 167);

  const originPort = shipment.origin_port;
  const destPort   = shipment.destination_port;
  const originCountry = shipment.origin_country;
  const destCountry   = shipment.destination_country;

  // ── Route definitions ─────────────────────────────────────────────────────

  const routes: Omit<OptimizedRoute, "score" | "isRecommended" | "recommendation">[] = [];

  // 1. Standard sea (via current default route — Suez or Cape depending on corridor)
  const seaViaNote = profile.operationalAlert?.includes("Red Sea") ? "via Cape of Good Hope" : "via Suez Canal";
  const seaViaDays = profile.operationalAlert?.includes("Red Sea") ? profile.seaDays + 9 : profile.seaDays;
  const seaViaCost = Math.round(seaChargeable * profile.seaCostPerKg + 850
    + (profile.operationalAlert?.includes("Red Sea") ? 900 : 0));
  const seaViaDistKm = profile.operationalAlert?.includes("Red Sea") ? profile.seaDistKm + 6000 : profile.seaDistKm;

  routes.push({
    id: "sea_standard",
    name: "Ocean Freight",
    mode: "sea",
    carrier: profile.seaCarrier,
    transitDays: seaViaDays,
    totalCostUSD: seaViaCost,
    carbonKgCO2e: Math.round(weightKg * seaViaDistKm * EMISSION_FACTORS.sea / 1000),
    scheduleReliabilityPct: profile.seaReliability,
    riskScore: profile.operationalAlert?.includes("Red Sea") ? ROUTE_RISKS.suez : ROUTE_RISKS.default,
    highlights: [
      `${seaViaDays}-day transit, ${profile.seaReliability}% schedule reliability`,
      `Lowest cost per kg at scale — $${(seaViaCost / weightKg).toFixed(3)}/kg`,
      seaViaNote === "via Cape of Good Hope"
        ? "Cape route active — Red Sea / Suez disruption bypass"
        : "Standard Suez Canal route, optimal lane",
    ],
    warnings: profile.operationalAlert ? [profile.operationalAlert] : [],
    via: seaViaNote,
    waypoints: buildWaypoints(originPort, destPort, originCountry, destCountry,
      seaViaNote.includes("Cape") ? ["Cape Town"] : []),
  });

  // 2. Alternative sea (via different transshipment hub)
  const altTransship = destCountry.toLowerCase().includes("europe") || destCountry.toLowerCase().includes("netherlands") || destCountry.toLowerCase().includes("germany")
    ? "Colombo"
    : originCountry.toLowerCase().includes("india") && destCountry.toLowerCase().includes("united states")
    ? "Colombo"
    : "Singapore Port";
  const altSeaDays  = Math.round(seaViaDays * 1.06);
  const altSeaCost  = Math.round(seaViaCost * 0.90);  // cheaper via consolidation hub
  routes.push({
    id: "sea_alt",
    name: "Sea via Transshipment Hub",
    mode: "sea",
    carrier: "MSC / CMA CGM",
    transitDays: altSeaDays,
    totalCostUSD: altSeaCost,
    carbonKgCO2e: Math.round(weightKg * seaViaDistKm * EMISSION_FACTORS.sea_cape / 1000),
    scheduleReliabilityPct: Math.max(60, profile.seaReliability - 6),
    riskScore: ROUTE_RISKS.cape,
    highlights: [
      `Transshipment via ${altTransship} reduces per-unit rate ~10%`,
      "Useful for LCL / partial loads",
      "More carrier options; flexibility on departure window",
    ],
    warnings: ["Additional 1–2 days at transshipment port", "Cargo handling risk slightly higher for transshipment"],
    via: `via ${altTransship}`,
    waypoints: buildWaypoints(originPort, destPort, originCountry, destCountry, [altTransship]),
  });

  // 3. Express air
  const airDays = profile.airDays;
  const airCost = Math.round(airChargeable * profile.airCostPerKg + 400);
  const airDistKm = profile.airDistKm;
  routes.push({
    id: "air_express",
    name: "Express Air Freight",
    mode: "air",
    carrier: "Emirates SkyCargo / Qatar Airways Cargo",
    transitDays: airDays,
    totalCostUSD: airCost,
    carbonKgCO2e: Math.round(weightKg * airDistKm * EMISSION_FACTORS.air / 1000),
    scheduleReliabilityPct: 96,
    riskScore: 8,
    highlights: [
      `Fastest option — ${airDays}-day door-to-door transit`,
      "96% on-time reliability — ideal for urgent / high-value cargo",
      "No port congestion exposure",
    ],
    warnings: [
      `Cost: ${((airCost / seaViaCost) * 100).toFixed(0)}% of sea freight — viable for high-value or time-critical cargo`,
      `Carbon footprint ~${Math.round(EMISSION_FACTORS.air / EMISSION_FACTORS.sea)}× higher than sea`,
    ],
    via: "via DXB / DOH hub",
    waypoints: buildWaypoints(originPort, destPort, originCountry, destCountry, []),
  });

  // 4. Rail (if available)
  if (profile.hasRail) {
    const railDays = profile.railDays;
    const railCost = Math.round(seaChargeable * profile.railCostPerKg + 600);
    const railDistKm = Math.round(profile.seaDistKm * 0.70);  // rail routes are often shorter
    routes.push({
      id: "rail",
      name: "Rail / BRI Freight Train",
      mode: "rail",
      carrier: "DB Schenker / FESCO",
      transitDays: railDays,
      totalCostUSD: railCost,
      carbonKgCO2e: Math.round(weightKg * railDistKm * EMISSION_FACTORS.rail / 1000),
      scheduleReliabilityPct: 78,
      riskScore: ROUTE_RISKS["trans-siberian"],
      highlights: [
        `${railDays}-day transit — ${seaViaDays - railDays} days faster than sea`,
        `~${Math.round((1 - EMISSION_FACTORS.rail / EMISSION_FACTORS.sea) * 100)}% less carbon than ocean freight`,
        "Fixed weekly block-train departure schedule",
      ],
      warnings: [
        "Geopolitical risk: Russia transit sanctions may affect schedules",
        "Limited to standard containers — no oversized or DG class 1/2/3",
        "China–Europe border crossing adds 1–2 days customs transit",
      ],
      via: "via Trans-Siberian / BRI corridor",
      waypoints: buildWaypoints(originPort, destPort, originCountry, destCountry, [
        originCountry.toLowerCase().includes("china") ? "Alashankou" : "Yiwu",
      ]),
    });
  }

  // 5. Sea + Air combo (for very high value partial cargo)
  if (shipment.declared_value && shipment.declared_value > 500000) {
    const comboSplit = 0.3; // 30% by air, 70% by sea
    const comboCost = Math.round(airCost * comboSplit + seaViaCost * (1 - comboSplit));
    const comboCarbon = Math.round(
      weightKg * comboSplit * airDistKm * EMISSION_FACTORS.air / 1000 +
      weightKg * (1 - comboSplit) * seaViaDistKm * EMISSION_FACTORS.sea / 1000
    );
    routes.push({
      id: "multimodal",
      name: "Split Shipment (Sea + Air)",
      mode: "multimodal",
      carrier: `${profile.seaCarrier} + Emirates SkyCargo`,
      transitDays: airDays,  // first portion arrives in airDays
      totalCostUSD: comboCost,
      carbonKgCO2e: comboCarbon,
      scheduleReliabilityPct: 90,
      riskScore: 12,
      highlights: [
        `30% air (${Math.round(weightKg * 0.3).toLocaleString()} kg) — arrives in ${airDays} days`,
        `70% sea (${Math.round(weightKg * 0.7).toLocaleString()} kg) — arrives in ${seaViaDays} days`,
        "Ideal for high-value urgent + bulk combination shipments",
      ],
      warnings: ["Two sets of documentation required", "Consignee must manage two arrival dates"],
      via: "sea + air dual routing",
      waypoints: buildWaypoints(originPort, destPort, originCountry, destCountry, []),
    });
  }

  // ── Scoring algorithm ────────────────────────────────────────────────────────
  const priority = (shipment.priority ?? "balanced").toLowerCase();
  const weights = PRIORITY_WEIGHTS[priority] ?? PRIORITY_WEIGHTS.balanced;

  // Normalise each metric to [0,1] across all routes
  const allCosts    = routes.map((r) => r.totalCostUSD);
  const allDays     = routes.map((r) => r.transitDays);
  const allCarbon   = routes.map((r) => r.carbonKgCO2e);
  const allRel      = routes.map((r) => r.scheduleReliabilityPct);
  const allRisk     = routes.map((r) => r.riskScore);

  const minV = (arr: number[]) => Math.min(...arr);
  const maxV = (arr: number[]) => Math.max(...arr);
  const norm = (val: number, min: number, max: number) =>
    max === min ? 0.5 : (val - min) / (max - min);

  const scored: OptimizedRoute[] = routes.map((r) => {
    const normCost    = norm(r.totalCostUSD, minV(allCosts), maxV(allCosts));
    const normDays    = norm(r.transitDays, minV(allDays), maxV(allDays));
    const normCarbon  = norm(r.carbonKgCO2e, minV(allCarbon), maxV(allCarbon));
    const normRel     = norm(r.scheduleReliabilityPct, minV(allRel), maxV(allRel));
    const normRisk    = norm(r.riskScore, minV(allRisk), maxV(allRisk));

    const score = Math.round(100 * (
      weights.cost        * (1 - normCost)  +
      weights.time        * (1 - normDays)  +
      weights.carbon      * (1 - normCarbon) +
      weights.reliability * normRel         +
      weights.risk        * (1 - normRisk)
    ));

    return {
      ...r,
      score,
      isRecommended: false,
      recommendation: "",
    };
  });

  // Mark the highest-scoring route as recommended
  scored.sort((a, b) => b.score - a.score);
  scored[0].isRecommended = true;

  // Generate recommendation text
  scored.forEach((r) => {
    const rank = scored.indexOf(r) + 1;
    if (r.isRecommended) {
      r.recommendation = `Best match for ${priority.replace("-", " ")} priority — ${r.highlights[0]}`;
    } else if (rank === 2) {
      r.recommendation = `Strong alternative — ${scored[0].totalCostUSD - r.totalCostUSD > 0 ? `saves $${(r.totalCostUSD - scored[0].totalCostUSD).toLocaleString()} vs recommended` : r.highlights[0]}`;
    } else {
      r.recommendation = r.highlights[0];
    }
  });

  return {
    routes:          scored,
    recommended:     scored[0],
    priorityApplied: priority,
    originPort,
    destinationPort: destPort,
    complianceNote:  profile.compliance,
    alert:           profile.operationalAlert,
  };
}
