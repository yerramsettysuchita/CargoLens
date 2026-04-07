"use client";

// ─── RouteMapLeaflet ───────────────────────────────────────────────────────────
// Real satellite map (ESRI, no API key) with genuine per-mode route paths.
//   Sea routes   → shipping lanes through Suez / Cape / Malacca / Panama
//   Air routes   → great-circle geodesic path
//   Rail routes  → BRI / Trans-Siberian waypoints
// Loaded client-side only (dynamic ssr:false in RouteMap.tsx wrapper).

import { useEffect } from "react";
import {
  MapContainer, TileLayer,
  Polyline, CircleMarker, Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { OptimizedRoute, RouteWaypoint } from "@/app/lib/route-optimizer";

// ── Tile layers (ESRI, completely free, no key) ───────────────────────────────
const SATELLITE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABELS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

// ── Per-route colours ─────────────────────────────────────────────────────────
const ROUTE_COLORS: Record<string, string> = {
  sea_standard: "#38bdf8",
  sea_alt:      "#818cf8",
  air_express:  "#fb923c",
  rail:         "#4ade80",
  multimodal:   "#f472b6",
};
const FALLBACK_COLOR = "#94a3b8";

// ── Key navigational choke-points ─────────────────────────────────────────────
const NAV = {
  malacca:     [4.0,   100.5] as [number, number],
  hormuz:      [26.0,   57.0] as [number, number],
  aden:        [11.8,   43.7] as [number, number],
  bab:         [12.6,   43.3] as [number, number],
  suez_s:      [29.9,   32.6] as [number, number],
  suez_n:      [31.3,   32.3] as [number, number],
  med_e:       [34.0,   24.0] as [number, number],
  med_mid:     [36.5,   14.0] as [number, number],
  gibraltar:   [35.9,   -5.4] as [number, number],
  n_atlantic:  [38.0,  -25.0] as [number, number],
  cape:        [-34.4,  18.5] as [number, number],
  s_atl:       [-15.0,  -5.0] as [number, number],
  panama_a:    [9.4,   -79.9] as [number, number],
  panama_p:    [8.9,   -79.5] as [number, number],
};

// BRI rail corridor waypoints (China → Europe)
const BRI_WPS: [number, number][] = [
  [34.7, 112.0],  // Zhengzhou / Yiwu (China)
  [44.2,  80.1],  // Khorgos border crossing
  [43.3,  76.9],  // Almaty
  [41.3,  69.3],  // Tashkent
  [48.0,  46.0],  // Volgograd corridor
  [55.7,  37.6],  // Moscow
  [52.5,  21.0],  // Warsaw
];

// ── Great-circle slerp ────────────────────────────────────────────────────────
function toRad(d: number) { return (d * Math.PI) / 180; }
function toDeg(r: number) { return (r * 180) / Math.PI; }

function gcPoints(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  steps = 60,
): [number, number][] {
  // Normalise longitude delta to [-180, 180] to choose shorter arc
  let lon2adj = lon2;
  const dLon = lon2 - lon1;
  if (dLon >  180) lon2adj = lon2 - 360;
  if (dLon < -180) lon2adj = lon2 + 360;

  const φ1 = toRad(lat1), λ1 = toRad(lon1);
  const φ2 = toRad(lat2), λ2 = toRad(lon2adj);

  const Δσ = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
  ));

  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (Δσ < 1e-6) {
      pts.push([lat1 + t * (lat2 - lat1), lon1 + t * (lon2adj - lon1)]);
      continue;
    }
    const A = Math.sin((1 - t) * Δσ) / Math.sin(Δσ);
    const B = Math.sin(t * Δσ) / Math.sin(Δσ);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1)                 + B * Math.sin(φ2);
    pts.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }
  return pts;
}

// ── Sea route path ─────────────────────────────────────────────────────────────
function buildSeaPath(
  o: [number, number],
  d: [number, number],
  viaStr: string,
  waypoints: RouteWaypoint[],
): [number, number][] {
  const [oLat, oLon] = o;
  const [dLat, dLon] = d;
  const lower = viaStr.toLowerCase();
  const useCape = lower.includes("cape");

  const oInAsia    = oLon >= 95 && oLon <= 145;
  const oInIndian  = oLon >= 40 && oLon <= 100;
  const dToEurope  = dLon < 30 && dLat > 35;
  const dToNAEast  = dLon >= -105 && dLon < -60 && dLat > 18;
  const dToNAWest  = dLon < -110;
  const dToAfricaE = dLon > 30 && dLon < 55 && dLat < 0;

  const pts: [number, number][] = [[oLat, oLon]];
  const transships = waypoints.filter(w => w.type === "transshipment");

  // ── Transpacific ────────────────────────────────────────────────────────────
  if (dToNAWest && (oInAsia || oInIndian)) {
    if (oInIndian) pts.push(NAV.malacca);
    pts.push([20, 130], [35, 160], [42, 180]);
    // Extend beyond 180° so Leaflet draws a continuous line across the date line
    const destLonExt = dLon < 0 ? dLon + 360 : dLon;
    pts.push([42, 205], [38, 220], [dLat, destLonExt]);
    return pts;
  }

  // ── SE / East Asia → Atlantic ───────────────────────────────────────────────
  if (oInAsia && (dToEurope || dToNAEast)) {
    pts.push(NAV.malacca);
    for (const t of transships) {
      if (t.lon >= 60 && t.lon <= 120) pts.push([t.lat, t.lon]);
    }
    pts.push([8.0, 77.0]); // SW tip of India, into Indian Ocean
  }

  // ── From Indian subcontinent / Middle East ───────────────────────────────────
  if (oInIndian && !oInAsia) {
    if (oLon > 55) pts.push(NAV.hormuz);
    for (const t of transships) {
      if (t.lon >= 60 && t.lon <= 100) pts.push([t.lat, t.lon]);
    }
  }

  // ── Route to Atlantic (Europe or US East) ───────────────────────────────────
  if (dToEurope || dToNAEast) {
    if (useCape) {
      pts.push([-5, 55], [-20, 40], NAV.cape, [-20, 5], NAV.s_atl);
      if (dToEurope)  pts.push([10, -15], [25, -18], NAV.gibraltar);
      if (dToNAEast)  pts.push([10, -25], [20, -55]);
    } else {
      pts.push(NAV.aden, NAV.bab, NAV.suez_s, NAV.suez_n, NAV.med_e, NAV.med_mid, NAV.gibraltar);
      if (dToNAEast) pts.push(NAV.n_atlantic, [38, -52]);
    }
    for (const t of transships) {
      if (t.lon < 20) pts.push([t.lat, t.lon]);
    }
  }

  // ── East Africa ──────────────────────────────────────────────────────────────
  if (dToAfricaE && oInIndian) {
    // Direct across Indian Ocean — nothing to add
  }

  pts.push([dLat, dLon]);
  return pts;
}

// ── Build full path per mode ──────────────────────────────────────────────────
function buildRoutePath(
  route: OptimizedRoute,
  origin: { lat: number; lon: number },
  dest:   { lat: number; lon: number },
): [number, number][] {
  const o: [number, number] = [origin.lat, origin.lon];
  const d: [number, number] = [dest.lat,   dest.lon];

  switch (route.mode) {
    case "air":
    case "multimodal":
      return gcPoints(o[0], o[1], d[0], d[1], 80);
    case "rail": {
      const pts: [number, number][] = [o];
      if (origin.lon > 90) {
        pts.push(...BRI_WPS);
      } else {
        pts.push(...[...BRI_WPS].reverse());
      }
      pts.push(d);
      return pts;
    }
    default:
      return buildSeaPath(o, d, route.via, route.waypoints);
  }
}

// ── Auto-fit to origin + destination bounds ────────────────────────────────────
function FitBounds({ lat1, lon1, lat2, lon2 }: {
  lat1: number; lon1: number; lat2: number; lon2: number;
}) {
  const map = useMap();
  useEffect(() => {
    const minLat = Math.min(lat1, lat2);
    const maxLat = Math.max(lat1, lat2);
    const minLon = Math.min(lon1, lon2);
    const maxLon = Math.max(lon1, lon2);
    map.fitBounds(
      [[minLat - 4, minLon - 8], [maxLat + 4, maxLon + 8]],
      { padding: [30, 30], maxZoom: 6 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat1, lon1, lat2, lon2]);
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
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

export default function RouteMapLeaflet({
  originPort, destPort,
  originLat, originLon,
  destLat,   destLon,
  routes, selectedRouteId, onSelectRoute,
  className = "",
}: Props) {
  const origin = { lat: originLat, lon: originLon };
  const dest   = { lat: destLat,   lon: destLon };
  const selected = routes.find(r => r.id === selectedRouteId) ?? routes[0];

  return (
    <div className={`rounded-xl overflow-hidden border border-slate-200 ${className}`}
         style={{ minHeight: 220 }}>
      <MapContainer
        center={[(originLat + destLat) / 2, (originLon + destLon) / 2]}
        zoom={3}
        style={{ height: "100%", width: "100%", minHeight: 220 }}
        scrollWheelZoom
        zoomControl
        attributionControl={false}
      >
        {/* Satellite imagery */}
        <TileLayer url={SATELLITE} maxZoom={18} />
        {/* Label overlay (country names, city names) */}
        <TileLayer url={LABELS}    maxZoom={18} opacity={0.85} />

        <FitBounds lat1={originLat} lon1={originLon} lat2={destLat} lon2={destLon} />

        {/* ── Unselected routes (dimmed background) ─────────────────────────── */}
        {routes
          .filter(r => r.id !== selected?.id)
          .map(route => {
            const path  = buildRoutePath(route, origin, dest);
            const color = ROUTE_COLORS[route.id] ?? FALLBACK_COLOR;
            return (
              <Polyline
                key={route.id}
                positions={path}
                pathOptions={{
                  color,
                  weight: 2,
                  opacity: 0.4,
                  dashArray:
                    route.mode === "air"  ? "6 6"  :
                    route.mode === "rail" ? "10 4" : undefined,
                }}
                eventHandlers={{ click: () => onSelectRoute(route.id) }}
              >
                <Tooltip>
                  <span style={{ fontSize: 11 }}>{route.name} · {route.via}</span>
                </Tooltip>
              </Polyline>
            );
          })}

        {/* ── Selected route (highlighted) ──────────────────────────────────── */}
        {selected && (() => {
          const path  = buildRoutePath(selected, origin, dest);
          const color = ROUTE_COLORS[selected.id] ?? "#60a5fa";
          return (
            <Polyline
              key={selected.id + "-sel"}
              positions={path}
              pathOptions={{
                color,
                weight: 4,
                opacity: 1,
                dashArray:
                  selected.mode === "air"  ? "8 5"  :
                  selected.mode === "rail" ? "12 4" : undefined,
                lineCap:  "round",
                lineJoin: "round",
              }}
            >
              <Tooltip sticky>
                <div style={{ fontSize: 12 }}>
                  <strong>{selected.name}</strong><br />
                  {selected.via}
                </div>
              </Tooltip>
            </Polyline>
          );
        })()}

        {/* ── Transshipment hubs for selected route ────────────────────────── */}
        {selected?.waypoints
          .filter(w => w.type === "transshipment")
          .map((wp, i) => (
            <CircleMarker
              key={`hub-${i}`}
              center={[wp.lat, wp.lon]}
              radius={5}
              pathOptions={{
                color: "#fff", fillColor: "#6366f1",
                fillOpacity: 1, weight: 1.5,
              }}
            >
              <Tooltip>{wp.port}</Tooltip>
            </CircleMarker>
          ))}

        {/* ── Origin ────────────────────────────────────────────────────────── */}
        <CircleMarker
          center={[originLat, originLon]}
          radius={7}
          pathOptions={{ color: "#fff", fillColor: "#22c55e", fillOpacity: 1, weight: 2 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            <span style={{ fontSize: 11, fontWeight: 700 }}>⬤ {originPort}</span>
          </Tooltip>
        </CircleMarker>

        {/* ── Destination ───────────────────────────────────────────────────── */}
        <CircleMarker
          center={[destLat, destLon]}
          radius={7}
          pathOptions={{ color: "#fff", fillColor: "#ef4444", fillOpacity: 1, weight: 2 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            <span style={{ fontSize: 11, fontWeight: 700 }}>◆ {destPort}</span>
          </Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
