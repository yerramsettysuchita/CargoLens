// ─── AI Document Compliance Check ────────────────────────────────────────────
// Accepts shipment metadata + raw document text (bill of lading, commercial
// invoice, packing list, certificate of origin, etc.) and calls the Grok API
// to detect trade fraud, sanctions violations, and customs compliance issues.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export interface ComplianceCheckRequest {
  shipmentCode: string;
  corridor: string;
  hsCode: string | null;
  cargoCategory: string;
  declaredValueUSD: number;
  weightKg: number;
  shipperCompany: string;
  consigneeName: string;
  originCountry: string;
  destinationCountry: string;
  documentText: string; // raw pasted text from user documents
}

export interface ComplianceFlag {
  type: "fraud" | "sanctions" | "compliance" | "mismatch" | "info";
  severity: "critical" | "warning" | "info";
  field: string;
  message: string;
}

export interface ComplianceCheckResult {
  overallScore: number;          // 0–100, higher = cleaner
  riskLevel: "clear" | "low" | "medium" | "high" | "critical";
  flags: ComplianceFlag[];
  summary: string;
  recommendation: string;
  detectedDocumentTypes: string[];
  extractedFields: Record<string, string>; // key fields AI extracted from doc text
}

function buildPrompt(req: ComplianceCheckRequest): string {
  return `You are a trade compliance AI specializing in customs clearance, sanctions screening, and trade fraud detection for international shipments.

Analyze the following shipment record and the raw document text provided by the user. Your job is to:
1. Detect any discrepancies between the declared shipment metadata and the document content
2. Identify potential trade fraud indicators (under-valuation, HS code misclassification, dual-use goods, phantom shipments)
3. Flag sanctions violations or restricted party matches (OFAC, UFLPA, CBAM, BIS Entity List, UN Security Council lists)
4. Identify customs compliance issues (missing certificates, incorrect incoterms, incomplete declarations)
5. Extract key fields from the document text

SHIPMENT METADATA:
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

RAW DOCUMENT TEXT:
---
${req.documentText}
---

Respond ONLY with a valid JSON object in exactly this format (no markdown, no explanation outside JSON):
{
  "overallScore": <integer 0-100>,
  "riskLevel": "<clear|low|medium|high|critical>",
  "flags": [
    {
      "type": "<fraud|sanctions|compliance|mismatch|info>",
      "severity": "<critical|warning|info>",
      "field": "<specific field or document section>",
      "message": "<concise description of the issue>"
    }
  ],
  "summary": "<2-3 sentence summary of compliance status>",
  "recommendation": "<single actionable recommendation>",
  "detectedDocumentTypes": ["<e.g. Commercial Invoice>", "<Bill of Lading>"],
  "extractedFields": {
    "<fieldName>": "<extracted value>"
  }
}

Rules:
- overallScore 85-100 = clear, 65-84 = low risk, 45-64 = medium, 25-44 = high, 0-24 = critical
- Flag HS code mismatches between declared category and document description
- Flag if document value differs from declared value by >15%
- Flag if shipper/consignee name matches known sanctioned entity patterns
- Flag UFLPA concern for goods from Xinjiang or involving forced-labor risk sectors (cotton, polysilicon, tomatoes)
- Flag CBAM concern for steel, aluminum, cement, fertilizers, electricity entering EU
- Flag dual-use goods concern for chemicals (HS 28xx), electronics (HS 85xx), optics (HS 90xx) on certain corridors
- If document text is empty or clearly not a trade document, set overallScore to 50 and explain in summary`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured. Add it to .env.local to enable AI compliance analysis." },
      { status: 503 }
    );
  }

  let body: ComplianceCheckRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.documentText?.trim()) {
    return NextResponse.json({ error: "documentText is required" }, { status: 400 });
  }

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          {
            role: "system",
            content: "You are a trade compliance AI. Always respond with valid JSON only — no markdown fences, no explanation text outside the JSON object.",
          },
          {
            role: "user",
            content: buildPrompt(body),
          },
        ],
        temperature: 0.1,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return NextResponse.json(
        { error: `Grok API returned ${response.status}. Check your API key and quota.` },
        { status: 502 }
      );
    }

    const grokResponse = await response.json();
    const rawContent: string = grokResponse.choices?.[0]?.message?.content ?? "{}";

    let result: ComplianceCheckResult;
    try {
      // Strip markdown fences if model added them despite instructions
      const cleaned = rawContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse Grok response:", rawContent);
      return NextResponse.json(
        { error: "AI returned malformed response. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("compliance-check error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
