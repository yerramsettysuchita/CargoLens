// Shape of a row in the `shipments` table
export interface DbShipment {
  id: string;
  user_id: string;
  shipper_company: string;
  contact_name: string;
  email: string;
  origin_country: string;
  origin_port: string;
  destination_country: string;
  destination_port: string;
  consignee_name: string;
  cargo_category: string;
  hs_code: string | null;
  weight: number;
  volume: number;
  incoterm: string;
  shipment_mode: string;
  priority: string;
  expected_dispatch_date: string | null;
  declared_value: number;
  notes: string | null;
  compliance_notes: string | null;
  status: string;
  created_at: string;
}

// Minimal display shape used by dashboard table / shipments list
export interface DisplayShipment {
  id: string;
  referenceNumber: string;
  description: string;
  origin: { city: string; country: string; code: string };
  destination: { city: string; country: string; code: string };
  status: "booked" | "in_transit" | "customs" | "delivered" | "delayed" | "at_risk";
  riskLevel: "low" | "medium" | "high" | "critical";
  estimatedArrival: string;
  carrier: string;
  vessel: string;
  containerCount: number;
  weightKg: number;
  valueUSD: number;
  commodity: string;
  hsCodes: string[];
  supplierId: string;
  carbonKgCO2e: number;
  currentLat: number;
  currentLng: number;
  events: [];
  isUserCreated: true;
}

export function dbShipmentToDisplay(row: DbShipment): DisplayShipment {
  const eta = new Date(row.created_at);
  eta.setDate(eta.getDate() + estimateTransitDays(row.shipment_mode));

  return {
    id: `USR-${row.id.slice(0, 6).toUpperCase()}`,
    referenceNumber: `CL-USR-${row.id.slice(0, 8).toUpperCase()}`,
    description: `${row.cargo_category} — ${row.origin_country} → ${row.destination_country}`,
    origin: { city: row.origin_port, country: row.origin_country, code: "" },
    destination: { city: row.destination_port, country: row.destination_country, code: "" },
    status: normaliseStatus(row.status),
    riskLevel: "low",
    estimatedArrival: eta.toISOString().split("T")[0],
    carrier: "—",
    vessel: "—",
    containerCount: Math.ceil(row.volume / 25),
    weightKg: row.weight,
    valueUSD: row.declared_value,
    commodity: row.cargo_category,
    hsCodes: row.hs_code ? [row.hs_code] : [],
    supplierId: "",
    carbonKgCO2e: 0,
    currentLat: 0,
    currentLng: 0,
    events: [],
    isUserCreated: true,
  };
}

function normaliseStatus(s: string): DisplayShipment["status"] {
  const map: Record<string, DisplayShipment["status"]> = {
    booked: "booked",
    in_transit: "in_transit",
    customs: "customs",
    delivered: "delivered",
    delayed: "delayed",
    at_risk: "at_risk",
  };
  return map[s] ?? "booked";
}

function estimateTransitDays(mode: string): number {
  if (mode.toLowerCase().includes("air")) return 4;
  if (mode.toLowerCase().includes("rail")) return 18;
  return 28;
}
