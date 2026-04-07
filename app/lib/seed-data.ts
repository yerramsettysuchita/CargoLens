import type {
  Shipment,
  Supplier,
  TariffScenario,
  RouteOption,
  Alert,
} from "@/app/types";

// ─── Shipments — multi-corridor global sample data ────────────────────────────

export const shipments: Shipment[] = [
  {
    id: "SHP-001",
    referenceNumber: "CL-IND-EU-2024-001",
    description: "Cotton Fabric & Garments — India → EU Corridor",
    origin: { city: "Nhava Sheva", country: "India", code: "INNSA" },
    destination: { city: "Rotterdam", country: "Netherlands", code: "NLRTM" },
    status: "in_transit",
    riskLevel: "medium",
    departureDate: "2024-03-10",
    estimatedArrival: "2024-04-12",
    carrier: "Maersk Line",
    vessel: "Maersk Eindhoven",
    containerCount: 2,
    weightKg: 18500,
    valueUSD: 142000,
    commodity: "Woven Cotton Fabric & RMG",
    hsCodes: ["5208.21", "6205.20", "6204.62"],
    supplierId: "SUP-001",
    carbonKgCO2e: 4120,
    currentLat: 12.5,
    currentLng: 55.2,
    events: [
      {
        id: "EVT-001",
        timestamp: "2024-03-10T08:00:00Z",
        location: "Nhava Sheva (JNPT), India",
        event: "Shipment Booked",
        status: "completed",
        details: "Booking confirmed with Maersk Line. BL#MAEU-884321",
      },
      {
        id: "EVT-002",
        timestamp: "2024-03-12T14:30:00Z",
        location: "Nhava Sheva Port, India",
        event: "Container Stuffed & Sealed",
        status: "completed",
        details: "2x 20ft containers sealed. Container IDs: MSKU8823401, MSKU8823402",
      },
      {
        id: "EVT-003",
        timestamp: "2024-03-14T09:00:00Z",
        location: "Nhava Sheva, India",
        event: "Export Customs Cleared",
        status: "completed",
        details: "Indian customs cleared. Shipping bill #4421983. DGFT compliance verified.",
      },
      {
        id: "EVT-004",
        timestamp: "2024-03-15T18:00:00Z",
        location: "Nhava Sheva Port, India",
        event: "Vessel Departed",
        status: "completed",
        details: "MV Maersk Eindhoven departed. ETA Colombo transshipment: Mar 17",
      },
      {
        id: "EVT-005",
        timestamp: "2024-03-17T11:00:00Z",
        location: "Colombo, Sri Lanka",
        event: "Transshipment Hub — Arrived",
        status: "completed",
        details: "Arrived Colombo for transshipment onto Europe main-haul vessel",
      },
      {
        id: "EVT-006",
        timestamp: "2024-03-19T06:00:00Z",
        location: "Indian Ocean",
        event: "In Transit — Indian Ocean",
        status: "active",
        details: "Vessel on schedule. Est. Suez Canal transit: Apr 1",
      },
      {
        id: "EVT-007",
        timestamp: "2024-04-01T00:00:00Z",
        location: "Suez Canal, Egypt",
        event: "Suez Canal Transit",
        status: "pending",
      },
      {
        id: "EVT-008",
        timestamp: "2024-04-10T00:00:00Z",
        location: "Rotterdam, Netherlands",
        event: "Arrival at Port of Rotterdam",
        status: "pending",
      },
      {
        id: "EVT-009",
        timestamp: "2024-04-11T00:00:00Z",
        location: "Rotterdam, Netherlands",
        event: "EU Customs Clearance — Import",
        status: "pending",
        details: "EU customs inspection. CBAM reporting obligation applies from 2026. CE compliance required.",
      },
      {
        id: "EVT-010",
        timestamp: "2024-04-12T00:00:00Z",
        location: "Rotterdam, Netherlands",
        event: "Delivered to Consignee",
        status: "pending",
        details: "Final delivery to Rotterdam distribution hub.",
      },
    ],
  },
  {
    id: "SHP-002",
    referenceNumber: "CL-UAE-AFR-2024-002",
    description: "Consumer Electronics & FMCG — UAE → East Africa Corridor",
    origin: { city: "Jebel Ali", country: "UAE", code: "AEJEA" },
    destination: { city: "Mombasa", country: "Kenya", code: "KEMBA" },
    status: "customs",
    riskLevel: "high",
    departureDate: "2024-03-18",
    estimatedArrival: "2024-04-05",
    carrier: "MSC",
    vessel: "MSC Floriana",
    containerCount: 3,
    weightKg: 42000,
    valueUSD: 285000,
    commodity: "Consumer Electronics & FMCG",
    hsCodes: ["8471.30", "8517.12", "3304.99"],
    supplierId: "SUP-003",
    carbonKgCO2e: 3840,
    currentLat: 4.0,
    currentLng: 39.6,
    events: [
      {
        id: "EVT-011",
        timestamp: "2024-03-18T07:00:00Z",
        location: "Jebel Ali Port, UAE",
        event: "Cargo Received at Port",
        status: "completed",
        details: "3x 40ft containers received at DP World Jebel Ali Terminal.",
      },
      {
        id: "EVT-012",
        timestamp: "2024-03-19T14:00:00Z",
        location: "Jebel Ali Port, UAE",
        event: "UAE Export Customs Cleared",
        status: "completed",
        details: "UAE customs cleared. Certificate of Origin (GCC) issued.",
      },
      {
        id: "EVT-013",
        timestamp: "2024-03-20T06:00:00Z",
        location: "Jebel Ali Port, UAE",
        event: "Vessel Departed",
        status: "completed",
        details: "MSC Floriana departed Jebel Ali. ETA Mombasa: Apr 1",
      },
      {
        id: "EVT-014",
        timestamp: "2024-04-01T09:00:00Z",
        location: "Mombasa Port, Kenya",
        event: "Arrived — Kenya Customs Hold",
        status: "active",
        details: "Kenya Revenue Authority (KRA) pre-shipment inspection required. Certificate mismatch on HS 8471.30. Estimated 3–4 day delay.",
      },
    ],
  },
  {
    id: "SHP-003",
    referenceNumber: "CL-SGP-EU-2024-003",
    description: "Precision Electronics — Southeast Asia → Europe Corridor",
    origin: { city: "Singapore", country: "Singapore", code: "SGSIN" },
    destination: { city: "Hamburg", country: "Germany", code: "DEHAM" },
    status: "booked",
    riskLevel: "low",
    departureDate: "2024-04-05",
    estimatedArrival: "2024-05-08",
    carrier: "CMA CGM",
    vessel: "CMA CGM Antoine de Saint Exupéry",
    containerCount: 2,
    weightKg: 14500,
    valueUSD: 920000,
    commodity: "Semiconductor Components & PCBs",
    hsCodes: ["8542.31", "8534.00", "8473.30"],
    supplierId: "SUP-005",
    carbonKgCO2e: 5200,
    currentLat: 1.3,
    currentLng: 103.8,
    events: [
      {
        id: "EVT-021",
        timestamp: "2024-03-28T10:00:00Z",
        location: "Singapore",
        event: "Shipment Booked",
        status: "completed",
        details: "Booking confirmed with CMA CGM. Singapore MAS export declaration filed.",
      },
      {
        id: "EVT-022",
        timestamp: "2024-04-05T00:00:00Z",
        location: "Port of Singapore (PSA)",
        event: "Container Loading",
        status: "pending",
        details: "Loading at Tanjong Pagar Terminal. Singapore customs clearance expected same day.",
      },
      {
        id: "EVT-023",
        timestamp: "2024-04-07T00:00:00Z",
        location: "Strait of Malacca",
        event: "In Transit — Malacca Strait",
        status: "pending",
      },
      {
        id: "EVT-024",
        timestamp: "2024-05-06T00:00:00Z",
        location: "Hamburg, Germany",
        event: "EU Customs Clearance — Import",
        status: "pending",
        details: "German customs inspection. Dual-use goods check may apply for semiconductor components.",
      },
      {
        id: "EVT-025",
        timestamp: "2024-05-08T00:00:00Z",
        location: "Hamburg, Germany",
        event: "Delivered to Consignee",
        status: "pending",
      },
    ],
  },
  {
    id: "SHP-004",
    referenceNumber: "CL-IND-US-2024-004",
    description: "Pharmaceutical API — India → North America Corridor",
    origin: { city: "Chennai", country: "India", code: "INMAA" },
    destination: { city: "New York", country: "USA", code: "USNYC" },
    status: "delayed",
    riskLevel: "critical",
    departureDate: "2024-03-05",
    estimatedArrival: "2024-04-08",
    carrier: "Hapag-Lloyd",
    vessel: "HL Colombo",
    containerCount: 1,
    weightKg: 8200,
    valueUSD: 380000,
    commodity: "Active Pharmaceutical Ingredients (API)",
    hsCodes: ["2941.10", "2941.90"],
    supplierId: "SUP-004",
    carbonKgCO2e: 5800,
    currentLat: 15.2,
    currentLng: 42.1,
    events: [
      {
        id: "EVT-031",
        timestamp: "2024-03-05T06:00:00Z",
        location: "Chennai Port (CTPL), India",
        event: "Vessel Departed",
        status: "completed",
        details: "CDSCO export permit verified. Schedule B filing confirmed.",
      },
      {
        id: "EVT-032",
        timestamp: "2024-03-22T00:00:00Z",
        location: "Red Sea, Yemen",
        event: "Vessel Diverted — Red Sea Security Alert",
        status: "active",
        details: "Vessel rerouted via Cape of Good Hope due to Houthi threat. +14 day delay. Notify US importer for FDA prior notice amendment.",
      },
    ],
  },
];

// ─── Suppliers — multi-region global network ──────────────────────────────────

export const suppliers: Supplier[] = [
  // Tier 1 — Direct suppliers
  {
    id: "SUP-001",
    name: "Indra Textiles Ltd",
    tier: 1,
    country: "India",
    city: "Tirupur",
    category: "Garment Manufacturer",
    riskLevel: "low",
    riskReasons: [],
    parentId: null,
    certifications: ["GOTS", "OCS", "SEDEX", "SA8000"],
    contactName: "Karthik Subramanian",
    leadTimeDays: 21,
  },
  {
    id: "SUP-002",
    name: "Gulf Sourcing & Distribution LLC",
    tier: 1,
    country: "UAE",
    city: "Dubai",
    category: "Regional Distribution Hub",
    riskLevel: "low",
    riskReasons: [],
    parentId: null,
    certifications: ["ISO 9001", "Dubai Customs Approved"],
    contactName: "Fatima Al-Mansoori",
    leadTimeDays: 7,
  },
  // Tier 2 — Sub-suppliers
  {
    id: "SUP-003",
    name: "Delta Cotton Cooperative",
    tier: 2,
    country: "India",
    city: "Coimbatore",
    category: "Raw Cotton Supplier",
    riskLevel: "medium",
    riskReasons: ["Monsoon disruption risk Q3", "Regional weather dependency"],
    parentId: "SUP-001",
    certifications: ["BCI", "Fair Trade"],
    contactName: "Priya Nair",
    leadTimeDays: 10,
  },
  {
    id: "SUP-004",
    name: "SynDye Chemical Works",
    tier: 2,
    country: "China",
    city: "Zhejiang",
    category: "Textile Dyes & Chemicals",
    riskLevel: "high",
    riskReasons: [
      "US Section 301 tariff exposure on Chinese chemicals",
      "Port congestion at Ningbo — 6-day avg delay",
      "Geopolitical risk: China–US trade tensions",
    ],
    parentId: "SUP-001",
    certifications: ["ISO 9001"],
    contactName: "Chen Wei",
    leadTimeDays: 28,
  },
  {
    id: "SUP-005",
    name: "SingTech Components Pte Ltd",
    tier: 2,
    country: "Singapore",
    city: "Singapore",
    category: "Electronics Sub-Assembly",
    riskLevel: "low",
    riskReasons: [],
    parentId: "SUP-002",
    certifications: ["ISO 9001", "ISO 14001", "RoHS"],
    contactName: "Wei Liang Tan",
    leadTimeDays: 14,
  },
  // Tier 3 — Raw material / origin producers
  {
    id: "SUP-006",
    name: "Xinjiang Cotton Farms",
    tier: 3,
    country: "China",
    city: "Xinjiang",
    category: "Cotton Farming",
    riskLevel: "critical",
    riskReasons: [
      "UFLPA entity list — US customs blocks all imports traceable to this origin",
      "EU Corporate Sustainability Due Diligence Directive (CSDDD) exposure",
      "UK Modern Slavery Act compliance failure risk",
      "Severe reputational and legal exposure across all corridors",
    ],
    parentId: "SUP-003",
    certifications: [],
    contactName: "—",
    leadTimeDays: 45,
  },
  {
    id: "SUP-007",
    name: "BASF Intermediates GmbH",
    tier: 3,
    country: "Germany",
    city: "Ludwigshafen",
    category: "Chemical Precursors",
    riskLevel: "low",
    riskReasons: [],
    parentId: "SUP-004",
    certifications: ["REACH", "ISO 14001", "GMP"],
    contactName: "Klaus Müller",
    leadTimeDays: 12,
  },
  {
    id: "SUP-008",
    name: "East Africa Minerals Ltd",
    tier: 3,
    country: "Kenya",
    city: "Nairobi",
    category: "Raw Minerals & Packaging",
    riskLevel: "medium",
    riskReasons: [
      "Port of Mombasa congestion risk",
      "Currency volatility (KES/USD)",
      "Infrastructure reliability — inland logistics",
    ],
    parentId: "SUP-002",
    certifications: ["ISO 9001"],
    contactName: "James Mutua",
    leadTimeDays: 18,
  },
];

// ─── Tariff Scenarios — multi-corridor, multi-regulation ──────────────────────

export const tariffScenarios: TariffScenario[] = [
  {
    id: "TAR-001",
    name: "EU Carbon Border Adjustment (CBAM)",
    description:
      "EU CBAM imposes a carbon price on imported goods including textiles. Phased reporting from 2024, full cost obligation from 2026. Affects all non-EU exporters shipping into EU.",
    destinationCountry: "Netherlands (EU)",
    hsCode: "5208.21",
    baseRatePercent: 12,
    newRatePercent: 17.5,
    cargoValueUSD: 142000,
    additionalDutyUSD: 7810,
    impactPercent: 5.5,
    triggerDate: "2026-01-01",
    recommendation:
      "Switch to GOTS-certified low-carbon supply chain to qualify for CBAM exemption. Estimated saving: $5,200/shipment. Applies to India→EU, UAE→EU, and SEA→EU corridors.",
  },
  {
    id: "TAR-002",
    name: "US Section 301 — Textile & Chemical Tariff Hike",
    description:
      "US raises Section 301 tariffs on Indian cotton garments and Chinese chemical inputs. Effective immediately on HS 6205.20. Impacts India→US and any supply chain with Chinese chemical sub-suppliers.",
    destinationCountry: "USA",
    hsCode: "6205.20",
    baseRatePercent: 15,
    newRatePercent: 27.5,
    cargoValueUSD: 95000,
    additionalDutyUSD: 11875,
    impactPercent: 12.5,
    triggerDate: "2024-05-01",
    recommendation:
      "Reroute via Bangladesh (BGMEA-certified, GSP eligible) for US-bound garments. Renegotiate buyer contracts with duty adjustment clause. Review chemical sourcing for Section 301-listed inputs.",
  },
  {
    id: "TAR-003",
    name: "UK DCTS — India Preferential Access",
    description:
      "UK Developing Countries Trading Scheme grants India 0% tariff on qualifying textile and apparel exports. Significant cost advantage over other origin countries shipping to UK.",
    destinationCountry: "UK",
    hsCode: "6204.62",
    baseRatePercent: 12,
    newRatePercent: 0,
    cargoValueUSD: 67500,
    additionalDutyUSD: -8100,
    impactPercent: -12,
    triggerDate: "2024-01-01",
    recommendation:
      "Increase UK shipment volume to capture DCTS advantage. Ensure 35% rules-of-origin value addition in India. File Form A. Compare against UAE→UK and SEA→UK duty rates.",
  },
];

// ─── Route Options — global corridor comparison ───────────────────────────────

export const routeOptions: RouteOption[] = [
  {
    id: "RTE-001",
    name: "Suez Canal (Current Route)",
    description: "Nhava Sheva → Colombo → Suez Canal → Rotterdam",
    mode: "sea",
    carrier: "Maersk Line",
    ports: ["Nhava Sheva", "Colombo", "Suez", "Port Said", "Rotterdam"],
    transitDays: 28,
    costUSD: 4200,
    carbonKgCO2e: 4120,
    reliability: 72,
    isCurrent: true,
    isRecommended: false,
    pros: ["Lowest base freight cost", "High sailing frequency", "Established lane"],
    cons: [
      "Red Sea / Houthi risk — active diversion alerts",
      "72% on-time reliability (down from 91%)",
      "Suez congestion history",
    ],
  },
  {
    id: "RTE-002",
    name: "Cape of Good Hope Reroute",
    description: "Nhava Sheva → Colombo → Cape Town → Rotterdam",
    mode: "sea",
    carrier: "CMA CGM",
    ports: ["Nhava Sheva", "Colombo", "Cape Town", "Las Palmas", "Rotterdam"],
    transitDays: 38,
    costUSD: 5100,
    carbonKgCO2e: 5680,
    reliability: 88,
    isCurrent: false,
    isRecommended: false,
    pros: ["Avoids Red Sea entirely", "88% on-time reliability", "No geopolitical exposure"],
    cons: ["+10 days transit", "+$900 freight cost per TEU", "+38% carbon vs Suez"],
  },
  {
    id: "RTE-003",
    name: "International North-South Corridor (INSTC)",
    description: "Nhava Sheva → Bandar Abbas → Baku → Moscow → Warsaw → Hamburg",
    mode: "rail",
    carrier: "INSTC Consortium",
    ports: ["Nhava Sheva", "Bandar Abbas", "Baku", "Moscow", "Warsaw", "Hamburg"],
    transitDays: 22,
    costUSD: 6800,
    carbonKgCO2e: 1240,
    reliability: 81,
    isCurrent: false,
    isRecommended: false,
    pros: [
      "Fastest corridor (-6 days vs Suez)",
      "-70% carbon emissions vs sea",
      "No ocean geopolitical risk",
      "Strategic emerging trade lane",
    ],
    cons: [
      "Sanctions compliance risk on Iran/Russia legs",
      "+62% freight cost vs sea",
      "Limited reefer and OOG capacity",
      "Higher insurance premium",
    ],
  },
  {
    id: "RTE-004",
    name: "Air Freight — Priority Express",
    description: "Origin Airport → Dubai Hub → Destination Airport",
    mode: "air",
    carrier: "Emirates SkyCargo / Lufthansa Cargo",
    ports: ["Origin Airport", "Dubai (DXB)", "Frankfurt (FRA)", "Destination"],
    transitDays: 3,
    costUSD: 28000,
    carbonKgCO2e: 62400,
    reliability: 96,
    isCurrent: false,
    isRecommended: false,
    pros: ["Fastest: 3 days door-to-door", "96% on-time reliability", "Ideal for high-value or perishable cargo"],
    cons: [
      "+567% freight premium vs sea",
      "+1,415% carbon footprint vs sea",
      "Weight and volume restrictions",
      "Not viable for bulk commodity cargo",
    ],
  },
];

// ─── Alerts — multi-region, multi-regulation ─────────────────────────────────

export const alerts: Alert[] = [
  {
    id: "ALT-001",
    type: "supplier_risk",
    severity: "critical",
    title: "UFLPA Risk: Tier-3 Supplier Flagged — All US Corridors",
    message:
      "Xinjiang Cotton Farms (Tier-3) is on the UFLPA entity list. US CBP will block all imports traceable to this origin across any corridor. Immediate supply chain audit and supplier replacement required.",
    shipmentId: "SHP-001",
    supplierId: "SUP-006",
    createdAt: "2024-03-28T09:00:00Z",
    isRead: false,
  },
  {
    id: "ALT-002",
    type: "delay",
    severity: "critical",
    title: "Red Sea Diversion — SHP-004 Delayed 14 Days",
    message:
      "HL Colombo rerouted via Cape of Good Hope. India→US corridor ETA revised from Apr 8 to Apr 22. Amend FDA prior notice filing. Notify US consignee immediately.",
    shipmentId: "SHP-004",
    createdAt: "2024-03-22T00:00:00Z",
    isRead: false,
  },
  {
    id: "ALT-003",
    type: "tariff",
    severity: "high",
    title: "US Section 301 Tariff Hike — India→US & SEA→US Corridors",
    message:
      "US raises tariffs on cotton garments (HS 6205.20) from 15% to 27.5% effective May 1. Impacts India→US and China-origin sub-supply chains. Duty impact: +$11,875 on current open orders.",
    shipmentId: "SHP-001",
    createdAt: "2024-03-25T08:00:00Z",
    isRead: false,
  },
  {
    id: "ALT-004",
    type: "customs",
    severity: "high",
    title: "Certificate Mismatch — SHP-002 at Mombasa Port",
    message:
      "Kenya Revenue Authority (KRA) inspection flagged HS code mismatch on electronics (8471.30). Certificate of conformity does not match manifest. Expected 3–4 day hold. Submit corrected documentation to local agent.",
    shipmentId: "SHP-002",
    createdAt: "2024-03-20T15:00:00Z",
    isRead: true,
  },
  {
    id: "ALT-005",
    type: "supplier_risk",
    severity: "high",
    title: "SynDye (Tier-2, China) — Port Congestion + Section 301 Risk",
    message:
      "Ningbo port congestion averaging 6-day delays. SynDye also newly listed under Section 301 tariff schedule. May impact India→EU and India→US production schedules. Identify alternative EU/India-origin dye supplier.",
    supplierId: "SUP-004",
    createdAt: "2024-03-27T11:00:00Z",
    isRead: false,
  },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function getShipmentById(id: string): Shipment | undefined {
  return shipments.find((s) => s.id === id);
}

export function getSuppliersByShipmentId(shipmentId: string): Supplier[] {
  const shipment = getShipmentById(shipmentId);
  if (!shipment) return [];
  return suppliers;
}

export function getAlertsByShipmentId(shipmentId: string): Alert[] {
  return alerts.filter((a) => a.shipmentId === shipmentId);
}

export function getUnreadAlerts(): Alert[] {
  return alerts.filter((a) => !a.isRead);
}

// ─── Global corridor metadata ─────────────────────────────────────────────────

export const corridors = [
  { id: "all",    label: "All Corridors" },
  { id: "ind-eu", label: "India → EU" },
  { id: "uae-afr",label: "UAE → East Africa" },
  { id: "sea-eu", label: "SE Asia → Europe" },
  { id: "ind-us", label: "India → US" },
];

export const currencies = [
  { code: "USD", symbol: "$",  label: "US Dollar" },
  { code: "EUR", symbol: "€",  label: "Euro" },
  { code: "AED", symbol: "AED",label: "UAE Dirham" },
  { code: "INR", symbol: "₹",  label: "Indian Rupee" },
];

export const fxRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  AED: 3.67,
  INR: 83.5,
};

export function convertCurrency(usd: number, toCurrency: string): string {
  const rate = fxRates[toCurrency] ?? 1;
  const symbol = currencies.find((c) => c.code === toCurrency)?.symbol ?? "$";
  const converted = usd * rate;
  if (converted >= 1_000_000) return `${symbol}${(converted / 1_000_000).toFixed(2)}M`;
  if (converted >= 1_000) return `${symbol}${(converted / 1_000).toFixed(1)}K`;
  return `${symbol}${converted.toFixed(0)}`;
}
