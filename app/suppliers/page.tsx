"use client";

import { useState } from "react";
import {
  GitBranch,
  ShieldAlert,
  MapPin,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  X,
  ChevronDown,
  ChevronRight,
  Package,
} from "lucide-react";
import { Navbar } from "@/app/components/Navbar";
import { Badge } from "@/app/components/ui/Badge";
import { suppliers } from "@/app/lib/seed-data";
import { type Supplier, type RiskLevel } from "@/app/types";

const riskCfg: Record<RiskLevel, { bg: string; text: string; border: string; dot: string }> = {
  low:      { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  medium:   { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500" },
  high:     { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200",  dot: "bg-orange-500" },
  critical: { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     dot: "bg-red-500" },
};

function SupplierNode({ supplier, selected, onSelect }: { supplier: Supplier; selected: boolean; onSelect: () => void }) {
  const rc = riskCfg[supplier.riskLevel];
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl p-3 border-2 transition-all relative ${
        selected ? `${rc.bg} ${rc.border}` : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      {supplier.riskLevel === "critical" && (
        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-2.5 h-2.5 text-white" />
        </div>
      )}
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${rc.bg} ${rc.text}`}>
          T{supplier.tier}
        </div>
        <div className="text-xs font-semibold text-gray-800 leading-tight truncate">{supplier.name}</div>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-gray-400">
        <MapPin className="w-2.5 h-2.5" />
        {supplier.city}, {supplier.country}
      </div>
      <div className="text-[11px] text-gray-400 mt-0.5 truncate">{supplier.category}</div>
    </button>
  );
}

function SupplierDetail({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const rc = riskCfg[supplier.riskLevel];
  return (
    <div className={`rounded-xl border-2 p-5 ${rc.bg} ${rc.border}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${rc.bg} ${rc.text} border ${rc.border}`}>
              Tier {supplier.tier}
            </span>
            <Badge
              label={supplier.riskLevel.charAt(0).toUpperCase() + supplier.riskLevel.slice(1) + " Risk"}
              variant={supplier.riskLevel}
              dot
            />
          </div>
          <h3 className="text-base font-bold text-gray-900">{supplier.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{supplier.category}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/60 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {[
          { icon: MapPin,   label: "Location",  value: `${supplier.city}, ${supplier.country}` },
          { icon: Users,    label: "Contact",   value: supplier.contactName },
          { icon: Clock,    label: "Lead Time", value: `${supplier.leadTimeDays} days` },
          { icon: Package,  label: "Category",  value: supplier.category },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1">
              <Icon className="w-3 h-3" />{label}
            </div>
            <div className="text-xs text-gray-800 font-medium">{value}</div>
          </div>
        ))}
      </div>

      {supplier.riskReasons.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-600 mb-2">Risk Flags</div>
          <div className="flex flex-col gap-1.5">
            {supplier.riskReasons.map((r) => (
              <div key={r} className="flex items-start gap-2 text-xs">
                <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${supplier.riskLevel === "critical" ? "text-red-600" : "text-orange-500"}`} />
                <span className="text-gray-700">{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {supplier.certifications.length > 0 ? (
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2">Certifications</div>
          <div className="flex flex-wrap gap-1.5">
            {supplier.certifications.map((cert) => (
              <div key={cert} className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-2.5 h-2.5" />{cert}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          No certifications on file. High compliance exposure.
        </div>
      )}
    </div>
  );
}

type TreeNode = Supplier & { children: TreeNode[] };

function buildTree(all: Supplier[], parentId: string | null = null): TreeNode[] {
  return all.filter((s) => s.parentId === parentId).map((s) => ({ ...s, children: buildTree(all, s.id) }));
}

function TreeRow({ node, depth, selectedId, onSelect }: { node: TreeNode; depth: number; selectedId: string | null; onSelect: (s: Supplier) => void }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const rc = riskCfg[node.riskLevel];

  return (
    <div>
      <div
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        className="flex items-center gap-2 py-2 pr-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
        onClick={() => { onSelect(node); if (hasChildren) setOpen(!open); }}
      >
        {hasChildren ? (
          open ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        ) : (
          <div className="w-3.5 h-3.5 shrink-0" />
        )}
        <div className={`text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center shrink-0 ${rc.bg} ${rc.text}`}>
          T{node.tier}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-800 truncate">{node.name}</div>
          <div className="text-[11px] text-gray-400 truncate">{node.city}, {node.country}</div>
        </div>
        <Badge
          label={node.riskLevel === "critical" ? "Critical" : node.riskLevel === "high" ? "High" : node.riskLevel === "medium" ? "Med" : "Low"}
          variant={node.riskLevel}
          size="sm"
        />
      </div>
      {open && hasChildren && (
        <div className="border-l-2 border-gray-100 ml-6.5">
          {node.children.map((child) => (
            <TreeRow key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SuppliersPage() {
  const [selected, setSelected] = useState<Supplier | null>(null);

  const tier1 = suppliers.filter((s) => s.tier === 1);
  const tier2 = suppliers.filter((s) => s.tier === 2);
  const tier3 = suppliers.filter((s) => s.tier === 3);
  const criticalCount = suppliers.filter((s) => s.riskLevel === "critical").length;
  const highCount = suppliers.filter((s) => s.riskLevel === "high").length;
  const tree = buildTree(suppliers);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-violet-600" />
            Global Supplier Risk Network
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Multi-tier supplier map across India, UAE, Singapore, China, Europe, and East Africa. Click any node to view risk flags, certifications, and compliance status.
          </p>
        </div>

        {/* Risk summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Global Suppliers", value: suppliers.length, cls: "text-gray-900" },
            { label: "Critical Risk",   value: criticalCount,     cls: "text-red-600" },
            { label: "High Risk",       value: highCount,         cls: "text-orange-600" },
            { label: "Compliant",       value: suppliers.filter((s) => s.certifications.length > 0).length, cls: "text-emerald-600" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <div className={`text-2xl font-bold ${cls}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Critical alert */}
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-red-800 mb-0.5">
              CRITICAL: UFLPA Exposure via Xinjiang Cotton Farms (Tier 3) across all US-bound corridors
            </div>
            <div className="text-xs text-red-700 leading-relaxed">
              Xinjiang Cotton Farms is on the UFLPA entity list. US CBP will block all imports traceable to this origin across India→US, UAE→US, and SE Asia→US corridors. EU CSDDD and UK Modern Slavery Act compliance risk also applies. Immediate supplier replacement required before any cross-border shipment.
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Tier grid + tree — 2/3 */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Visual tier map */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Multi-Region Supply Chain Visual Tier Map</h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { tier: 1, label: "TIER 1: Direct", dot: "bg-blue-500", list: tier1 },
                  { tier: 2, label: "TIER 2: Sub-suppliers", dot: "bg-amber-500", list: tier2 },
                  { tier: 3, label: "TIER 3: Raw Materials", dot: "bg-red-500", list: tier3 },
                ].map(({ label, dot, list }) => (
                  <div key={label}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <div className={`w-2 h-2 rounded-full ${dot}`} />
                      <span className="text-[11px] font-semibold text-gray-400">{label}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {list.map((s) => (
                        <SupplierNode key={s.id} supplier={s} selected={selected?.id === s.id} onSelect={() => setSelected(s)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Legend */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3">
                {(["low", "medium", "high", "critical"] as RiskLevel[]).map((level) => (
                  <div key={level} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <div className={`w-2.5 h-2.5 rounded-full ${riskCfg[level].dot}`} />
                    {level.charAt(0).toUpperCase() + level.slice(1)} Risk
                  </div>
                ))}
              </div>
            </div>

            {/* Tree */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Hierarchical Tree View</h2>
              {tree.map((node) => (
                <TreeRow key={node.id} node={node} depth={0} selectedId={selected?.id ?? null} onSelect={setSelected} />
              ))}
            </div>
          </div>

          {/* Right panel — 1/3 */}
          <div className="flex flex-col gap-4">
            {selected ? (
              <SupplierDetail supplier={selected} onClose={() => setSelected(null)} />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
                <GitBranch className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Click a supplier node to see details, risk flags, and certifications</p>
              </div>
            )}

            {/* Risk by tier */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Risk by Tier</h3>
              {([1, 2, 3] as const).map((tier) => {
                const ts = suppliers.filter((s) => s.tier === tier);
                const maxRisk = ts.some((s) => s.riskLevel === "critical")
                  ? "critical" : ts.some((s) => s.riskLevel === "high") ? "high" : "low";
                return (
                  <div key={tier} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                    <div className="text-xs text-gray-600">Tier {tier} ({ts.length} suppliers)</div>
                    <Badge label={maxRisk.charAt(0).toUpperCase() + maxRisk.slice(1)} variant={maxRisk} dot />
                  </div>
                );
              })}
            </div>

            {/* Recommended actions */}
            <div className="bg-red-50 rounded-xl border border-red-200 p-5">
              <h3 className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Recommended Actions
              </h3>
              <div className="flex flex-col gap-2.5">
                {[
                  { action: "Remove Xinjiang Cotton Farms. This supplier blocks shipments across US, EU, and UK corridors.", priority: "URGENT", cls: "bg-red-100 text-red-700" },
                  { action: "Source alternative certified cotton from India or East Africa", priority: "HIGH", cls: "bg-orange-100 text-orange-700" },
                  { action: "Audit SynDye Chemical Works for REACH / Section 301 compliance", priority: "HIGH", cls: "bg-orange-100 text-orange-700" },
                  { action: "File CSDDD and UK Modern Slavery Act supplier disclosures for EU/UK buyers", priority: "MEDIUM", cls: "bg-amber-100 text-amber-700" },
                ].map(({ action, priority, cls }) => (
                  <div key={action} className="flex items-start gap-2.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${cls}`}>{priority}</span>
                    <span className="text-xs text-gray-700 leading-snug">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
