"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Package, ArrowRight, Search, ChevronDown, Calculator } from "lucide-react";
import { Navbar } from "@/app/components/Navbar";
import { StatusPill } from "@/app/components/ui/StatusPill";
import { Badge } from "@/app/components/ui/Badge";
import { createClient } from "@/app/lib/supabase/client";
import type { Shipment } from "@/app/lib/supabase/shipment-types";
import type { ShipmentStatus } from "@/app/types";

const SELECT_CLS =
  "text-xs font-medium pl-2.5 pr-6 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer";

export default function ShipmentsPage() {
  const [allShipments, setAllShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [corridorFilter, setCorridorFilter] = useState("all");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("shipments")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setAllShipments((data ?? []) as Shipment[]);
        setLoading(false);
      });
  }, []);

  const shipments = useMemo(() => {
    let s = allShipments;
    if (statusFilter !== "all") s = s.filter((x) => x.status === statusFilter);
    if (riskFilter !== "all") s = s.filter((x) => x.risk_level === riskFilter);
    if (modeFilter !== "all") s = s.filter((x) => x.shipment_mode === modeFilter);
    if (corridorFilter !== "all") s = s.filter((x) => x.corridor === corridorFilter);
    if (q) {
      const lq = q.toLowerCase();
      s = s.filter(
        (x) =>
          x.shipment_code.toLowerCase().includes(lq) ||
          x.shipper_company.toLowerCase().includes(lq) ||
          x.origin_port.toLowerCase().includes(lq) ||
          x.destination_port.toLowerCase().includes(lq) ||
          x.corridor.toLowerCase().includes(lq)
      );
    }
    return s;
  }, [allShipments, statusFilter, riskFilter, modeFilter, corridorFilter, q]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-600" />
              Shipments
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {loading ? "Loading…" : `${shipments.length} shipments`} across global corridors
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/estimate"
              className="inline-flex items-center gap-2 border border-gray-300 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 text-gray-600 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Calculator className="w-4 h-4" /> Estimate First
            </Link>
            <Link
              href="/shipments/new"
              className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <Package className="w-4 h-4" /> New Shipment
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by ID, company, port…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
            />
          </div>

          <div className="relative">
            <select value={corridorFilter} onChange={(e) => setCorridorFilter(e.target.value)} className={SELECT_CLS}>
              <option value="all">All Corridors</option>
              <option value="India → EU">India → EU</option>
              <option value="India → US">India → US</option>
              <option value="UAE → East Africa">UAE → East Africa</option>
              <option value="SE Asia → Europe">SE Asia → Europe</option>
              <option value="China → Middle East">China → Middle East</option>
              <option value="Europe → Africa">Europe → Africa</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={SELECT_CLS}>
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="booked">Booked</option>
              <option value="in_transit">In Transit</option>
              <option value="customs_hold">Customs Hold</option>
              <option value="delayed">Delayed</option>
              <option value="delivered">Delivered</option>
              <option value="at_risk">At Risk</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className={SELECT_CLS}>
              <option value="all">All Risk</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className={SELECT_CLS}>
              <option value="all">All Modes</option>
              <option value="sea">Sea</option>
              <option value="air">Air</option>
              <option value="rail">Rail</option>
              <option value="multimodal">Multimodal</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {loading && (
            <div className="bg-white rounded-xl p-8 border border-gray-200 text-center text-xs text-gray-400">
              Loading shipments…
            </div>
          )}
          {!loading && allShipments.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-14 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <Package className="w-7 h-7 text-blue-400" />
              </div>
              <p className="text-base font-semibold text-gray-800 mb-1.5">Ready for live shipments</p>
              <p className="text-sm text-gray-400 mb-2 max-w-sm mx-auto leading-relaxed">
                All AI models are active. Add your first shipment to see real-time tracking,
                compliance checks, and route optimization in action.
              </p>
              <p className="text-xs text-gray-300 mb-6">Port congestion · Delay prediction · Sanctions screening · Carbon routing</p>
              <Link
                href="/shipments/new"
                className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-sm"
              >
                <Package className="w-4 h-4" /> Add Shipment
              </Link>
            </div>
          )}
          {!loading && allShipments.length > 0 && shipments.length === 0 && (
            <div className="bg-white rounded-xl p-8 border border-gray-200 text-center text-xs text-gray-400">
              No shipments match the selected filters
            </div>
          )}
          {shipments.map((s) => (
            <Link
              key={s.id}
              href={`/shipments/${s.id}`}
              className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold text-gray-800">{s.shipment_code}</span>
                  <StatusPill status={s.status as ShipmentStatus} />
                  <Badge
                    label={s.risk_level.charAt(0).toUpperCase() + s.risk_level.slice(1)}
                    variant={s.risk_level as "low" | "medium" | "high" | "critical"}
                    dot
                  />
                </div>
                <div className="text-sm text-gray-700 font-medium">{s.cargo_category}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {s.origin_port}, {s.origin_country} → {s.destination_port},{" "}
                  {s.destination_country} · {s.carrier ?? s.shipment_mode} · ETA{" "}
                  {s.eta_date
                    ? new Date(s.eta_date).toLocaleDateString("en-GB", { dateStyle: "medium" })
                    : "TBC"}
                </div>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">
                    {s.declared_value?.toLocaleString()} {s.currency}
                  </div>
                  <div className="text-xs text-gray-400">{s.weight} kg</div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300" />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
