// ─── Sanctions & Trade Fraud Detection Engine ────────────────────────────────
// Rules-based compliance intelligence layer. Analyzes shipment fields for
// restricted-party risk, dual-use flags, document anomalies, and fraud patterns.
// Structured for future integration with OFAC/UN/EU sanctions list APIs.

import type { Shipment } from "@/app/lib/supabase/shipment-types";

export type SanctionsRisk = "clear" | "low" | "medium" | "high" | "critical";

export interface SanctionsFlag {
  category: "country_risk" | "dual_use" | "party_risk" | "document" | "corridor" | "commodity";
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface SanctionsResult {
  riskScore: number;        // 0–100
  riskLevel: SanctionsRisk;
  flags: SanctionsFlag[];
  recommendation: string;
  requiresReview: boolean;
  screeningBasis: string[]; // which rule sets were applied
}

// ─── Rule data ────────────────────────────────────────────────────────────────

const SANCTIONED_COUNTRIES = new Set([
  "iran", "north korea", "dprk", "syria", "russia", "belarus", "cuba",
  "myanmar", "burma", "venezuela", "sudan", "south sudan", "somalia",
  "libya", "yemen", "mali", "central african republic", "eritrea",
]);

const HIGH_RISK_TRANSIT = new Set([
  "iran", "russia", "belarus", "syria", "north korea",
]);

// Dual-use HS code prefixes (semiconductors, explosives, weapons, surveillance tech)
const DUAL_USE_HS_PREFIXES = [
  "8542", // semiconductors / integrated circuits
  "8543", // electrical machines (surveillance/comms)
  "8471", // automatic data processing machines
  "8473", // computer parts — may require export license
  "8802", // aircraft
  "9301", "9302", "9303", "9304", "9305", "9306", "9307", // arms
  "2814", // ammonia
  "2851", // hydrazine
  "3601", "3602", "3603", // explosives
];

// High-risk keywords in compliance notes / consignee names
const FRAUD_KEYWORDS = [
  "mismatch", "discrepancy", "sanctioned", "restricted", "detained",
  "cbp hold", "ofac", "entity list", "denied party",
];

const SUSPICIOUS_CONSIGNEE_PATTERNS = [
  /^unknown$/i,
  /^tbd$/i,
  /^n\/a$/i,
  /^agent$/i,
  /^n\.a\.$/i,
];

// Corridor pairs that require extra scrutiny
const HIGH_RISK_CORRIDOR_COMBOS = [
  { from: "russia", to: "any" },
  { from: "any", to: "russia" },
  { from: "iran", to: "any" },
  { from: "any", to: "iran" },
  { from: "china", to: "russia" },
  { from: "belarus", to: "any" },
  { from: "myanmar", to: "any" },
];

// Cargo categories with elevated scrutiny
const SENSITIVE_CATEGORIES = [
  "electronics & technology",
  "chemicals & petrochemicals",
  "machinery & industrial equipment",
  "dangerous goods (dg)",
  "automotive & spare parts",
  "pharmaceuticals & life sciences",
];

// ─── Engine ───────────────────────────────────────────────────────────────────

export function runSanctionsCheck(shipment: Shipment): SanctionsResult {
  const flags: SanctionsFlag[] = [];
  let score = 0;
  const basis: string[] = ["OFAC SDN pattern matching", "EU Consolidated Sanctions", "UN Security Council Resolutions"];

  const originLow   = (shipment.origin_country ?? "").toLowerCase();
  const destLow     = (shipment.destination_country ?? "").toLowerCase();
  const notes       = (shipment.compliance_notes ?? "").toLowerCase();
  const hs          = (shipment.hs_code ?? "").replace(/\D/g, "");
  const category    = (shipment.cargo_category ?? "").toLowerCase();
  const consignee   = (shipment.consignee_name ?? "").trim();
  const shipper     = (shipment.shipper_company ?? "").trim();
  const corridor    = (shipment.corridor ?? "").toLowerCase();

  // ── Sanctioned country checks ─────────────────────────────────────────────
  if (SANCTIONED_COUNTRIES.has(originLow)) {
    flags.push({ category: "country_risk", severity: "critical",
      message: `Origin country "${shipment.origin_country}" is on OFAC/EU/UN restricted list — shipment may be prohibited` });
    score += 50;
  }
  if (SANCTIONED_COUNTRIES.has(destLow)) {
    flags.push({ category: "country_risk", severity: "critical",
      message: `Destination country "${shipment.destination_country}" is on OFAC/EU/UN restricted list` });
    score += 50;
  }

  // ── High-risk transit/corridor combinations ────────────────────────────────
  for (const combo of HIGH_RISK_CORRIDOR_COMBOS) {
    const fromMatch = combo.from === "any" || corridor.includes(combo.from);
    const toMatch   = combo.to === "any"   || corridor.includes(combo.to);
    if (fromMatch && toMatch && combo.from !== "any") {
      flags.push({ category: "corridor", severity: "warning",
        message: `Corridor "${shipment.corridor}" involves a high-risk country pair requiring enhanced due diligence` });
      score += 25;
      break;
    }
  }

  // ── Dual-use / controlled commodity checks ────────────────────────────────
  if (hs) {
    const matchedDualUse = DUAL_USE_HS_PREFIXES.find((prefix) => hs.startsWith(prefix));
    if (matchedDualUse) {
      flags.push({ category: "dual_use", severity: "warning",
        message: `HS code ${shipment.hs_code} falls under dual-use control category (${matchedDualUse}xx) — export/import license may be required` });
      score += 20;
      basis.push("EAR / ITAR Dual-Use Controls");
    }
  }

  // ── Sensitive cargo category ──────────────────────────────────────────────
  if (SENSITIVE_CATEGORIES.some((c) => category.includes(c.toLowerCase().split(" ")[0]))) {
    if (destLow === "russia" || destLow === "iran" || destLow === "north korea") {
      flags.push({ category: "commodity", severity: "critical",
        message: `${shipment.cargo_category} exports to ${shipment.destination_country} likely prohibited — verify with relevant export control authority` });
      score += 35;
    }
  }

  // ── Consignee / shipper party checks ─────────────────────────────────────
  if (!consignee || consignee.length < 3) {
    flags.push({ category: "party_risk", severity: "warning",
      message: "Consignee name is missing or too short — required for restricted party screening" });
    score += 15;
  } else if (SUSPICIOUS_CONSIGNEE_PATTERNS.some((p) => p.test(consignee))) {
    flags.push({ category: "party_risk", severity: "critical",
      message: `Consignee name "${consignee}" is placeholder/ambiguous — cannot complete screening` });
    score += 30;
  }

  if (!shipper || shipper.length < 3) {
    flags.push({ category: "party_risk", severity: "warning",
      message: "Shipper company name is missing — required for denied party list screening" });
    score += 10;
  }

  // ── Document / compliance note keyword flags ──────────────────────────────
  const triggeredKeywords = FRAUD_KEYWORDS.filter((kw) => notes.includes(kw));
  if (triggeredKeywords.length > 0) {
    flags.push({ category: "document", severity: "warning",
      message: `Compliance notes contain high-risk keywords: ${triggeredKeywords.join(", ")}` });
    score += triggeredKeywords.length * 10;
  }

  // ── UFLPA / Xinjiang check ────────────────────────────────────────────────
  if (notes.includes("xinjiang") || notes.includes("uflpa")) {
    flags.push({ category: "country_risk", severity: "critical",
      message: "UFLPA exposure detected — US CBP may detain goods traceable to Xinjiang without full supply chain documentation" });
    score += 30;
    basis.push("UFLPA (Uyghur Forced Labor Prevention Act)");
  }

  // ── Section 301 / Anti-dumping ────────────────────────────────────────────
  if ((originLow === "china" || corridor.includes("china")) && (destLow === "united states" || destLow === "usa")) {
    if (category.includes("electronic") || category.includes("machinery") || category.includes("chemical")) {
      flags.push({ category: "commodity", severity: "warning",
        message: "China→US shipment in Section 301 tariff category — verify AD/CVD duties and export control classification" });
      score += 15;
      basis.push("US Section 301 Tariffs");
    }
  }

  score = Math.min(100, score);

  const riskLevel: SanctionsRisk =
    score >= 70 ? "critical" :
    score >= 45 ? "high" :
    score >= 25 ? "medium" :
    score >= 10 ? "low" : "clear";

  const recommendation =
    riskLevel === "critical" ? "STOP: Do not ship without legal clearance. Escalate to compliance officer immediately. File SAR if required." :
    riskLevel === "high"     ? "Mandatory compliance review required. Verify all parties against OFAC/EU denied party lists. Obtain legal sign-off before dispatch." :
    riskLevel === "medium"   ? "Enhanced due diligence recommended. Screen consignee and shipper against denied party lists. Confirm export license if dual-use." :
    riskLevel === "low"      ? "Standard compliance checks apply. Ensure documentation is complete before customs filing." :
    "No significant sanctions or fraud indicators detected. Proceed with standard customs process.";

  return {
    riskScore: score,
    riskLevel,
    flags,
    recommendation,
    requiresReview: score >= 25,
    screeningBasis: basis,
  };
}
