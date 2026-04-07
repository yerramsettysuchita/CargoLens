"use client";

// ─── RouteMap ─────────────────────────────────────────────────────────────────
// Wrapper that loads RouteMapLeaflet (real satellite map) client-side only.
// Leaflet requires the browser DOM so we must disable SSR.

import dynamic from "next/dynamic";
import type { OptimizedRoute } from "@/app/lib/route-optimizer";

const RouteMapLeaflet = dynamic(() => import("./RouteMapLeaflet"), {
  ssr: false,
  loading: () => (
    <div
      className="rounded-xl border border-slate-200 bg-slate-100 animate-pulse
                 flex items-center justify-center"
      style={{ minHeight: 220 }}
    >
      <span className="text-xs text-slate-400">Loading satellite map…</span>
    </div>
  ),
});

interface Props {
  originPort:      string;
  destPort:        string;
  originLat:       number;
  originLon:       number;
  destLat:         number;
  destLon:         number;
  routes:          OptimizedRoute[];
  selectedRouteId: string;
  onSelectRoute:   (id: string) => void;
  className?:      string;
}

export default function RouteMap(props: Props) {
  return <RouteMapLeaflet {...props} />;
}
