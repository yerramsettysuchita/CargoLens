"use client";

/**
 * useFxRates — fetches live exchange rates from /api/fx-rates
 * Refreshes every 60 minutes. Falls back to hardcoded rates instantly.
 */

import { useState, useEffect, useRef } from "react";

export type FxRates = Record<string, number>;

const FALLBACK: FxRates = { USD: 1, EUR: 0.92, AED: 3.67, INR: 83.5 };
const REFRESH_MS = 60 * 60 * 1000; // 1 hour

let cachedRates:    FxRates | null = null;
let cachedAt:       number         = 0;
let cachedSource:   string         = "fallback";
let cachedUpdated:  string | null  = null;

export function useFxRates() {
  const [rates,     setRates]     = useState<FxRates>(cachedRates ?? FALLBACK);
  const [source,    setSource]    = useState<string>(cachedSource);
  const [updatedAt, setUpdatedAt] = useState<string | null>(cachedUpdated);
  const [loading,   setLoading]   = useState(!cachedRates);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchRates() {
    try {
      const res = await fetch("/api/fx-rates");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      cachedRates   = data.rates;
      cachedSource  = data.source;
      cachedUpdated = data.updatedAt;
      cachedAt      = Date.now();
      setRates(data.rates);
      setSource(data.source);
      setUpdatedAt(data.updatedAt);
    } catch {
      // keep current rates
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // If cache is fresh, skip fetch
    if (cachedRates && Date.now() - cachedAt < REFRESH_MS) {
      setRates(cachedRates);
      setSource(cachedSource);
      setUpdatedAt(cachedUpdated);
      setLoading(false);
      return;
    }
    fetchRates();
    timerRef.current = setInterval(fetchRates, REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function convert(usd: number, toCurrency: string): string {
    const rate   = rates[toCurrency] ?? 1;
    const sym    = toCurrency === "EUR" ? "€" : toCurrency === "INR" ? "₹" : toCurrency === "AED" ? "AED " : "$";
    const amount = usd * rate;
    if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(2)}M`;
    if (amount >= 1_000)     return `${sym}${(amount / 1_000).toFixed(1)}K`;
    return `${sym}${amount.toFixed(0)}`;
  }

  return { rates, convert, source, updatedAt, loading };
}
