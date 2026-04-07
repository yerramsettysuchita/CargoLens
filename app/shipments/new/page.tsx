"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, ArrowLeft, ArrowRight, CheckCircle, Calculator, Check, ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";
import { Navbar } from "@/app/components/Navbar";
import { createClient } from "@/app/lib/supabase/client";
import { getCorridorProfile } from "@/app/lib/estimation";
import { validateShipment } from "@/app/lib/document-validation";
import { runSanctionsCheck } from "@/app/lib/sanctions-check";
import DocumentIntelligence from "@/app/components/DocumentIntelligence";
import type { Shipment } from "@/app/lib/supabase/shipment-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNTRIES = [
  "India", "UAE", "Singapore", "China", "Bangladesh", "Vietnam",
  "Thailand", "Malaysia", "Germany", "Netherlands", "USA", "UK",
  "France", "Italy", "Kenya", "Tanzania", "Australia", "Canada", "Japan",
];

const PORTS_BY_COUNTRY: Record<string, string[]> = {
  India:       ["Nhava Sheva (Mumbai)", "Chennai", "Mundra", "Kolkata", "Cochin"],
  UAE:         ["Jebel Ali", "Abu Dhabi (Khalifa Port)", "Sharjah"],
  Singapore:   ["Singapore (PSA — Tanjong Pagar)"],
  China:       ["Shanghai", "Shenzhen / Yantian", "Ningbo", "Qingdao"],
  Bangladesh:  ["Chittagong"],
  Vietnam:     ["Ho Chi Minh City (Cat Lai)", "Hai Phong"],
  Thailand:    ["Laem Chabang", "Bangkok (Ta Phut)"],
  Malaysia:    ["Port Klang", "Penang"],
  Germany:     ["Hamburg", "Bremen / Bremerhaven"],
  Netherlands: ["Rotterdam", "Amsterdam"],
  USA:         ["New York / Newark", "Los Angeles / Long Beach", "Houston", "Savannah"],
  UK:          ["Felixstowe", "Southampton", "London Gateway"],
  France:      ["Le Havre", "Marseille"],
  Italy:       ["Genoa", "La Spezia"],
  Kenya:       ["Mombasa"],
  Tanzania:    ["Dar es Salaam"],
  Australia:   ["Melbourne", "Sydney"],
  Canada:      ["Vancouver", "Montreal"],
  Japan:       ["Yokohama", "Kobe"],
};

const CARGO_CATEGORIES = [
  "General Cargo",
  "Textiles & Apparel",
  "Electronics & Technology",
  "Pharmaceuticals & Life Sciences",
  "Chemicals & Petrochemicals",
  "Food & Agriculture",
  "Machinery & Industrial Equipment",
  "Automotive & Spare Parts",
  "Construction Materials",
  "Furniture & Home Goods",
  "Dangerous Goods (DG)",
];

const INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"];
const MODES = [
  "Sea — FCL (Full Container Load)",
  "Sea — LCL (Less than Container Load)",
  "Air Freight",
  "Rail Freight",
  "Road / Truck",
  "Multimodal",
];
const PRIORITIES = ["Balanced", "Lowest Cost", "Fastest Transit", "Low Carbon"];

function generateShipmentId() {
  const num = Math.floor(5 + Math.random() * 95);
  return `SHP-${String(num).padStart(3, "0")}`;
}

function generateRef() {
  return `CL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ─── Field helper ─────────────────────────────────────────────────────────────

const INPUT_CLS =
  "w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-gray-700 mb-1 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

const STEP_LABELS = ["Details", "Services", "Compliance", "Review"];

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center mb-6">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                i + 1 < step
                  ? "bg-blue-700 text-white"
                  : i + 1 === step
                  ? "bg-blue-100 text-blue-700 border-2 border-blue-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {i + 1 < step ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium hidden sm:block ${
                i + 1 <= step ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div
              className={`flex-1 h-px mx-2 ${i + 1 < step ? "bg-blue-700" : "bg-gray-200"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function NewShipmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refNum] = useState(generateRef);
  const editId = searchParams.get("editId");
  const isEditMode = !!editId;

  // ── Read URL params (from /estimate flow) ────────────────────────────────────
  const paramOrigin     = searchParams.get("origin");
  const paramDest       = searchParams.get("dest");
  const paramOriginPort = searchParams.get("originPort");
  const paramDestPort   = searchParams.get("destPort");
  const paramMode       = searchParams.get("mode");
  const paramCarrier    = searchParams.get("carrier");
  const paramPriority   = searchParams.get("priority");
  const paramCargo      = searchParams.get("cargo");
  const paramWeight     = searchParams.get("weight");
  const paramVolume     = searchParams.get("volume");
  const paramCost       = searchParams.get("cost");
  const paramDays       = searchParams.get("days");
  const paramCarbon     = searchParams.get("carbon");

  const fromEstimate = !!(paramCost && paramDays);

  // Resolve ports: use param if valid for the country, else fall back to first port
  const originCountry0  = paramOrigin ?? "India";
  const destCountry0    = paramDest   ?? "Netherlands";
  const originPort0 =
    paramOriginPort && PORTS_BY_COUNTRY[originCountry0]?.includes(paramOriginPort)
      ? paramOriginPort
      : PORTS_BY_COUNTRY[originCountry0]?.[0] ?? "Nhava Sheva (Mumbai)";
  const destPort0 =
    paramDestPort && PORTS_BY_COUNTRY[destCountry0]?.includes(paramDestPort)
      ? paramDestPort
      : PORTS_BY_COUNTRY[destCountry0]?.[0] ?? "Rotterdam";

  // Fuzzy-match cargo category
  const cargoCategory0 =
    CARGO_CATEGORIES.find((c) =>
      c.toLowerCase().includes((paramCargo ?? "").toLowerCase()),
    ) ?? "General Cargo";

  const modeDisplay0 =
    paramMode === "air"  ? "Air Freight" :
    paramMode === "rail" ? "Rail Freight" :
    "Sea — FCL (Full Container Load)";

  const priorityDisplay0 =
    paramPriority === "fastest"     ? "Fastest Transit" :
    paramPriority === "lowest_cost" ? "Lowest Cost" :
    paramPriority === "low_carbon"  ? "Low Carbon" : "Balanced";

  const [form, setForm] = useState({
    companyName:        "",
    contactName:        "",
    email:              "",
    originCountry:      originCountry0,
    originPort:         originPort0,
    destinationCountry: destCountry0,
    destinationPort:    destPort0,
    consigneeName:      "",
    cargoCategory:      cargoCategory0,
    hsCode:             "",
    weightKg:           paramWeight  ?? "",
    volumeCBM:          paramVolume  ?? "",
    declaredValueUSD:   "",
    incoterm:           "FOB",
    mode:               modeDisplay0,
    priority:           priorityDisplay0,
    dispatchDate:       "",
    notes:              paramCarrier ? `Pre-selected carrier: ${paramCarrier}` : "",
    complianceNotes:    "",
  });

  // ── Load existing shipment for edit mode ─────────────────────────────────────
  useEffect(() => {
    if (!editId) return;
    const supabase = createClient();
    supabase.from("shipments").select("*").eq("id", editId).single().then(({ data }) => {
      if (!data) return;
      const modeDisplay =
        data.shipment_mode === "air"  ? "Air Freight" :
        data.shipment_mode === "rail" ? "Rail Freight" :
        "Sea — FCL (Full Container Load)";
      const priorityDisplay =
        data.priority === "fastest"     ? "Fastest Transit" :
        data.priority === "lowest_cost" ? "Lowest Cost" :
        data.priority === "low_carbon"  ? "Low Carbon" : "Balanced";
      setForm({
        companyName:        data.shipper_company ?? "",
        contactName:        data.contact_name ?? "",
        email:              data.email ?? "",
        originCountry:      data.origin_country ?? "India",
        originPort:         data.origin_port ?? "",
        destinationCountry: data.destination_country ?? "Netherlands",
        destinationPort:    data.destination_port ?? "",
        consigneeName:      data.consignee_name ?? "",
        cargoCategory:      data.cargo_category ?? "General Cargo",
        hsCode:             data.hs_code ?? "",
        weightKg:           String(data.weight ?? ""),
        volumeCBM:          String(data.volume ?? ""),
        declaredValueUSD:   String(data.declared_value ?? ""),
        incoterm:           data.incoterm ?? "FOB",
        mode:               modeDisplay,
        priority:           priorityDisplay,
        dispatchDate:       data.expected_dispatch_date ?? "",
        notes:              data.notes ?? "",
        complianceNotes:    data.compliance_notes ?? "",
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function handleOriginCountry(value: string) {
    const ports = PORTS_BY_COUNTRY[value] ?? [];
    setForm((f) => ({ ...f, originCountry: value, originPort: ports[0] ?? "" }));
  }
  function handleDestCountry(value: string) {
    const ports = PORTS_BY_COUNTRY[value] ?? [];
    setForm((f) => ({ ...f, destinationCountry: value, destinationPort: ports[0] ?? "" }));
  }

  // Basic step-gate checks
  const step1Valid =
    form.companyName.trim() && form.contactName.trim() && form.email.trim() &&
    form.consigneeName.trim() && form.weightKg && form.volumeCBM;
  const step2Valid = form.dispatchDate && form.declaredValueUSD;

  // Pre-flight compliance computed from form state — used in step 3 only
  const preflight = useMemo(() => {
    if (step !== 3) return null;
    const modeKey =
      form.mode.toLowerCase().startsWith("air")  ? "air" :
      form.mode.toLowerCase().startsWith("rail") ? "rail" : "sea";
    const partial: Shipment = {
      id: "preflight", user_id: null, shipment_code: refNum,
      shipper_company: form.companyName || "—",
      contact_name: form.contactName || null,
      email: form.email || null,
      origin_country:      form.originCountry,
      origin_port:         form.originPort,
      destination_country: form.destinationCountry,
      destination_port:    form.destinationPort,
      consignee_name: form.consigneeName || null,
      cargo_category: form.cargoCategory,
      hs_code:        form.hsCode || null,
      weight:  parseFloat(form.weightKg)  || 0,
      volume:  parseFloat(form.volumeCBM) || 0,
      incoterm: form.incoterm,
      shipment_mode: modeKey,
      priority: form.priority === "Fastest Transit" ? "fastest" :
                form.priority === "Lowest Cost"     ? "lowest_cost" :
                form.priority === "Low Carbon"      ? "low_carbon" : "balanced",
      expected_dispatch_date: form.dispatchDate || null,
      declared_value: parseFloat(form.declaredValueUSD) || 0,
      currency: "USD",
      status: "booked", risk_level: "low",
      eta_date: null,
      corridor: `${form.originCountry} → ${form.destinationCountry}`,
      carrier: null, carbon_kg: 0,
      compliance_notes: form.complianceNotes || null,
      notes: form.notes || null,
      is_seeded: false, created_at: new Date().toISOString(),
    };
    return {
      partial,
      validation: validateShipment(partial),
      sanctions:  runSanctionsCheck(partial),
    };
  }, [step, form, refNum]);

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth?next=/shipments/new");
      return;
    }

    const shipment_code = `SHP-${Date.now().toString().slice(-6)}`;
    const corridor = `${form.originCountry} → ${form.destinationCountry}`;

    const modeKey =
      form.mode.toLowerCase().startsWith("air")  ? "air" :
      form.mode.toLowerCase().startsWith("rail") ? "rail" : "sea";

    const priorityKey =
      form.priority === "Fastest Transit" ? "fastest" :
      form.priority === "Lowest Cost"     ? "lowest_cost" :
      form.priority === "Low Carbon"      ? "low_carbon" : "balanced";

    const profile = getCorridorProfile(form.originCountry, form.destinationCountry);
    const weight  = parseFloat(form.weightKg)  || 0;
    const volume  = parseFloat(form.volumeCBM) || 0;

    const distKm       = modeKey === "air" ? profile.airDistKm : profile.seaDistKm;
    const carbonFactor = modeKey === "air" ? 0.55 : modeKey === "rail" ? 0.007 : 0.016;
    const carbon_kg    = Math.max(80, Math.round(weight * distKm * carbonFactor / 1000));

    const transitDays = modeKey === "air" ? profile.airDays
      : (modeKey === "rail" && profile.hasRail) ? profile.railDays
      : profile.seaDays;

    const baseDate = form.dispatchDate ? new Date(form.dispatchDate) : new Date();
    const eta_date = new Date(baseDate.getTime() + transitDays * 86400000)
      .toISOString().split("T")[0];

    const carrier =
      modeKey === "sea"  ? (profile.seaCarrier.split(" / ")[0] ?? null) :
      modeKey === "air"  ? "Emirates SkyCargo" :
      modeKey === "rail" ? "DB Schenker Rail" : null;

    const partialShipment: Shipment = {
      id: "tmp", user_id: user.id, shipment_code,
      shipper_company: form.companyName, contact_name: form.contactName, email: form.email,
      origin_country: form.originCountry, origin_port: form.originPort,
      destination_country: form.destinationCountry, destination_port: form.destinationPort,
      consignee_name: form.consigneeName, cargo_category: form.cargoCategory,
      hs_code: form.hsCode || null, weight, volume,
      incoterm: form.incoterm, shipment_mode: modeKey, priority: priorityKey,
      expected_dispatch_date: form.dispatchDate || null,
      declared_value: parseFloat(form.declaredValueUSD) || 0, currency: "USD",
      status: "booked" as Shipment["status"], risk_level: "low", eta_date, corridor, carrier, carbon_kg,
      compliance_notes: form.complianceNotes || null, notes: form.notes || null,
      is_seeded: false, created_at: new Date().toISOString(),
    };

    const validation = validateShipment(partialShipment);
    const sanctions  = runSanctionsCheck(partialShipment);

    const risk_level =
      sanctions.riskLevel === "critical" ? "critical" :
      sanctions.riskLevel === "high"     ? "high" :
      (sanctions.riskLevel === "medium" || validation.score < 60) ? "medium" : "low";

    const shipmentPayload = {
      shipper_company: form.companyName, contact_name: form.contactName, email: form.email,
      origin_country: form.originCountry, origin_port: form.originPort,
      destination_country: form.destinationCountry, destination_port: form.destinationPort,
      consignee_name: form.consigneeName, cargo_category: form.cargoCategory,
      hs_code: form.hsCode || null, weight, volume,
      incoterm: form.incoterm, shipment_mode: modeKey, priority: priorityKey,
      expected_dispatch_date: form.dispatchDate || null,
      declared_value: parseFloat(form.declaredValueUSD) || 0, currency: "USD",
      notes: form.notes || null, compliance_notes: form.complianceNotes || null,
      risk_level, corridor, carrier, carbon_kg, eta_date,
    };

    if (isEditMode && editId) {
      const { error: updateError } = await supabase
        .from("shipments")
        .update(shipmentPayload)
        .eq("id", editId);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      router.push(`/shipments/${editId}`);
      return;
    }

    const { data: insertedShipment, error: insertError } = await supabase
      .from("shipments")
      .insert({
        user_id: user.id, shipment_code,
        ...shipmentPayload,
        status: "booked",
        is_seeded: false,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    if (insertedShipment) {
      await supabase.from("shipment_events").insert({
        shipment_id: insertedShipment.id,
        event_type:  "booked",
        event_label: "Shipment Booked",
        location:    form.originCountry,
        status:      "completed",
        occurred_at: new Date().toISOString(),
        notes: `${insertedShipment.shipment_code} registered. Mode: ${modeKey}. Carrier: ${carrier ?? modeKey}. Incoterm: ${form.incoterm}. Est. transit: ${transitDays}d. ETA: ${eta_date}.`,
      });

      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId: insertedShipment.id, type: "shipment_created" }),
      }).catch(() => {/* non-critical */});

      router.push(`/shipments/${insertedShipment.id}`);
    }

    setLoading(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-5">
          <Link
            href="/estimate"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {fromEstimate ? "Back to Estimate" : "Dashboard"}
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-xs text-gray-600 font-medium">{isEditMode ? "Edit Shipment" : "New Shipment"}</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            {isEditMode ? "Edit Shipment" : "New Shipment"}
          </h1>
          <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors">
            Cancel
          </Link>
        </div>

        {/* Estimate banner */}
        {fromEstimate && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 shrink-0">
              <Calculator className="w-3.5 h-3.5" /> Your Estimate
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-blue-800">
              <span>Cost: <strong>${Number(paramCost).toLocaleString()}</strong></span>
              <span>Transit: <strong>{paramDays} days</strong></span>
              {paramCarbon && (
                <span>
                  CO₂:{" "}
                  <strong>
                    {Number(paramCarbon) >= 1000
                      ? `${(Number(paramCarbon) / 1000).toFixed(1)}t`
                      : `${paramCarbon}kg`}
                  </strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stepper */}
        <Stepper step={step} />

        {/* Step content */}
        <div className="flex flex-col gap-4">

          {/* ── Step 1: Shipment Details ── */}
          {step === 1 && (
            <>
              <Section title="Shipper Information">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Company / Shipper Name" required>
                    <input
                      value={form.companyName}
                      onChange={(e) => set("companyName", e.target.value)}
                      placeholder="e.g., Indra Textiles Ltd"
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="Contact Name" required>
                    <input
                      value={form.contactName}
                      onChange={(e) => set("contactName", e.target.value)}
                      placeholder="e.g., Priya Sharma"
                      className={INPUT_CLS}
                    />
                  </Field>
                  <Field label="Email" required>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="priya@company.com"
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Route">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Origin Country" required>
                    <select value={form.originCountry} onChange={(e) => handleOriginCountry(e.target.value)} className={INPUT_CLS}>
                      {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Origin Port / City" required>
                    <select value={form.originPort} onChange={(e) => set("originPort", e.target.value)} className={INPUT_CLS}>
                      {(PORTS_BY_COUNTRY[form.originCountry] ?? []).map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Destination Country" required>
                    <select value={form.destinationCountry} onChange={(e) => handleDestCountry(e.target.value)} className={INPUT_CLS}>
                      {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Destination Port / City" required>
                    <select value={form.destinationPort} onChange={(e) => set("destinationPort", e.target.value)} className={INPUT_CLS}>
                      {(PORTS_BY_COUNTRY[form.destinationCountry] ?? []).map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Consignee Name" required className="sm:col-span-2">
                    <input
                      value={form.consigneeName}
                      onChange={(e) => set("consigneeName", e.target.value)}
                      placeholder="Receiving company or individual"
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Cargo Details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Cargo Category" required>
                    <select value={form.cargoCategory} onChange={(e) => set("cargoCategory", e.target.value)} className={INPUT_CLS}>
                      {CARGO_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="HS Code">
                    <input value={form.hsCode} onChange={(e) => set("hsCode", e.target.value)} placeholder="e.g., 6205.20" className={INPUT_CLS} />
                  </Field>
                  <Field label="Gross Weight (kg)" required>
                    <input type="number" value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} placeholder="e.g., 5000" className={INPUT_CLS} />
                  </Field>
                  <Field label="Volume (CBM)" required>
                    <input type="number" value={form.volumeCBM} onChange={(e) => set("volumeCBM", e.target.value)} placeholder="e.g., 18" className={INPUT_CLS} />
                  </Field>
                </div>
              </Section>
            </>
          )}

          {/* ── Step 2: Services ── */}
          {step === 2 && (
            <>
              <Section title="Logistics & Scheduling">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Shipment Mode" required>
                    <select value={form.mode} onChange={(e) => set("mode", e.target.value)} className={INPUT_CLS}>
                      {MODES.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Incoterm" required>
                    <select value={form.incoterm} onChange={(e) => set("incoterm", e.target.value)} className={INPUT_CLS}>
                      {INCOTERMS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Priority">
                    <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className={INPUT_CLS}>
                      {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Expected Dispatch Date" required>
                    <input type="date" value={form.dispatchDate} onChange={(e) => set("dispatchDate", e.target.value)} className={INPUT_CLS} />
                  </Field>
                  <Field label="Declared Value (USD)" required className="sm:col-span-2">
                    <input type="number" value={form.declaredValueUSD} onChange={(e) => set("declaredValueUSD", e.target.value)} placeholder="e.g., 85000" className={INPUT_CLS} />
                  </Field>
                </div>
              </Section>

              <Section title="Notes & Compliance Instructions">
                <div className="flex flex-col gap-4">
                  <Field label="General Notes">
                    <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)}
                      placeholder="Packaging instructions, special handling, temperature requirements, etc."
                      className={INPUT_CLS} />
                  </Field>
                  <Field label="Compliance / Special Instructions">
                    <textarea rows={2} value={form.complianceNotes} onChange={(e) => set("complianceNotes", e.target.value)}
                      placeholder="Sanctions declarations, hazmat classification, country-specific permit references…"
                      className={INPUT_CLS} />
                  </Field>
                </div>
              </Section>
            </>
          )}

          {/* ── Step 3: Compliance Check ── */}
          {step === 3 && preflight && (
            <div className="flex flex-col gap-4">

              {/* Pre-flight summary — computed from form state, no doc needed */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {preflight.validation.isValid && preflight.sanctions.riskLevel === "clear"
                      ? <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      : preflight.sanctions.riskLevel === "critical" || preflight.sanctions.riskLevel === "high"
                      ? <ShieldAlert className="w-4 h-4 text-red-600" />
                      : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                    <span className="text-sm font-semibold text-gray-900">Pre-flight Compliance Check</span>
                  </div>
                  <span className="text-[11px] text-gray-400">Based on your shipment details</span>
                </div>
                <div className="px-5 py-4 grid sm:grid-cols-2 gap-4">

                  {/* Customs readiness */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-700">Customs Readiness</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        preflight.validation.score >= 80 ? "bg-emerald-100 text-emerald-700" :
                        preflight.validation.score >= 60 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {preflight.validation.score}/100
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mb-2 leading-snug">{preflight.validation.summary}</p>
                    {preflight.validation.issues.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {preflight.validation.issues.slice(0, 3).map((issue, i) => (
                          <div key={i} className={`text-[11px] rounded px-2 py-1 ${
                            issue.severity === "error"   ? "bg-red-50 text-red-700" :
                            issue.severity === "warning" ? "bg-amber-50 text-amber-700" :
                            "bg-blue-50 text-blue-600"
                          }`}>
                            {issue.severity === "error" ? "✗" : issue.severity === "warning" ? "⚠" : "ℹ"} {issue.message}
                          </div>
                        ))}
                        {preflight.validation.issues.length > 3 && (
                          <p className="text-[11px] text-gray-400">{preflight.validation.issues.length - 3} more issue(s)</p>
                        )}
                      </div>
                    )}
                    {preflight.validation.issues.length === 0 && (
                      <div className="text-[11px] text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> No readiness issues found
                      </div>
                    )}
                  </div>

                  {/* Sanctions screening */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-700">Sanctions Screening</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        preflight.sanctions.riskLevel === "clear"     ? "bg-emerald-100 text-emerald-700" :
                        preflight.sanctions.riskLevel === "low"      ? "bg-blue-100 text-blue-700" :
                        preflight.sanctions.riskLevel === "medium"   ? "bg-amber-100 text-amber-700" :
                        preflight.sanctions.riskLevel === "high"     ? "bg-orange-100 text-orange-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {preflight.sanctions.riskLevel === "clear" ? "CLEAR" : preflight.sanctions.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    {preflight.sanctions.flags.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {preflight.sanctions.flags.slice(0, 3).map((flag, i) => (
                          <div key={i} className={`text-[11px] rounded px-2 py-1 ${
                            flag.severity === "critical" ? "bg-red-50 text-red-700" :
                            flag.severity === "warning"  ? "bg-amber-50 text-amber-700" :
                            "bg-blue-50 text-blue-600"
                          }`}>
                            {flag.severity === "critical" ? "✗" : "⚠"} {flag.message}
                          </div>
                        ))}
                        {preflight.sanctions.flags.length > 3 && (
                          <p className="text-[11px] text-gray-400">{preflight.sanctions.flags.length - 3} more flag(s)</p>
                        )}
                        <p className="text-[11px] text-gray-600 font-medium mt-1">{preflight.sanctions.recommendation}</p>
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> No sanctions flags detected
                      </div>
                    )}
                  </div>
                </div>

                {/* Call to action */}
                {(!preflight.validation.isValid || preflight.sanctions.riskScore > 0) && (
                  <div className="px-5 py-3 border-t border-gray-100 bg-amber-50/50 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <p className="text-[11px] text-amber-700 leading-snug">
                      Issues detected. Paste your trade documents below so AI can verify and suggest fixes before you proceed.
                    </p>
                  </div>
                )}
                {preflight.validation.isValid && preflight.sanctions.riskScore === 0 && (
                  <div className="px-5 py-3 border-t border-gray-100 bg-emerald-50/50 flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <p className="text-[11px] text-emerald-700 leading-snug">
                      No issues found. You can proceed or optionally verify your documents with AI below.
                    </p>
                  </div>
                )}
              </div>

              {/* AI Document Intelligence — escalation from pre-flight */}
              {preflight.partial && (
                <DocumentIntelligence
                  shipment={preflight.partial}
                  initialExpanded={
                    !preflight.validation.isValid || preflight.sanctions.riskScore > 0
                  }
                />
              )}
            </div>
          )}

          {/* ── Step 4: Review & Create ── */}
          {step === 4 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Review</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
                {[
                  ["Shipper",     form.companyName],
                  ["Contact",     form.contactName],
                  ["Email",       form.email],
                  ["Consignee",   form.consigneeName],
                  ["Origin",      `${form.originCountry} · ${form.originPort}`],
                  ["Destination", `${form.destinationCountry} · ${form.destinationPort}`],
                  ["Cargo",       form.cargoCategory],
                  ["Weight / Vol",`${form.weightKg} kg · ${form.volumeCBM} CBM`],
                  ["Mode",        form.mode],
                  ["Incoterm",    form.incoterm],
                  ["Priority",    form.priority],
                  ["Dispatch",    form.dispatchDate],
                  ["Value",       form.declaredValueUSD ? `$${Number(form.declaredValueUSD).toLocaleString()}` : "—"],
                  ...(fromEstimate ? [["Est. Cost", `$${Number(paramCost).toLocaleString()}`], ["Est. Transit", `${paramDays} days`]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-xs py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-400">{label}</span>
                    <span className="font-medium text-gray-900 text-right max-w-[60%] truncate">{value || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step navigation ── */}
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between pb-8 pt-1">
            <button
              type="button"
              onClick={() => step > 1 ? setStep((s) => s - 1) : router.push("/estimate")}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {step === 1 ? (fromEstimate ? "Back to Estimate" : "Cancel") : "Back"}
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 ? !step1Valid : step === 2 ? !step2Valid : false}
                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-sm"
              >
                {step === 3 ? "Review Shipment" : "Next"} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-sm"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isEditMode ? "Saving…" : "Creating…"}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> {isEditMode ? "Save Changes" : "Create Shipment"}
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

export default function NewShipmentPage() {
  return (
    <Suspense>
      <NewShipmentForm />
    </Suspense>
  );
}
