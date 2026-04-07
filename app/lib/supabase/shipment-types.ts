export type Shipment = {
  id: string;
  user_id: string | null;
  shipment_code: string;
  shipper_company: string;
  contact_name: string | null;
  email: string | null;
  origin_country: string;
  origin_port: string;
  destination_country: string;
  destination_port: string;
  consignee_name: string | null;
  cargo_category: string;
  hs_code: string | null;
  weight: number;
  volume: number;
  incoterm: string | null;
  shipment_mode: string;
  priority: string;
  expected_dispatch_date: string | null;
  declared_value: number;
  currency: string;
  status: string;
  risk_level: string;
  eta_date: string | null;
  corridor: string;
  carrier: string | null;
  carbon_kg: number;
  compliance_notes: string | null;
  notes: string | null;
  is_seeded: boolean;
  created_at: string;
};

export type ShipmentFilters = {
  q?: string;
  corridor?: string;
  status?: string;
  risk_level?: string;
  shipment_mode?: string;
  currency?: string;
};

/** Map DB status values to StatusPill-compatible values */
export function normalizeStatus(status: string): string {
  if (status === "customs_hold") return "customs";
  return status;
}
