"use client";

/**
 * useTradePulseIntelligence
 * Orchestrates all 7 advanced Trade Pulse features.
 * Runs async data fetches and wires them into a single state object.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Shipment } from "@/app/lib/supabase/shipment-types";
import {
  fetchPortCongestion,
  detectCorridorAnomalies,
  fetchTradeNewsSignals,
  computeETAConfidence,
  buildScoreHistory,
  buildSupplierRiskNodes,
  runWhatIfScenario,
  type PortCongestionData,
  type CorridorAnomaly,
  type NewsSignal,
  type ETAConfidence,
  type CorridorScorePoint,
  type SupplierRiskNode,
  type WhatIfScenario,
} from "@/app/lib/trade-pulse-engine";

const SCORE_HISTORY_KEY = "cargolens_corridor_score_history";
const REFRESH_NEWS_MS   = 5 * 60 * 1000; // 5 min

export interface TradePulseIntelligenceState {
  portCongestion:  PortCongestionData[];
  anomalies:       CorridorAnomaly[];
  newsSignals:     NewsSignal[];
  etaConfidence:   ETAConfidence[];
  scoreHistory:    Record<string, CorridorScorePoint[]>;
  supplierNodes:   SupplierRiskNode[];
  // What-If state
  whatIfScenario:  WhatIfScenario | null;
  setWhatIf:       (corridor: string, delayDays: number) => void;
  clearWhatIf:     () => void;
  // Loading flags
  newsLoading:     boolean;
  congestionLoading: boolean;
}

export function useTradePulseIntelligence(
  shipments:     Shipment[],
  corridorScores: Record<string, number>,
): TradePulseIntelligenceState {
  const [portCongestion,    setPortCongestion]    = useState<PortCongestionData[]>([]);
  const [anomalies,         setAnomalies]          = useState<CorridorAnomaly[]>([]);
  const [newsSignals,       setNewsSignals]         = useState<NewsSignal[]>([]);
  const [etaConfidence,     setEtaConfidence]       = useState<ETAConfidence[]>([]);
  const [scoreHistory,      setScoreHistory]        = useState<Record<string, CorridorScorePoint[]>>({});
  const [supplierNodes,     setSupplierNodes]       = useState<SupplierRiskNode[]>([]);
  const [whatIfScenario,    setWhatIfScenario]      = useState<WhatIfScenario | null>(null);
  const [newsLoading,       setNewsLoading]         = useState(true);
  const [congestionLoading, setCongestionLoading]   = useState(true);
  const newsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load score history from localStorage ──────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCORE_HISTORY_KEY);
      if (raw) setScoreHistory(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // ── Update score history when corridorScores change ───────────────────────
  useEffect(() => {
    if (Object.keys(corridorScores).length === 0) return;
    setScoreHistory((prev) => {
      const updated = buildScoreHistory(prev, corridorScores);
      try { localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, [corridorScores]);

  // ── ETA Confidence (pure computation — instant) ───────────────────────────
  useEffect(() => {
    if (shipments.length === 0) return;
    setEtaConfidence(computeETAConfidence(shipments));
  }, [shipments]);

  // ── Supplier Risk Nodes (pure computation — instant) ─────────────────────
  useEffect(() => {
    if (shipments.length === 0) return;
    setSupplierNodes(buildSupplierRiskNodes(shipments));
  }, [shipments]);

  // ── Port Congestion (async, with refresh) ────────────────────────────────
  useEffect(() => {
    if (shipments.length === 0) return;
    const ports = [...new Set([
      ...shipments.map((s) => s.origin_port),
      ...shipments.map((s) => s.destination_port),
    ])].filter(Boolean) as string[];

    setCongestionLoading(true);
    fetchPortCongestion(ports).then((data) => {
      setPortCongestion(data);
      setCongestionLoading(false);
    });
  }, [shipments]);

  // ── Anomaly Detection (depends on scoreHistory) ───────────────────────────
  useEffect(() => {
    if (Object.keys(corridorScores).length === 0) return;
    const results = detectCorridorAnomalies(corridorScores, scoreHistory);
    setAnomalies(results);
  }, [corridorScores, scoreHistory]);

  // ── News Intelligence (async, refresh every 5 min) ───────────────────────
  const fetchNews = useCallback(async () => {
    if (shipments.length === 0) return;
    setNewsLoading(true);
    const corridors = [...new Set(shipments.map((s) => s.corridor).filter(Boolean))] as string[];
    const signals   = await fetchTradeNewsSignals(corridors, shipments);
    setNewsSignals(signals);
    setNewsLoading(false);
  }, [shipments]);

  useEffect(() => {
    fetchNews();
    newsTimerRef.current = setInterval(fetchNews, REFRESH_NEWS_MS);
    return () => { if (newsTimerRef.current) clearInterval(newsTimerRef.current); };
  }, [fetchNews]);

  // ── What-If Simulator ────────────────────────────────────────────────────
  const setWhatIf = useCallback((corridor: string, delayDays: number) => {
    const currentScore = corridorScores[corridor] ?? 0;
    const result = runWhatIfScenario(corridor, delayDays, shipments, currentScore);
    setWhatIfScenario(result);
  }, [corridorScores, shipments]);

  const clearWhatIf = useCallback(() => setWhatIfScenario(null), []);

  return {
    portCongestion, anomalies, newsSignals, etaConfidence,
    scoreHistory, supplierNodes, whatIfScenario,
    setWhatIf, clearWhatIf,
    newsLoading, congestionLoading,
  };
}
