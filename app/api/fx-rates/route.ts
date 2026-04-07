/**
 * /api/fx-rates
 * Fetches live exchange rates from open.er-api.com (free, no API key).
 * Caches for 1 hour server-side using Next.js fetch cache.
 * Falls back to hardcoded rates if the API is unavailable.
 */

import { NextResponse } from "next/server";

const FALLBACK: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  AED: 3.67,
  INR: 83.5,
};

export const revalidate = 3600; // ISR — revalidate every hour

export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error("FX API unavailable");

    const data = await res.json();

    if (data.result !== "success" || !data.rates) {
      throw new Error("Invalid FX response");
    }

    const rates: Record<string, number> = {
      USD: 1,
      EUR: data.rates.EUR ?? FALLBACK.EUR,
      AED: data.rates.AED ?? FALLBACK.AED,
      INR: data.rates.INR ?? FALLBACK.INR,
    };

    return NextResponse.json({
      rates,
      updatedAt: data.time_last_update_utc ?? new Date().toISOString(),
      source: "live",
    });
  } catch {
    return NextResponse.json({
      rates: FALLBACK,
      updatedAt: null,
      source: "fallback",
    });
  }
}
