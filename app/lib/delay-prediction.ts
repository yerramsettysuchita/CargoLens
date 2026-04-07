// ─── Delay Prediction Engine ──────────────────────────────────────────────────
// Rules-based delay risk computation. Inputs a shipment record, outputs a
// structured prediction with severity, reasons, and recommended action.

import type { Shipment } from "@/app/lib/supabase/shipment-types";
import { predictCongestion } from "@/app/lib/congestion";

export type DelayRisk = "none" | "low" | "medium" | "high" | "critical";

export interface DelayPrediction {
  risk: DelayRisk;
  reasons: string[];
  recommendation: string;
  estimatedDelayDays: number;
}

const HIGH_RISK_CORRIDORS = [
  "India → EU", "India → US", "China → Middle East",
];

const COMPLIANCE_FLAGS = [
  "sanction", "mismatch", "uflpa", "cbam", "301", "certificate",
];

export function predictDelay(shipment: Shipment): DelayPrediction {
  const reasons: string[] = [];
  let score = 0;

  // Status-based rules
  if (shipment.status === "customs_hold") {
    reasons.push("Shipment currently on customs hold");
    score += 40;
  }
  if (shipment.status === "delayed") {
    reasons.push("Shipment already flagged as delayed");
    score += 50;
  }
  if (shipment.status === "at_risk") {
    reasons.push("Shipment marked at risk by operations team");
    score += 35;
  }

  // Risk level
  if (shipment.risk_level === "critical") {
    reasons.push("Critical risk level assigned");
    score += 30;
  } else if (shipment.risk_level === "high") {
    reasons.push("High risk level assigned");
    score += 20;
  } else if (shipment.risk_level === "medium") {
    score += 10;
  }

  // Corridor risk
  if (HIGH_RISK_CORRIDORS.includes(shipment.corridor)) {
    reasons.push(`${shipment.corridor} corridor has active trade disruption risk`);
    score += 15;
  }

  // Compliance notes flags
  const notes = (shipment.compliance_notes ?? "").toLowerCase();
  const flagged = COMPLIANCE_FLAGS.filter((f) => notes.includes(f));
  if (flagged.length > 0) {
    reasons.push("Compliance notes indicate potential clearance risk");
    score += flagged.length * 10;
  }

  // Mode-specific risks
  if (shipment.shipment_mode === "sea" && shipment.corridor?.includes("EU")) {
    reasons.push("Sea freight on India/Asia → EU corridor subject to Red Sea diversion risk");
    score += 10;
  }

  // Congestion integration
  const congestion = predictCongestion(shipment);
  if (congestion.riskLevel === "severe") {
    reasons.push(`Severe port congestion on route — est. +${congestion.likelyDelayDays}d port delay`);
    score += 20;
  } else if (congestion.riskLevel === "high") {
    reasons.push("High port congestion detected on this corridor");
    score += 10;
  } else if (congestion.riskLevel === "moderate") {
    score += 5;
  }

  // Priority sensitivity: express shipments are more impacted by any delay
  if ((shipment.priority === "express" || shipment.priority === "fastest") && score >= 15) {
    reasons.push("High-priority shipment — any delay carries elevated operational impact");
    score += 5;
  }

  // ETA proximity
  if (shipment.eta_date) {
    const daysToEta = Math.ceil(
      (new Date(shipment.eta_date).getTime() - Date.now()) / 86400000
    );
    if (daysToEta < 3 && shipment.status !== "delivered") {
      reasons.push("ETA within 3 days but shipment not yet delivered");
      score += 20;
    }
  }

  // Derive risk level
  let risk: DelayRisk;
  let estimatedDelayDays: number;
  if (score >= 70) {
    risk = "critical"; estimatedDelayDays = 14;
  } else if (score >= 45) {
    risk = "high"; estimatedDelayDays = 7;
  } else if (score >= 25) {
    risk = "medium"; estimatedDelayDays = 3;
  } else if (score >= 10) {
    risk = "low"; estimatedDelayDays = 1;
  } else {
    risk = "none"; estimatedDelayDays = 0;
  }

  const recommendation =
    risk === "critical"
      ? "Immediate action required: contact carrier and customs agent. Escalate to operations lead."
      : risk === "high"
      ? "Review compliance documents and confirm status with local agent within 24 hours."
      : risk === "medium"
      ? "Monitor closely. Verify customs filing and carrier schedule alignment."
      : risk === "low"
      ? "Minor risk detected. Standard monitoring applies."
      : "No significant delay indicators. Shipment on track.";

  return { risk, reasons, recommendation, estimatedDelayDays };
}

/** Filter shipments to those with medium+ delay risk */
export function getHighRiskShipments(
  shipments: Shipment[]
): Array<{ shipment: Shipment; prediction: DelayPrediction }> {
  return shipments
    .map((s) => ({ shipment: s, prediction: predictDelay(s) }))
    .filter(({ prediction }) => prediction.risk !== "none" && prediction.risk !== "low")
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
      return order[a.prediction.risk] - order[b.prediction.risk];
    });
}
