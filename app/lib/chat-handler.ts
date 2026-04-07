// ─── Conversational Chat Handler ──────────────────────────────────────────────
// Intent-based query engine for logistics assistant. Classifies natural language
// queries and returns structured answers using existing backend engines.
// Designed to work with real shipment data from Supabase.

import type { Shipment } from "@/app/lib/supabase/shipment-types";
import { predictDelay } from "@/app/lib/delay-prediction";
import { validateShipment } from "@/app/lib/document-validation";
import { runSanctionsCheck } from "@/app/lib/sanctions-check";
import { predictCongestion, getCorridorCongestionOverview } from "@/app/lib/congestion";
import type { SanctionsFlag } from "@/app/lib/sanctions-check";
import type { CongestionResult } from "@/app/lib/congestion";

export type ChatIntent =
  | "at_risk"
  | "delayed"
  | "customs"
  | "congestion"
  | "sanctions"
  | "corridor_filter"
  | "count"
  | "estimate_prompt"
  | "shipment_lookup"
  | "help"
  | "unknown";

export interface ChatShipmentRef {
  id: string;
  shipment_code: string;
  corridor: string;
  status: string;
  risk_level: string;
  origin_port: string;
  destination_port: string;
  shipper_company: string;
}

export interface ChatResponse {
  intent: ChatIntent;
  answer: string;
  shipments?: ChatShipmentRef[];
  meta?: Record<string, unknown>;
}

// ─── Intent classifier ────────────────────────────────────────────────────────

function classify(q: string): ChatIntent {
  const t = q.toLowerCase();

  if (/\b(at[- ]risk|critical|high.?risk)\b/.test(t))           return "at_risk";
  if (/\b(delay|delayed|overdue|late|behind schedule)\b/.test(t)) return "delayed";
  if (/\b(customs|clearance|cbp|import.?doc|export.?doc|document|doc review)\b/.test(t)) return "customs";
  if (/\b(congestion|congested|port.?backlog|backlog|port.?delay|vessel.?delay)\b/.test(t)) return "congestion";
  if (/\b(sanction|ofac|compliance|restricted|embargo|dual.?use|fraud)\b/.test(t)) return "sanctions";
  if (/\b(how many|count|total|number of)\b/.test(t))           return "count";
  if (/\b(route|cheapest|fastest|recommend|estimate|cost|compare|carrier)\b/.test(t)) return "estimate_prompt";
  if (/shp-\d+/i.test(t))                                        return "shipment_lookup";
  // corridor / geographic filter (after other checks)
  if (/\b(india|eu|europe|china|us|uae|africa|singapore|middle east|asia|uk|germany|netherlands)\b/.test(t)) return "corridor_filter";

  return "unknown";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toRef(s: Shipment): ChatShipmentRef {
  return {
    id: s.id,
    shipment_code: s.shipment_code,
    corridor: s.corridor,
    status: s.status,
    risk_level: s.risk_level,
    origin_port: s.origin_port,
    destination_port: s.destination_port,
    shipper_company: s.shipper_company,
  };
}

function pluralise(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

// ─── Intent handlers ──────────────────────────────────────────────────────────

function handleAtRisk(shipments: Shipment[]): ChatResponse {
  const risky = shipments.filter((s) => ["high", "critical"].includes(s.risk_level) || ["at_risk", "delayed", "customs_hold"].includes(s.status));
  if (risky.length === 0) {
    return { intent: "at_risk", answer: "No shipments are currently flagged as high-risk or critical. All corridors appear nominal." };
  }
  const critical = risky.filter((s) => s.risk_level === "critical" || s.status === "customs_hold");
  const lines = risky.slice(0, 6).map((s) => `• ${s.shipment_code} — ${s.corridor} (${s.status}, ${s.risk_level} risk)`).join("\n");
  return {
    intent: "at_risk",
    answer: `Found ${pluralise(risky.length, "at-risk shipment")}${critical.length ? `, including ${pluralise(critical.length, "critical case")}` : ""}:\n\n${lines}${risky.length > 6 ? `\n…and ${risky.length - 6} more.` : ""}\n\nReview each shipment for delay predictions and compliance flags.`,
    shipments: risky.slice(0, 6).map(toRef),
    meta: { totalAtRisk: risky.length, criticalCount: critical.length },
  };
}

function handleDelayed(shipments: Shipment[], query: string): ChatResponse {
  let pool = shipments.filter((s) => ["delayed", "at_risk", "customs_hold"].includes(s.status));

  // Optional corridor filter extracted from query
  const t = query.toLowerCase();
  if (t.includes("india") && (t.includes("eu") || t.includes("europe"))) {
    pool = pool.filter((s) => s.corridor.toLowerCase().includes("india") && s.corridor.toLowerCase().match(/eu|europe/));
  } else if (t.includes("china")) {
    pool = pool.filter((s) => s.corridor.toLowerCase().includes("china"));
  } else if (t.includes("africa")) {
    pool = pool.filter((s) => s.corridor.toLowerCase().includes("africa"));
  }

  if (pool.length === 0) {
    return { intent: "delayed", answer: "No delayed shipments match your query right now. Current shipments are on schedule." };
  }

  // Augment with delay predictions
  const withDelay = pool.map((s) => {
    const d = predictDelay(s);
    return { s, days: d.estimatedDelayDays, reason: d.reasons[0] ?? "" };
  }).sort((a, b) => b.days - a.days);

  const lines = withDelay.slice(0, 5).map(
    ({ s, days, reason }) => `• ${s.shipment_code} — ${s.corridor} (+${days}d${reason ? `, ${reason}` : ""})`
  ).join("\n");

  return {
    intent: "delayed",
    answer: `${pluralise(pool.length, "delayed shipment")} found:\n\n${lines}${pool.length > 5 ? `\n…and ${pool.length - 5} more.` : ""}\n\nReview shipment detail pages for full delay analysis.`,
    shipments: withDelay.slice(0, 5).map(({ s }) => toRef(s)),
    meta: { total: pool.length },
  };
}

function handleCustoms(shipments: Shipment[]): ChatResponse {
  const needsReview = shipments.filter((s) => {
    const v = validateShipment(s);
    return !v.isValid || v.score < 70 || s.status === "customs_hold";
  });

  if (needsReview.length === 0) {
    return { intent: "customs", answer: "All shipments currently pass customs readiness checks. No pending document issues." };
  }

  const lines = needsReview.slice(0, 5).map((s) => {
    const v = validateShipment(s);
    return `• ${s.shipment_code} — score ${v.score}/100${v.issues.length ? ` (${v.issues[0].message})` : ""}`;
  }).join("\n");

  return {
    intent: "customs",
    answer: `${pluralise(needsReview.length, "shipment")} need customs document review:\n\n${lines}${needsReview.length > 5 ? `\n…and ${needsReview.length - 5} more.` : ""}\n\nOpen each shipment for the full Customs Readiness breakdown.`,
    shipments: needsReview.slice(0, 5).map(toRef),
    meta: { totalIssues: needsReview.length },
  };
}

function handleCongestion(shipments: Shipment[]): ChatResponse {
  const overview = getCorridorCongestionOverview();
  const topCorridor = overview[0];

  // Find shipments on the most congested corridors
  const severeCorridors = overview.filter((c) => c.riskLevel === "severe" || c.riskLevel === "high");
  const affectedShipments = shipments.filter((s) =>
    severeCorridors.some((c) => {
      const corr = s.corridor.toLowerCase();
      const parts = c.corridor.toLowerCase().split("→").map((p) => p.trim());
      return parts.every((p) => corr.includes(p.split(" ")[0]));
    })
  );

  const corridorLines = overview.slice(0, 4).map(
    (c) => `• ${c.corridor} — score ${c.congestionScore}/100 (${c.riskLevel}, +${c.likelyDelayDays}d)`
  ).join("\n");

  const topSignal = topCorridor ? `\n\nMost congested: **${topCorridor.corridor}** (${topCorridor.congestionScore}/100) — ${topCorridor.signal}` : "";

  const affectedNote = affectedShipments.length > 0
    ? `\n\n${pluralise(affectedShipments.length, "active shipment")} on congested corridors.`
    : "";

  return {
    intent: "congestion",
    answer: `Current port congestion overview:\n\n${corridorLines}${topSignal}${affectedNote}`,
    shipments: affectedShipments.slice(0, 4).map(toRef),
    meta: { corridors: overview.slice(0, 4), affectedCount: affectedShipments.length },
  };
}

function handleSanctions(shipments: Shipment[]): ChatResponse {
  const flagged: Array<{ s: Shipment; score: number; flags: SanctionsFlag[] }> = [];

  for (const s of shipments) {
    const result = runSanctionsCheck(s);
    if (result.requiresReview || result.riskScore >= 20) {
      flagged.push({ s, score: result.riskScore, flags: result.flags });
    }
  }

  if (flagged.length === 0) {
    return { intent: "sanctions", answer: "No shipments have active sanctions or compliance flags. All screened corridors appear clear." };
  }

  flagged.sort((a, b) => b.score - a.score);
  const lines = flagged.slice(0, 5).map(
    ({ s, score, flags }) => `• ${s.shipment_code} — ${s.corridor} (score ${score}/100, ${flags.length} flag${flags.length !== 1 ? "s" : ""})`
  ).join("\n");

  const critical = flagged.filter(({ score }) => score >= 70);
  return {
    intent: "sanctions",
    answer: `${pluralise(flagged.length, "shipment")} flagged for compliance review${critical.length ? ` (${pluralise(critical.length, "critical")})` : ""}:\n\n${lines}${flagged.length > 5 ? `\n…and ${flagged.length - 5} more.` : ""}\n\nOpen each shipment detail for the full sanctions screening report.`,
    shipments: flagged.slice(0, 5).map(({ s }) => toRef(s)),
    meta: { total: flagged.length, critical: critical.length },
  };
}

function handleCorridorFilter(shipments: Shipment[], query: string): ChatResponse {
  const t = query.toLowerCase();
  const REGION_KEYWORDS: Record<string, string[]> = {
    "india":        ["india"],
    "china":        ["china"],
    "europe":       ["eu", "europe", "germany", "netherlands", "uk", "felixstowe", "rotterdam", "hamburg", "antwerp"],
    "us":           ["us", "usa", "united states", "new york", "los angeles", "houston", "savannah"],
    "uae":          ["uae", "dubai", "jebel ali", "abu dhabi"],
    "africa":       ["africa", "mombasa", "lagos", "durban", "dar es salaam"],
    "se asia":      ["singapore", "malaysia", "vietnam", "southeast asia", "se asia"],
    "middle east":  ["middle east", "iran", "bandar"],
  };

  const matched = Object.entries(REGION_KEYWORDS).filter(([, kws]) => kws.some((kw) => t.includes(kw)));
  let pool = shipments;
  if (matched.length > 0) {
    pool = shipments.filter((s) =>
      matched.some(([, kws]) =>
        kws.some((kw) => s.corridor.toLowerCase().includes(kw) || s.origin_country.toLowerCase().includes(kw) || s.destination_country.toLowerCase().includes(kw))
      )
    );
  }

  if (pool.length === 0) {
    return { intent: "corridor_filter", answer: `No shipments found for the specified region/corridor. Try a different filter.` };
  }

  const regionLabel = matched.map(([k]) => k).join(" / ") || "the specified corridor";
  const lines = pool.slice(0, 5).map((s) => `• ${s.shipment_code} — ${s.corridor} (${s.status})`).join("\n");
  return {
    intent: "corridor_filter",
    answer: `${pluralise(pool.length, "shipment")} found for ${regionLabel}:\n\n${lines}${pool.length > 5 ? `\n…and ${pool.length - 5} more.` : ""}`,
    shipments: pool.slice(0, 5).map(toRef),
    meta: { total: pool.length, regions: matched.map(([k]) => k) },
  };
}

function handleCount(shipments: Shipment[], query: string): ChatResponse {
  const t = query.toLowerCase();
  let pool = shipments;
  let label = "total";

  if (/in.transit/.test(t) || t.includes("in transit")) { pool = shipments.filter((s) => s.status === "in_transit"); label = "in transit"; }
  else if (t.includes("delayed"))      { pool = shipments.filter((s) => s.status === "delayed"); label = "delayed"; }
  else if (t.includes("at risk"))      { pool = shipments.filter((s) => s.status === "at_risk"); label = "at risk"; }
  else if (t.includes("customs"))      { pool = shipments.filter((s) => s.status === "customs_hold"); label = "on customs hold"; }
  else if (t.includes("delivered"))    { pool = shipments.filter((s) => s.status === "delivered"); label = "delivered"; }
  else if (t.includes("critical"))     { pool = shipments.filter((s) => s.risk_level === "critical"); label = "critical-risk"; }
  else if (t.includes("high risk"))    { pool = shipments.filter((s) => s.risk_level === "high"); label = "high-risk"; }

  const byCorridor: Record<string, number> = {};
  pool.forEach((s) => { byCorridor[s.corridor] = (byCorridor[s.corridor] ?? 0) + 1; });
  const topCorridor = Object.entries(byCorridor).sort((a, b) => b[1] - a[1])[0];

  return {
    intent: "count",
    answer: `There ${pool.length === 1 ? "is" : "are"} **${pool.length}** ${label} shipment${pool.length !== 1 ? "s" : ""} out of ${shipments.length} total.${topCorridor && pool.length > 0 ? `\n\nMost common corridor: ${topCorridor[0]} (${topCorridor[1]})` : ""}`,
    meta: { count: pool.length, total: shipments.length, label, byCorridor },
  };
}

function handleEstimatePrompt(): ChatResponse {
  return {
    intent: "estimate_prompt",
    answer: "To get a detailed rate comparison with carrier options, carbon estimates, and route scores, head to the **Rate Compare** tool and enter your origin, destination, weight, and cargo type.\n\nI can also answer questions about congestion or delay risk on a specific corridor — just ask!",
    meta: { redirectTo: "/compare" },
  };
}

function handleShipmentLookup(shipments: Shipment[], query: string): ChatResponse {
  const match = query.match(/shp-\d+/i);
  if (!match) return handleUnknown();

  const code = match[0].toUpperCase();
  const s = shipments.find((sh) => sh.shipment_code.toUpperCase() === code);
  if (!s) {
    return { intent: "shipment_lookup", answer: `Shipment **${code}** was not found. Check the code or browse all shipments in the Shipments page.` };
  }

  const delay = predictDelay(s);
  const validation = validateShipment(s);
  const sanctions = runSanctionsCheck(s);
  const congestion = predictCongestion(s);

  return {
    intent: "shipment_lookup",
    answer: `**${s.shipment_code}** — ${s.cargo_category}\n` +
      `Corridor: ${s.corridor}\n` +
      `Status: ${s.status} · Risk: ${s.risk_level}\n` +
      `Ports: ${s.origin_port} → ${s.destination_port}\n\n` +
      `Delay Risk: ${delay.risk}${delay.estimatedDelayDays > 0 ? ` (+${delay.estimatedDelayDays}d)` : ""}\n` +
      `Customs Readiness: ${validation.score}/100${!validation.isValid ? " ⚠" : " ✓"}\n` +
      `Sanctions Score: ${sanctions.riskScore}/100 (${sanctions.riskLevel})\n` +
      `Congestion Score: ${congestion.congestionScore}/100 (${congestion.riskLevel})\n\n` +
      `Open the shipment detail page for full analysis.`,
    shipments: [toRef(s)],
    meta: { delay, validationScore: validation.score, sanctionsScore: sanctions.riskScore, congestionScore: congestion.congestionScore },
  };
}

function handleUnknown(): ChatResponse {
  return {
    intent: "unknown",
    answer: "I can help you with:\n\n• **At-risk shipments** — *\"What shipments are at risk?\"*\n• **Delays** — *\"Show delayed shipments from India to EU\"*\n• **Customs** — *\"Which shipments need customs review?\"*\n• **Port congestion** — *\"What corridors are congested?\"*\n• **Sanctions** — *\"Any sanctions flags?\"*\n• **Route estimates** — *\"Recommend the cheapest route\"*\n• **Counts** — *\"How many shipments are in transit?\"*\n• **Lookups** — *\"Tell me about SHP-123456\"*",
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function handleChat(query: string, shipments: Shipment[]): ChatResponse {
  if (!query?.trim()) return handleUnknown();

  const intent = classify(query);

  switch (intent) {
    case "at_risk":         return handleAtRisk(shipments);
    case "delayed":         return handleDelayed(shipments, query);
    case "customs":         return handleCustoms(shipments);
    case "congestion":      return handleCongestion(shipments);
    case "sanctions":       return handleSanctions(shipments);
    case "corridor_filter": return handleCorridorFilter(shipments, query);
    case "count":           return handleCount(shipments, query);
    case "estimate_prompt": return handleEstimatePrompt();
    case "shipment_lookup": return handleShipmentLookup(shipments, query);
    default:                return handleUnknown();
  }
}
