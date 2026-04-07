// ─── Core Domain Types ────────────────────────────────────────────────────────

export type ShipmentStatus =
  | "draft"
  | "booked"
  | "in_transit"
  | "customs"
  | "customs_hold"
  | "delivered"
  | "delayed"
  | "at_risk";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type TransportMode = "sea" | "air" | "rail" | "road";

// ─── Shipment ─────────────────────────────────────────────────────────────────

export interface ShipmentEvent {
  id: string;
  timestamp: string;
  location: string;
  event: string;
  status: "completed" | "active" | "pending";
  details?: string;
}

export interface Shipment {
  id: string;
  referenceNumber: string;
  description: string;
  origin: {
    city: string;
    country: string;
    code: string;
  };
  destination: {
    city: string;
    country: string;
    code: string;
  };
  status: ShipmentStatus;
  riskLevel: RiskLevel;
  departureDate: string;
  estimatedArrival: string;
  carrier: string;
  vessel: string;
  containerCount: number;
  weightKg: number;
  valueUSD: number;
  commodity: string;
  hsCodes: string[];
  events: ShipmentEvent[];
  supplierId: string;
  carbonKgCO2e: number;
  currentLat: number;
  currentLng: number;
}

// ─── Supplier ─────────────────────────────────────────────────────────────────

export type SupplierTier = 1 | 2 | 3;

export interface Supplier {
  id: string;
  name: string;
  tier: SupplierTier;
  country: string;
  city: string;
  category: string;
  riskLevel: RiskLevel;
  riskReasons: string[];
  parentId: string | null;
  certifications: string[];
  contactName: string;
  leadTimeDays: number;
}

// ─── Tariff Scenario ─────────────────────────────────────────────────────────

export interface TariffScenario {
  id: string;
  name: string;
  description: string;
  destinationCountry: string;
  hsCode: string;
  baseRatePercent: number;
  newRatePercent: number;
  cargoValueUSD: number;
  additionalDutyUSD: number;
  impactPercent: number;
  triggerDate: string;
  recommendation: string;
}

// ─── Route Option ─────────────────────────────────────────────────────────────

export interface RouteOption {
  id: string;
  name: string;
  description: string;
  mode: TransportMode;
  carrier: string;
  ports: string[];
  transitDays: number;
  costUSD: number;
  carbonKgCO2e: number;
  reliability: number; // 0-100
  isCurrent: boolean;
  isRecommended: boolean;
  pros: string[];
  cons: string[];
}

// ─── Dashboard KPI ────────────────────────────────────────────────────────────

export interface KPICard {
  title: string;
  value: string | number;
  change: string;
  trend: "up" | "down" | "neutral";
  positive: boolean;
  icon: string;
  unit?: string;
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  type: "tariff" | "delay" | "supplier_risk" | "weather" | "compliance" | "customs";
  severity: RiskLevel;
  title: string;
  message: string;
  shipmentId?: string;
  supplierId?: string;
  createdAt: string;
  isRead: boolean;
}
