"use client";

// ─── Document Intelligence Panel ──────────────────────────────────────────────
// Two-phase compliance workflow:
//
//  Phase 1 — Pre-flight (always visible):
//    Rules-based validation from shipment form data only.
//    Clearly labeled "Based on shipment details only" until docs are processed.
//
//  Phase 2 — Document Intelligence (multi-file upload + AI analysis):
//    - Upload 1–6 PDFs or text files (up to 15 MB each)
//    - Server extracts text via /api/parse-documents (Node.js zlib FlateDecode)
//    - AI classifies each document, extracts fields, cross-compares, flags issues
//    - Final readiness result replaces the preliminary score

import { useCallback, useRef, useState } from "react";
import {
  FileSearch,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Upload,
  X,
  FileText,
  File,
  AlertCircle,
  Check,
} from "lucide-react";
import { validateShipment } from "@/app/lib/document-validation";
import type { Shipment } from "@/app/lib/supabase/shipment-types";
import type { DocumentAnalysisResult } from "@/app/api/document-analysis/route";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadedFile {
  id:   string;
  file: File;
}

interface ParsedFile {
  name:        string;
  size:        number;
  text:        string;
  confidence:  "high" | "low" | "failed";
  error?:      string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  shipment:         Shipment;
  initialExpanded?: boolean;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  warning:  "bg-amber-100 text-amber-700 border-amber-200",
  info:     "bg-blue-50 text-blue-700 border-blue-100",
};

const RISK_BADGE: Record<string, string> = {
  clear:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  low:      "bg-blue-100 text-blue-700 border-blue-200",
  medium:   "bg-amber-100 text-amber-700 border-amber-200",
  high:     "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const SCORE_COLOR = (score: number) =>
  score >= 85 ? "text-emerald-700" :
  score >= 65 ? "text-blue-700" :
  score >= 45 ? "text-amber-700" :
  score >= 25 ? "text-orange-700" : "text-red-700";

const CONF_BADGE: Record<string, string> = {
  high:   "bg-emerald-100 text-emerald-700",
  low:    "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

function fmtBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const MAX_FILES      = 6;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES  = ["application/pdf", "text/plain"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentIntelligence({ shipment, initialExpanded = false }: Props) {
  const [expanded,       setExpanded]      = useState(initialExpanded);
  const [uploadedFiles,  setUploadedFiles] = useState<UploadedFile[]>([]);
  const [parsedFiles,    setParsedFiles]   = useState<ParsedFile[]>([]);
  const [result,         setResult]        = useState<DocumentAnalysisResult | null>(null);
  const [parseLoading,   setParseLoading]  = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [error,          setError]         = useState<string | null>(null);
  const [dragOver,       setDragOver]      = useState(false);
  const [expandedDocs,   setExpandedDocs]  = useState<Set<number>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-flight result (rules-based, always computed from shipment data)
  const preflight = validateShipment(shipment);

  // ── File management ──────────────────────────────────────────────────────

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    const valid: UploadedFile[] = [];
    const errors: string[]      = [];

    for (const f of arr) {
      if (!ALLOWED_TYPES.includes(f.type) && !f.name.endsWith(".pdf") && !f.name.endsWith(".txt")) {
        errors.push(`${f.name}: only PDF and TXT files are supported`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        errors.push(`${f.name}: file too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)`);
        continue;
      }
      valid.push({ id: `${f.name}-${f.size}-${Date.now()}`, file: f });
    }

    setUploadedFiles((prev) => {
      const combined = [...prev, ...valid].slice(0, MAX_FILES);
      return combined;
    });

    if (errors.length > 0) {
      setError(errors.join("\n"));
    } else {
      setError(null);
    }

    // Reset previous analysis when files change
    setParsedFiles([]);
    setResult(null);
  }

  function removeFile(id: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    setParsedFiles([]);
    setResult(null);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 1: Parse documents ──────────────────────────────────────────────

  async function parseDocuments() {
    if (uploadedFiles.length === 0) return;
    setParseLoading(true);
    setError(null);
    setParsedFiles([]);
    setResult(null);

    const formData = new FormData();
    for (const uf of uploadedFiles) formData.append("files", uf.file);

    try {
      const res  = await fetch("/api/parse-documents", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Parse failed. Please try again.");
        return;
      }

      setParsedFiles(data.files as ParsedFile[]);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setParseLoading(false);
    }
  }

  // ── Step 2: AI analysis ──────────────────────────────────────────────────

  async function analyzeDocuments() {
    if (parsedFiles.length === 0) return;
    setAnalyzeLoading(true);
    setError(null);
    setResult(null);

    const payload = {
      shipmentCode:       shipment.shipment_code,
      corridor:           shipment.corridor,
      hsCode:             shipment.hs_code,
      cargoCategory:      shipment.cargo_category,
      declaredValueUSD:   shipment.declared_value ?? 0,
      weightKg:           shipment.weight ?? 0,
      shipperCompany:     shipment.shipper_company,
      consigneeName:      shipment.consignee_name ?? "",
      originCountry:      shipment.origin_country,
      destinationCountry: shipment.destination_country,
      documents:          parsedFiles.map((f) => ({
        name:       f.name,
        text:       f.text,
        confidence: f.confidence,
      })),
    };

    try {
      const res  = await fetch("/api/document-analysis", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Analysis failed. Please try again.");
        return;
      }

      setResult(data as DocumentAnalysisResult);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setAnalyzeLoading(false);
    }
  }

  const canAnalyze = parsedFiles.length > 0 && parsedFiles.some((f) => f.confidence !== "failed");

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">AI Document Intelligence</div>
            <div className="text-[11px] text-gray-400">
              {result
                ? `${result.documentSummaries?.length ?? 0} docs analysed · Score ${result.overallScore}/100 · ${result.riskLevel.toUpperCase()}`
                : parsedFiles.length > 0
                ? `${parsedFiles.length} file${parsedFiles.length > 1 ? "s" : ""} parsed and ready to analyze`
                : "Upload BoL, invoice, packing list for AI compliance analysis"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${RISK_BADGE[result.riskLevel] ?? RISK_BADGE.medium}`}>
              {result.riskLevel.toUpperCase()}
            </span>
          )}
          {expanded
            ? <ChevronUp  className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">

          {/* ── PHASE 1: Pre-flight ── */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-gray-600">1</span>
              </div>
              <span className="text-xs font-semibold text-gray-700">Pre-flight Check</span>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-medium">
                Based on shipment details only
              </span>
              <span className={`ml-auto text-sm font-bold tabular-nums ${SCORE_COLOR(preflight.score)}`}>
                {preflight.score}<span className="text-[11px] font-normal text-gray-400">/100</span>
              </span>
            </div>

            <p className="text-[11px] text-gray-600 mb-2 leading-relaxed">{preflight.summary}</p>

            {preflight.issues.length > 0 ? (
              <div className="flex flex-col gap-1">
                {preflight.issues.map((issue, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-[11px] rounded-lg px-3 py-2 border ${
                      issue.severity === "error"   ? SEVERITY_STYLES.critical :
                      issue.severity === "warning" ? SEVERITY_STYLES.warning  : SEVERITY_STYLES.info
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span><span className="font-semibold">{issue.field}: </span>{issue.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                All shipment fields look complete and well-formed.
              </div>
            )}

            {!result && (
              <p className="text-[10px] text-gray-400 mt-2 italic">
                ⚠ This score is based on form data only. Upload documents below for a verified compliance result.
              </p>
            )}
          </div>

          {/* ── PHASE 2: Document Upload ── */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-gray-600">2</span>
              </div>
              <span className="text-xs font-semibold text-gray-700">Document Intelligence</span>
              <span className="text-[10px] text-gray-400 font-medium ml-1">
                PDF or TXT · up to {MAX_FILES} files · {MAX_FILE_BYTES / 1024 / 1024} MB each
              </span>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-colors mb-3 ${
                dragOver
                  ? "border-violet-400 bg-violet-50"
                  : "border-gray-200 hover:border-violet-300 hover:bg-gray-50"
              }`}
            >
              <Upload className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-600">
                Drop PDFs here or <span className="text-violet-600 underline">click to browse</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Commercial Invoice · Packing List · Bill of Lading · Certificate of Origin
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,application/pdf,text/plain"
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>

            {/* Uploaded file list */}
            {uploadedFiles.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-3">
                {uploadedFiles.map((uf) => {
                  const isPdf = uf.file.name.endsWith(".pdf") || uf.file.type === "application/pdf";
                  return (
                    <div key={uf.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      {isPdf
                        ? <FileText className="w-4 h-4 text-red-400 shrink-0" />
                        : <File     className="w-4 h-4 text-blue-400 shrink-0" />}
                      <span className="text-xs font-medium text-gray-800 flex-1 truncate">{uf.file.name}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">{fmtBytes(uf.file.size)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(uf.id); }}
                        className="ml-1 p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-[11px] text-red-700 flex items-start gap-2 mb-3 whitespace-pre-line">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Parse button */}
            {uploadedFiles.length > 0 && parsedFiles.length === 0 && !parseLoading && (
              <button
                onClick={parseDocuments}
                disabled={parseLoading}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                Extract Text from {uploadedFiles.length} File{uploadedFiles.length > 1 ? "s" : ""}
              </button>
            )}

            {parseLoading && (
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                Extracting text from PDFs…
              </div>
            )}
          </div>

          {/* ── Parsed files results ── */}
          {parsedFiles.length > 0 && (
            <div className="px-5 py-4">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Extracted Documents
              </div>
              <div className="flex flex-col gap-1.5 mb-3">
                {parsedFiles.map((f, i) => {
                  const isOpen = expandedDocs.has(i);
                  return (
                    <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50">
                        <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-xs font-medium text-gray-800 flex-1 truncate">{f.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${CONF_BADGE[f.confidence]}`}>
                          {f.confidence === "failed" ? "scan/failed" : f.confidence + " conf"}
                        </span>
                        {f.text && (
                          <button
                            onClick={() => setExpandedDocs((prev) => {
                              const next = new Set(prev);
                              isOpen ? next.delete(i) : next.add(i);
                              return next;
                            })}
                            className="text-[10px] text-gray-400 hover:text-gray-700 ml-1"
                          >
                            {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                      {f.error && (
                        <div className="px-3 py-2 text-[11px] text-amber-700 bg-amber-50 border-t border-amber-100">
                          {f.error}
                        </div>
                      )}
                      {isOpen && f.text && (
                        <div className="px-3 py-2 border-t border-gray-100 bg-white">
                          <pre className="text-[10px] text-gray-600 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                            {f.text.slice(0, 1500)}{f.text.length > 1500 ? "…" : ""}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Analyze button */}
              {!result && (
                <button
                  onClick={analyzeDocuments}
                  disabled={analyzeLoading || !canAnalyze}
                  className="w-full flex items-center justify-center gap-2 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  {analyzeLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Running AI Cross-Document Analysis…</>
                  ) : (
                    <><Sparkles className="w-4 h-4" />Analyze {parsedFiles.filter(f => f.confidence !== "failed").length} Document{parsedFiles.filter(f => f.confidence !== "failed").length !== 1 ? "s" : ""} with AI</>
                  )}
                </button>
              )}
              {!canAnalyze && parsedFiles.length > 0 && (
                <p className="text-[10px] text-red-600 mt-1.5 text-center">
                  All documents failed text extraction so we cannot proceed with analysis. Please upload digital text-based PDFs.
                </p>
              )}
            </div>
          )}

          {/* ── PHASE 2 RESULTS ── */}
          {result && (
            <div className="px-5 py-4 flex flex-col gap-4">

              {/* Overall score */}
              <div className={`rounded-xl border p-4 ${
                result.riskLevel === "critical" ? "bg-red-50 border-red-200" :
                result.riskLevel === "high"     ? "bg-orange-50 border-orange-200" :
                result.riskLevel === "medium"   ? "bg-amber-50 border-amber-200" :
                result.riskLevel === "low"      ? "bg-blue-50 border-blue-200" :
                "bg-emerald-50 border-emerald-200"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {(result.riskLevel === "clear" || result.riskLevel === "low")
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      : <ShieldAlert  className="w-4 h-4 text-red-600" />}
                    <span className="text-sm font-semibold text-gray-900">Document Compliance Score</span>
                    <span className="text-[10px] text-gray-500">(AI-verified)</span>
                  </div>
                  <span className={`text-2xl font-bold ${SCORE_COLOR(result.overallScore)}`}>
                    {result.overallScore}
                    <span className="text-sm font-normal text-gray-400">/100</span>
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed mb-2">{result.summary}</p>
              </div>

              {/* Document summaries */}
              {result.documentSummaries?.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Detected Documents
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {result.documentSummaries.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span className="text-xs font-medium text-gray-800 flex-1 truncate">{d.name}</span>
                        <span className="text-[10px] text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded font-semibold shrink-0">
                          {d.detectedType}
                        </span>
                        {d.issues > 0 && (
                          <span className="text-[10px] text-red-600 font-semibold">{d.issues} issue{d.issues > 1 ? "s" : ""}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing documents */}
              {result.missingDocuments?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <div className="text-[10px] font-semibold text-red-700 uppercase tracking-wider mb-1">
                    Missing Documents
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.missingDocuments.map((d, i) => (
                      <span key={i} className="text-[11px] font-medium text-red-700 bg-white border border-red-200 px-2 py-0.5 rounded-full">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cross-document mismatches */}
              {result.mismatches?.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Cross-Document Mismatches
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {result.mismatches.map((m, i) => (
                      <div
                        key={i}
                        className={`rounded-lg px-3 py-2.5 border text-[11px] ${
                          m.severity === "critical" ? SEVERITY_STYLES.critical : SEVERITY_STYLES.warning
                        }`}
                      >
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">{m.field}: </span>
                            {m.message}
                            {m.issues?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {m.issues.map((issue, j) => (
                                  <span key={j} className="bg-white/70 border border-current/20 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                    {issue.doc}: <span className="font-bold">{issue.value}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compliance flags */}
              {result.flags?.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Compliance Flags · {result.flags.length} found
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {result.flags.map((f, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 text-[11px] rounded-lg px-3 py-2 border ${SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.info}`}
                      >
                        {f.severity === "critical" ? <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" />
                          : f.severity === "warning" ? <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          : <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />}
                        <div>
                          <span className="font-semibold">{f.field}: </span>
                          {f.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Passed checks */}
              {result.passedChecks?.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Passed Checks
                  </div>
                  <div className="flex flex-col gap-1">
                    {result.passedChecks.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] text-emerald-700">
                        <Check className="w-3 h-3 shrink-0 text-emerald-500" />
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted fields */}
              {result.extractedFields?.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Key Extracted Fields
                  </div>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    {result.extractedFields.slice(0, 20).map((f, i) => (
                      <div
                        key={i}
                        className="flex gap-3 px-3 py-1.5 text-[11px] border-b border-gray-50 last:border-0 bg-white"
                      >
                        <span className="text-gray-400 w-28 shrink-0 truncate">{f.field}</span>
                        <span className="text-gray-800 font-medium flex-1">{f.value}</span>
                        <span className="text-[10px] text-gray-300 shrink-0 truncate max-w-24">{f.source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendation */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                <p className="text-[10px] font-semibold text-violet-800 uppercase tracking-wider mb-1">
                  Recommended Action
                </p>
                <p className="text-[11px] text-violet-900 leading-relaxed">{result.recommendation}</p>
              </div>

              {/* Re-analyze button */}
              <button
                onClick={() => { setResult(null); setParsedFiles([]); setUploadedFiles([]); }}
                className="text-[11px] text-gray-400 hover:text-gray-700 font-medium text-center"
              >
                ← Upload different documents
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
