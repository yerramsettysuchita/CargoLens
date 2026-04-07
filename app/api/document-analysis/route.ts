// ─── Multi-Document AI Analysis Route ────────────────────────────────────────
// Accepts shipment metadata + array of parsed document texts.
// Calls Groq to:
//   1. Classify each document (invoice / packing list / BoL / certificate / other)
//   2. Extract structured fields from each
//   3. Cross-compare documents for mismatches
//   4. Flag compliance issues
//   5. Return a final readiness / compliance result

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ─── Request/response types ───────────────────────────────────────────────────

export interface ParsedDocumentInput {
  name:        string;
  text:        string;
  confidence:  "high" | "low" | "failed";
}

export interface DocumentAnalysisRequest {
  shipmentCode:      string;
  corridor:          string;
  hsCode:            string | null;
  cargoCategory:     string;
  declaredValueUSD:  number;
  weightKg:          number;
  shipperCompany:    string;
  consigneeName:     string;
  originCountry:     string;
  destinationCountry: string;
  documents:         ParsedDocumentInput[];
}

export interface ExtractedField {
  field:      string;
  value:      string;
  source:     string;  // document name
  confidence: "high" | "low";
}

export interface CrossDocumentMismatch {
  field:    string;
  issues:   Array<{ doc: string; value: string }>;
  severity: "critical" | "warning";
  message:  string;
}

export interface DocumentSummary {
  name:         string;
  detectedType: string;
  confidence:   string;
  fieldCount:   number;
  issues:       number;
}

export interface DocumentAnalysisResult {
  overallScore:        number;
  riskLevel:           "clear" | "low" | "medium" | "high" | "critical";
  summary:             string;
  recommendation:      string;
  documentSummaries:   DocumentSummary[];
  extractedFields:     ExtractedField[];
  mismatches:          CrossDocumentMismatch[];
  missingDocuments:    string[];
  passedChecks:        string[];
  flags: Array<{
    type:     string;
    severity: "critical" | "warning" | "info";
    field:    string;
    message:  string;
  }>;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(req: DocumentAnalysisRequest): string {
  const docsSection = req.documents
    .map((d, i) => {
      if (d.confidence === "failed" || !d.text.trim()) {
        return `Document ${i + 1}: "${d.name}"
  [TEXT EXTRACTION FAILED — likely a scanned PDF. Treat as missing document.]`;
      }
      return `Document ${i + 1}: "${d.name}" (text confidence: ${d.confidence})
---
${d.text.slice(0, 4000)}
---`;
    })
    .join("\n\n");

  return `You are a trade compliance AI analyzing multiple trade documents for an international shipment.

SHIPMENT METADATA (declared by shipper):
- Shipment Code: ${req.shipmentCode}
- Corridor: ${req.corridor}
- HS Code: ${req.hsCode ?? "Not provided"}
- Cargo Category: ${req.cargoCategory}
- Declared Value: $${req.declaredValueUSD.toLocaleString()} USD
- Weight: ${req.weightKg.toLocaleString()} kg
- Shipper: ${req.shipperCompany}
- Consignee: ${req.consigneeName}
- Origin: ${req.originCountry}
- Destination: ${req.destinationCountry}

UPLOADED DOCUMENTS (${req.documents.length} provided):
${docsSection}

TASKS:
1. Classify each document: Commercial Invoice / Packing List / Bill of Lading / Certificate of Origin / Letter of Credit / Customs Declaration / Other
2. Extract key fields from each: shipper, consignee, invoice_number, bol_number, shipment_date, declared_value, currency, hs_code, quantity, weight, volume, origin, destination, certificate_type
3. Compare extracted fields ACROSS documents — detect mismatches between invoice vs packing list vs BoL
4. Compare extracted fields AGAINST the shipment metadata — flag deviations >15% for value/weight
5. Identify missing critical documents (e.g., no BoL, no invoice)
6. Detect trade compliance issues: fraud indicators, sanctions flags, UFLPA/CBAM concerns, HS code mismatches
7. List what passed cleanly

Respond ONLY with valid JSON in exactly this format (no markdown, no text outside JSON):
{
  "overallScore": <integer 0-100>,
  "riskLevel": "<clear|low|medium|high|critical>",
  "summary": "<2-3 sentence overall compliance summary>",
  "recommendation": "<single most important action>",
  "documentSummaries": [
    {
      "name": "<filename>",
      "detectedType": "<document type>",
      "confidence": "<high|medium|low>",
      "fieldCount": <number of key fields extracted>,
      "issues": <number of issues found in this doc>
    }
  ],
  "extractedFields": [
    {
      "field": "<field name>",
      "value": "<extracted value>",
      "source": "<document name>",
      "confidence": "<high|low>"
    }
  ],
  "mismatches": [
    {
      "field": "<field name>",
      "issues": [{"doc": "<doc name>", "value": "<value found>"}],
      "severity": "<critical|warning>",
      "message": "<explanation of the mismatch>"
    }
  ],
  "missingDocuments": ["<doc type not found but expected>"],
  "passedChecks": ["<description of check that passed>"],
  "flags": [
    {
      "type": "<fraud|sanctions|compliance|mismatch|info>",
      "severity": "<critical|warning|info>",
      "field": "<field>",
      "message": "<concise description>"
    }
  ]
}

Scoring guide: 85-100 = clear, 65-84 = low risk, 45-64 = medium, 25-44 = high, 0-24 = critical.
If a document has failed text extraction, count it as a missing document.
If all documents have failed extraction, set overallScore to 40 and explain in summary.`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured. Add it to .env.local to enable AI document analysis." },
      { status: 503 },
    );
  }

  let body: DocumentAnalysisRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.documents || body.documents.length === 0) {
    return NextResponse.json({ error: "No documents provided" }, { status: 400 });
  }

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          {
            role:    "system",
            content: "You are a trade compliance AI. Always respond with valid JSON only — no markdown fences, no explanation text outside the JSON object.",
          },
          {
            role:    "user",
            content: buildPrompt(body),
          },
        ],
        temperature: 0.1,
        max_tokens:  2500,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq API error:", response.status, err);
      return NextResponse.json(
        { error: `Groq API returned ${response.status}. Check your API key and quota.` },
        { status: 502 },
      );
    }

    const groqResponse = await response.json();
    const rawContent: string = groqResponse.choices?.[0]?.message?.content ?? "{}";

    let result: DocumentAnalysisResult;
    try {
      const cleaned = rawContent
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Groq response:", rawContent);
      return NextResponse.json(
        { error: "AI returned a malformed response. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("document-analysis error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
