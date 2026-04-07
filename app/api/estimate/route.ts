import { NextRequest, NextResponse } from "next/server";
import { runEstimation, type EstimationInput } from "@/app/lib/estimation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input: EstimationInput = {
      originCountry: body.originCountry ?? "",
      destinationCountry: body.destinationCountry ?? "",
      weightKg: Number(body.weightKg) || 1000,
      volumeCBM: Number(body.volumeCBM) || 10,
      modePreference: body.modePreference ?? "any",
      priority: body.priority ?? "balanced",
    };

    if (!input.originCountry || !input.destinationCountry) {
      return NextResponse.json({ error: "originCountry and destinationCountry are required" }, { status: 400 });
    }

    const result = runEstimation(input);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Estimation failed" }, { status: 500 });
  }
}
