import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { handleChat } from "@/app/lib/chat-handler";
import type { Shipment } from "@/app/lib/supabase/shipment-types";
import type { CopilotContext } from "@/app/lib/hooks/useCopilot";
import { buildGraphContext } from "@/app/lib/graph-rag";

export const runtime = "nodejs";

interface ChatRequest {
  message?: string;
  context?: CopilotContext;
}

// Summarise shipment list into compact text for the LLM context window
function buildShipmentContext(shipments: Shipment[]): string {
  if (!shipments.length) return "No shipments found.";

  const delayed   = shipments.filter((s) => s.status === "delayed");
  const customs   = shipments.filter((s) => s.status === "customs_hold");
  const inTransit = shipments.filter((s) => s.status === "in_transit");
  const highRisk  = shipments.filter((s) => s.risk_level === "high" || s.risk_level === "critical");
  const arriving  = shipments.filter((s) => {
    if (!s.eta_date) return false;
    const daysOut = (new Date(s.eta_date).getTime() - Date.now()) / 86_400_000;
    return daysOut >= 0 && daysOut <= 3;
  });

  const lines: string[] = [
    `Total shipments: ${shipments.length}`,
    `In transit: ${inTransit.length}`,
    `Delayed: ${delayed.length}${delayed.length ? " — " + delayed.slice(0, 3).map((s) => `${s.shipment_code} (${s.corridor})`).join(", ") : ""}`,
    `Customs hold: ${customs.length}${customs.length ? " — " + customs.slice(0, 3).map((s) => s.shipment_code).join(", ") : ""}`,
    `High/critical risk: ${highRisk.length}${highRisk.length ? " — " + highRisk.slice(0, 3).map((s) => `${s.shipment_code} (${s.risk_level})`).join(", ") : ""}`,
    `Arriving within 3 days: ${arriving.length}${arriving.length ? " — " + arriving.slice(0, 3).map((s) => s.shipment_code).join(", ") : ""}`,
  ];

  // Include brief per-shipment list (up to 20)
  lines.push("\nSHIPMENT LIST (most recent first):");
  shipments.slice(0, 20).forEach((s) => {
    lines.push(
      `• ${s.shipment_code} | ${s.corridor} | status: ${s.status} | risk: ${s.risk_level} | ETA: ${s.eta_date ?? "unknown"} | cargo: ${s.cargo_category}`,
    );
  });

  return lines.join("\n");
}

async function callGemini(
  message: string,
  shipmentContext: string,
  graphContext: string,
  pageContext?: CopilotContext,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const pageNote = pageContext?.page
    ? `\nThe user is currently viewing: ${pageContext.shipmentCode ? `Shipment ${pageContext.shipmentCode} (ID: ${pageContext.shipmentId})` : pageContext.page}.`
    : "";

  const systemPrompt = `You are a logistics intelligence assistant for CargoLens, an AI-powered global trade control tower.
You have access to a live knowledge graph of shipments, carriers, ports, corridors, regulations, and active disruption alerts.
Use the graph context to answer multi-hop questions — e.g. which carriers are affected by Red Sea disruption, which shipments face UFLPA exposure, what cascading risks exist across corridors.
Answer concisely (3-5 sentences). Use plain text, no markdown. Reference shipment codes when relevant.${pageNote}

FLAT SHIPMENT SUMMARY:
${shipmentContext}

${graphContext}`;

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       "gemini-2.0-flash",
        messages:    [
          { role: "system", content: systemPrompt },
          { role: "user",   content: message },
        ],
        temperature: 0.3,
        max_tokens:  400,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return (data.choices?.[0]?.message?.content as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ChatRequest;
    const { message, context } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    const { data: rows } = await supabase
      .from("shipments")
      .select("*")
      .order("created_at", { ascending: false });

    const shipments = (rows ?? []) as Shipment[];

    // Build Graph-RAG context — multi-hop knowledge graph traversal
    const graphContext = buildGraphContext(shipments, message);

    // Try Groq first for richer contextual answers; fall back to rule-based
    const geminiAnswer = await callGemini(message, buildShipmentContext(shipments), graphContext, context);

    let response;
    if (geminiAnswer) {
      // Groq path — still run rule-based to get shipment refs + meta
      const ruleResult = handleChat(message, shipments);
      response = {
        ...ruleResult,
        answer: geminiAnswer,
      };
    } else {
      // Pure rule-based fallback
      response = handleChat(message, shipments);
    }

    if (user) {
      void supabase.from("chat_logs").insert({
        user_id: user.id,
        message:  message.slice(0, 500),
        intent:   response.intent,
        answer:   response.answer.slice(0, 1000),
      });
    }

    return NextResponse.json(response);
  } catch (e) {
    console.error("[/api/chat]", e);
    return NextResponse.json({ error: "Chat request failed" }, { status: 500 });
  }
}
