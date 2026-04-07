"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Percent,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Info,
  BarChart3,
} from "lucide-react";
import { Navbar } from "@/app/components/Navbar";
import { Badge } from "@/app/components/ui/Badge";
import { tariffScenarios, currencies, convertCurrency } from "@/app/lib/seed-data";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

const HS_CODE_OPTIONS = [
  { code: "5208.21", label: "5208.21 — Woven Cotton Fabric (India→EU)" },
  { code: "6205.20", label: "6205.20 — Men's Cotton Shirts (India→US)" },
  { code: "6204.62", label: "6204.62 — Women's Apparel (India→UK)" },
  { code: "2941.10", label: "2941.10 — Pharmaceutical API (India→US)" },
  { code: "8471.30", label: "8471.30 — Consumer Electronics (UAE→Africa)" },
  { code: "8542.31", label: "8542.31 — Semiconductor ICs (Singapore→EU)" },
];

const DESTINATION_OPTIONS = [
  { code: "NL", label: "Netherlands (EU) — India→EU corridor" },
  { code: "DE", label: "Germany (EU) — SE Asia→EU corridor" },
  { code: "US", label: "United States — India→US / UAE→US" },
  { code: "GB", label: "United Kingdom — India→UK DCTS" },
  { code: "KE", label: "Kenya — UAE→East Africa corridor" },
];

const BASE_TARIFFS: Record<string, Record<string, number>> = {
  "5208.21": { NL: 12, DE: 12, US: 11.4, GB: 12, KE: 25 },
  "6205.20": { NL: 12, DE: 12, US: 15,   GB: 12, KE: 35 },
  "6204.62": { NL: 12, DE: 12, US: 15,   GB: 0,  KE: 35 },
  "2941.10": { NL: 0,  DE: 0,  US: 0,    GB: 0,  KE: 0  },
  "8471.30": { NL: 0,  DE: 0,  US: 3.4,  GB: 0,  KE: 25 },
  "8542.31": { NL: 0,  DE: 0,  US: 0,    GB: 0,  KE: 25 },
};

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 shadow-lg px-3 py-2 rounded-lg text-xs">
        <div className="text-gray-500 mb-1">{label}</div>
        <div className="text-gray-900 font-bold">${payload[0].value.toLocaleString()}</div>
      </div>
    );
  }
  return null;
}

function TariffSimulatorContent() {
  const params = useSearchParams();

  // Pre-fill from shipment: ?hs=2941.10&value=285000&dest=USA
  const initHS = (() => {
    const hs = params.get("hs");
    if (hs && HS_CODE_OPTIONS.some((o) => o.code === hs)) return hs;
    return "5208.21";
  })();
  const initDest = (() => {
    const dest = params.get("dest");
    if (!dest) return "NL";
    const map: Record<string, string> = {
      "netherlands": "NL", "germany": "NL", "usa": "US", "united states": "US",
      "uk": "GB", "united kingdom": "GB", "kenya": "KE",
    };
    return map[dest.toLowerCase()] ?? "NL";
  })();
  const initValue = (() => {
    const v = Number(params.get("value"));
    return v > 0 ? v : 142000;
  })();

  const [selectedHS, setSelectedHS] = useState(initHS);
  const [selectedDest, setSelectedDest] = useState(initDest);
  const [cargoValue, setCargoValue] = useState(initValue);
  const [newRate, setNewRate] = useState<number | "">("");
  const [simulated, setSimulated] = useState(false);
  const [currency, setCurrency] = useState("USD");

  const baseRate = BASE_TARIFFS[selectedHS]?.[selectedDest] ?? 12;
  const effectiveNewRate = typeof newRate === "number" ? newRate : baseRate * 1.5;

  const baseDuty = (cargoValue * baseRate) / 100;
  const newDuty = (cargoValue * effectiveNewRate) / 100;
  const delta = newDuty - baseDuty;
  const deltaPercent = ((delta / cargoValue) * 100).toFixed(1);
  const isIncrease = delta > 0;

  const chartData = [
    { name: "Base Duty", value: Math.round(baseDuty) },
    { name: "New Duty", value: Math.round(newDuty) },
    { name: "Δ Impact", value: Math.round(Math.abs(delta)) },
  ];

  const DEST_COUNTRY_MAP: Record<string, string> = {
    NL: "Netherlands (EU)", DE: "Netherlands (EU)", US: "USA", GB: "UK", KE: "Kenya",
  };
  const scenario = tariffScenarios.find(
    (s) => s.hsCode === selectedHS && s.destinationCountry === DEST_COUNTRY_MAP[selectedDest]
  );

  const fromShipment = !!(params.get("hs") || params.get("value"));

  const inputCls =
    "w-full px-3 py-2 rounded-lg text-sm border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-2">
        <div className="max-w-5xl mx-auto flex items-center gap-3 text-xs text-gray-400">
          <Link href="/estimate" className="hover:text-blue-700 transition-colors font-medium">Estimate</Link>
          <span>·</span>
          <Link href="/dashboard" className="hover:text-blue-700 transition-colors font-medium">Dashboard</Link>
          <span>·</span>
          <span className="text-gray-700 font-medium">Tariff Simulator</span>
          <span className="ml-auto text-[10px] text-gray-300">Standalone tool for tariff impact modelling</span>
        </div>
      </div>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Percent className="w-6 h-6 text-amber-500" />
            Global Tariff Impact Simulator
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Model the cost impact of trade policy changes across key corridors, from US Section 301 levies to EU CBAM and UK DCTS adjustments. Results display in USD, EUR, AED, and INR.
          </p>
          {fromShipment && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-fit">
              <Percent className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              Pre-filled from your shipment. You can adjust any values below.
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-5 gap-5">
          {/* Controls — 2/5 */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Simulation Parameters</h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">HS Code</label>
                  <select
                    value={selectedHS}
                    onChange={(e) => { setSelectedHS(e.target.value); setSimulated(false); }}
                    className={inputCls}
                  >
                    {HS_CODE_OPTIONS.map((o) => (
                      <option key={o.code} value={o.code}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Destination Market</label>
                  <select
                    value={selectedDest}
                    onChange={(e) => { setSelectedDest(e.target.value); setSimulated(false); }}
                    className={inputCls}
                  >
                    {DESTINATION_OPTIONS.map((o) => (
                      <option key={o.code} value={o.code}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Cargo Value (USD)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="number"
                      value={cargoValue}
                      onChange={(e) => { setCargoValue(Number(e.target.value)); setSimulated(false); }}
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-xs text-blue-800">
                    Current MFN rate for {selectedHS} → {selectedDest}:{" "}
                    <span className="font-bold">{baseRate}%</span>
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Simulated New Rate (%)
                    <span className="ml-1 text-gray-400 font-normal">for your tariff shock scenario</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={0.5}
                    value={newRate}
                    placeholder={`e.g. ${(baseRate * 1.5).toFixed(1)}`}
                    onChange={(e) => {
                      setNewRate(e.target.value === "" ? "" : Number(e.target.value));
                      setSimulated(false);
                    }}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Output Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className={inputCls}
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setSimulated(true)}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-lg transition-colors text-sm shadow-sm"
                >
                  <BarChart3 className="w-4 h-4" /> Run Simulation
                </button>
              </div>
            </div>

            {/* Pre-built scenarios */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Pre-built Scenarios
              </h3>
              <div className="flex flex-col gap-2">
                {tariffScenarios.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedHS(s.hsCode);
                      setNewRate(s.newRatePercent);
                      setCargoValue(s.cargoValueUSD);
                      setSimulated(true);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all"
                  >
                    <div className="text-xs font-semibold text-gray-800 leading-snug">{s.name}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {s.hsCode} · {s.destinationCountry} · {s.baseRatePercent}% → {s.newRatePercent}%
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results — 3/5 */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Impact summary */}
            <div
              className={`bg-white rounded-xl border shadow-sm p-5 ${
                simulated && isIncrease ? "border-orange-200" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Impact Analysis</h2>
                {simulated && (
                  <Badge
                    label={isIncrease ? `+${deltaPercent}% additional duty` : `${deltaPercent}% savings`}
                    variant={isIncrease ? (Math.abs(Number(deltaPercent)) > 10 ? "critical" : "high") : "success"}
                    dot
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  {
                    label: "Base Duty",
                    value: convertCurrency(Math.round(baseDuty), currency),
                    sub: `@ ${baseRate}%`,
                    cls: "text-gray-800",
                  },
                  {
                    label: "New Duty",
                    value: convertCurrency(Math.round(newDuty), currency),
                    sub: `@ ${effectiveNewRate.toFixed(1)}%`,
                    cls: isIncrease ? "text-orange-600" : "text-emerald-600",
                  },
                  {
                    label: "Delta",
                    value: `${isIncrease ? "+" : ""}${convertCurrency(Math.round(isIncrease ? delta : -delta), currency)}`,
                    sub: `${deltaPercent}% of cargo`,
                    cls: isIncrease ? "text-orange-600 font-bold" : "text-emerald-600 font-bold",
                  },
                ].map(({ label, value, sub, cls }) => (
                  <div key={label} className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                    <div className="text-[11px] text-gray-400 mb-1">{label}</div>
                    <div className={`text-lg font-bold ${cls}`}>{value}</div>
                    <div className="text-[11px] text-gray-400">{sub}</div>
                  </div>
                ))}
              </div>

              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#6B7280", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#6B7280", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            index === 0
                              ? "#3B82F6"
                              : index === 1
                              ? isIncrease ? "#F97316" : "#10B981"
                              : "#EF4444"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recommendation */}
            {simulated && (
              <div
                className={`rounded-xl border p-5 ${
                  isIncrease
                    ? "bg-orange-50 border-orange-200"
                    : "bg-emerald-50 border-emerald-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isIncrease ? "bg-orange-100" : "bg-emerald-100"
                    }`}
                  >
                    {isIncrease ? (
                      <AlertTriangle className="w-4 h-4 text-orange-600" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <h3
                      className={`text-sm font-semibold mb-2 ${
                        isIncrease ? "text-orange-900" : "text-emerald-900"
                      }`}
                    >
                      {isIncrease
                        ? "Action required. Duty impact is significant."
                        : "Opportunity identified. Favorable tariff conditions apply."}
                    </h3>
                    <p className="text-xs text-gray-700 leading-relaxed mb-3">
                      {scenario?.recommendation ??
                        (isIncrease
                          ? `A ${deltaPercent}% tariff increase will add $${Math.round(delta).toLocaleString()} to landed cost. Consider renegotiating buyer price terms, exploring GSP/FTA eligibility, or rerouting via an intermediate country.`
                          : `This tariff scenario is favorable. You save $${Math.round(Math.abs(delta)).toLocaleString()} in duties. Ensure your origin certificates are filed correctly to claim the preferential rate.`)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {isIncrease ? (
                        <>
                          <span className="text-[11px] font-medium text-orange-700 bg-orange-100 border border-orange-200 px-2 py-1 rounded">Renegotiate buyer contract</span>
                          <span className="text-[11px] font-medium text-orange-700 bg-orange-100 border border-orange-200 px-2 py-1 rounded">Check FTA eligibility</span>
                          <span className="text-[11px] font-medium text-orange-700 bg-orange-100 border border-orange-200 px-2 py-1 rounded">Explore transshipment</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded">File origin certificate</span>
                          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded">Increase volume allocation</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scenario table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-900">Live Trade Policy Scenarios Across Global Corridors</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 font-medium">Scenario</th>
                      <th className="text-left px-4 py-3 font-medium">Market</th>
                      <th className="text-left px-4 py-3 font-medium">Rate Change</th>
                      <th className="text-left px-4 py-3 font-medium">Duty Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tariffScenarios.map((s) => {
                      const inc = s.additionalDutyUSD > 0;
                      return (
                        <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-gray-800 leading-snug">{s.name}</div>
                            <div className="text-gray-400 mt-0.5">{s.hsCode}</div>
                          </td>
                          <td className="px-4 py-3.5 text-gray-600">{s.destinationCountry}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1">
                              {inc ? (
                                <TrendingUp className="w-3 h-3 text-orange-500" />
                              ) : (
                                <TrendingDown className="w-3 h-3 text-emerald-500" />
                              )}
                              <span className={inc ? "text-orange-600 font-medium" : "text-emerald-600 font-medium"}>
                                {s.baseRatePercent}% → {s.newRatePercent}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`font-bold ${inc ? "text-orange-600" : "text-emerald-600"}`}>
                              {inc ? "+" : ""}${s.additionalDutyUSD.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function TariffSimulatorPage() {
  return (
    <Suspense>
      <TariffSimulatorContent />
    </Suspense>
  );
}
