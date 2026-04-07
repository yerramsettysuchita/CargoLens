import { createClient } from "@/app/lib/supabase/client";
import type { Shipment, ShipmentFilters } from "./shipment-types";

export async function getShipments(filters: ShipmentFilters = {}): Promise<Shipment[]> {
  const supabase = createClient();

  let query = supabase
    .from("shipments")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.q) {
    query = query.or(
      [
        `shipment_code.ilike.%${filters.q}%`,
        `shipper_company.ilike.%${filters.q}%`,
        `corridor.ilike.%${filters.q}%`,
        `origin_port.ilike.%${filters.q}%`,
        `destination_port.ilike.%${filters.q}%`,
      ].join(",")
    );
  }

  if (filters.corridor && filters.corridor !== "all") {
    query = query.eq("corridor", filters.corridor);
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.risk_level && filters.risk_level !== "all") {
    query = query.eq("risk_level", filters.risk_level);
  }
  if (filters.shipment_mode && filters.shipment_mode !== "all") {
    query = query.eq("shipment_mode", filters.shipment_mode);
  }
  if (filters.currency && filters.currency !== "all") {
    query = query.eq("currency", filters.currency);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Shipment[];
}

export async function createShipment(
  payload: Omit<Shipment, "id" | "created_at" | "is_seeded"> & { user_id: string }
): Promise<Shipment> {
  const supabase = createClient();

  const shipment_code = `SHP-${Date.now().toString().slice(-6)}`;

  const { data, error } = await supabase
    .from("shipments")
    .insert([{ ...payload, shipment_code, is_seeded: false }])
    .select()
    .single();

  if (error) throw error;
  return data as Shipment;
}
