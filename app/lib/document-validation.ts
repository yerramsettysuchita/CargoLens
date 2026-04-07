// ─── Document / Customs Validation Engine ────────────────────────────────────
// Rules-based validation of shipment metadata for customs readiness.
// Checks required fields, format validity, and known mismatch patterns.

import type { Shipment } from "@/app/lib/supabase/shipment-types";

export interface ValidationIssue {
  field: string;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0–100
  issues: ValidationIssue[];
  summary: string;
}

// HS code: 4-10 digits, optionally dotted
const HS_PATTERN = /^\d{4,10}(\.\d{2})?$/;

export function validateShipment(shipment: Shipment): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Required field checks
  if (!shipment.shipper_company?.trim()) {
    issues.push({ field: "shipper_company", severity: "error", message: "Shipper company name is required" });
  }
  if (!shipment.consignee_name?.trim()) {
    issues.push({ field: "consignee_name", severity: "error", message: "Consignee name is required for customs" });
  }
  if (!shipment.origin_country || !shipment.origin_port) {
    issues.push({ field: "origin", severity: "error", message: "Origin country and port are required" });
  }
  if (!shipment.destination_country || !shipment.destination_port) {
    issues.push({ field: "destination", severity: "error", message: "Destination country and port are required" });
  }
  if (!shipment.cargo_category) {
    issues.push({ field: "cargo_category", severity: "error", message: "Cargo category must be specified" });
  }
  if (!shipment.incoterm) {
    issues.push({ field: "incoterm", severity: "warning", message: "Incoterm missing — required for customs valuation" });
  }

  // Value and weight
  if (!shipment.declared_value || shipment.declared_value <= 0) {
    issues.push({ field: "declared_value", severity: "error", message: "Declared customs value must be greater than 0" });
  }
  if (!shipment.weight || shipment.weight <= 0) {
    issues.push({ field: "weight", severity: "error", message: "Gross weight must be specified" });
  }

  // HS code format
  if (shipment.hs_code) {
    if (!HS_PATTERN.test(shipment.hs_code.replace(/\s/g, ""))) {
      issues.push({ field: "hs_code", severity: "warning", message: `HS code "${shipment.hs_code}" format may be invalid — expected 4–10 digit numeric` });
    }
  } else {
    issues.push({ field: "hs_code", severity: "warning", message: "HS code not provided — required for customs classification" });
  }

  // Corridor-specific checks
  const dest = (shipment.destination_country ?? "").toLowerCase();
  const category = (shipment.cargo_category ?? "").toLowerCase();
  const notes = (shipment.compliance_notes ?? "").toLowerCase();

  if (dest === "united states" || dest === "usa") {
    if (category.includes("pharma") && !notes.includes("fda")) {
      issues.push({ field: "compliance_notes", severity: "warning", message: "US-bound pharma shipment: FDA prior notice filing may be required" });
    }
    if (notes.includes("xinjiang") || notes.includes("uflpa")) {
      issues.push({ field: "compliance_notes", severity: "error", message: "UFLPA flag detected — supply chain traceability documentation required before US CBP clearance" });
    }
  }

  if (dest === "kenya" || dest === "tanzania") {
    if (!notes.includes("certificate") && category.includes("electronics")) {
      issues.push({ field: "compliance_notes", severity: "warning", message: "East Africa destination: Certificate of Conformity may be required for electronics" });
    }
  }

  if (["netherlands", "germany", "france", "italy", "uk"].includes(dest)) {
    if (category.includes("chemical") && !notes.includes("reach")) {
      issues.push({ field: "compliance_notes", severity: "info", message: "EU destination: REACH compliance documentation recommended for chemicals" });
    }
  }

  // Mismatch detection
  if (notes.includes("mismatch")) {
    issues.push({ field: "compliance_notes", severity: "error", message: "Document mismatch flagged in compliance notes — resolve before customs filing" });
  }

  // Scoring: start at 100, deduct per issue
  const deductions = issues.reduce((sum, i) => {
    if (i.severity === "error") return sum + 20;
    if (i.severity === "warning") return sum + 8;
    return sum + 2;
  }, 0);
  const score = Math.max(0, 100 - deductions);
  const isValid = issues.filter((i) => i.severity === "error").length === 0;

  const summary =
    score >= 90 ? "Customs documentation looks complete and ready for filing."
    : score >= 70 ? "Minor gaps detected. Review warnings before submitting to customs."
    : score >= 50 ? "Several issues require attention before customs filing."
    : "Critical documentation gaps. Shipment is not ready for customs submission.";

  return { isValid, score, issues, summary };
}
