<div align="center">

<img src="https://img.shields.io/badge/-%F0%9F%9A%A2%20CargoLens-0f172a?style=for-the-badge&labelColor=0f172a" alt="CargoLens" height="48"/>

# CargoLens

### AI-Powered Global Trade Intelligence Platform

_The single pane of glass for modern logistics teams_

<br/>

[![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript_5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase_Realtime-3ecf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/Gemini_2.0_Flash-4285f4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS_4-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![IMF PortWatch](https://img.shields.io/badge/IMF_PortWatch-LIVE-22c55e?style=flat-square)](https://portwatch.imf.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b?style=flat-square)](LICENSE)

<br/>

> **Built for the DP World Hackathon** — and engineered into a full production-grade SaaS.  
> CargoLens gives logistics teams a single intelligent command centre over their entire global supply chain.

<br/>

[🚀 Live Demo](#getting-started) · [📖 Features](#feature-deep-dive) · [🏗 Architecture](#architecture) · [⚡ Quick Start](#getting-started)

---

</div>

<br/>

## What is CargoLens?

> **Logistics teams today track shipments across 5+ fragmented tools, manually Google port congestion, call customs brokers for compliance questions, and miss disruptions until it's too late.**
>
> CargoLens eliminates all of that.

It is a **real-time global logistics SaaS** that unifies shipment data, live port intelligence, trade regulations, AI reasoning, and multi-modal route optimization into one cohesive product — with live data powering every screen.

<br/>

<table>
<tr>
<td width="50%">

**Who it's built for:**
- 🏢 Freight forwarders
- 📦 Export & import managers
- 🔗 Supply chain analysts
- 🛒 E-commerce operations teams
- 🏭 Enterprise trade compliance officers

</td>
<td width="50%">

**What makes it different:**
- ✅ Real AIS vessel data from IMF PortWatch — not estimates
- ✅ Graph-RAG AI that answers multi-hop relational questions
- ✅ True geodesic satellite route maps per transport mode
- ✅ Live FX rates with automatic value conversion
- ✅ Supabase Realtime — every update pushed to every tab

</td>
</tr>
</table>

<br/>

---

## Tech Stack

| Layer | Technology | Why we chose it |
|:---:|:---|:---|
| 🧱 **Framework** | Next.js 16 (App Router) | Server components + ISR caching + API routes — one unified project, zero glue code |
| 🔷 **Language** | TypeScript 5 | End-to-end type safety across every API boundary, hook, and component |
| 🗄 **Database** | Supabase PostgreSQL + Realtime | WebSocket push to every connected client — no polling, instant updates |
| 🤖 **AI / LLM** | Gemini 2.0 Flash | Best free-tier model for structured logistics reasoning; OpenAI-compatible API |
| 🕸 **AI Pattern** | Graph-RAG | Knowledge graph + BFS traversal gives multi-hop context — far better than flat RAG |
| 🎨 **Styling** | Tailwind CSS 4 | Utility-first, zero runtime overhead, fully responsive |
| 🗺 **Maps** | React-Leaflet + ESRI Satellite | Free satellite imagery, no API key; real geodesic routing per transport mode |
| 📊 **Charts** | Recharts | Lightweight SVG sparklines for Trade Pulse corridor history |
| 📱 **Notifications** | Twilio | Reliable SMS + WhatsApp delivery globally (95%+ open rate) |
| 💱 **FX Rates** | open.er-api.com | Free, no key, updated hourly — always accurate cargo valuations |
| 🛳 **Port Data** | IMF PortWatch | Real AIS-derived port waiting times — published by the IMF, zero cost |
| 📰 **News Signals** | GDELT DOC API v2 | Free real-time global news classified for trade disruption signals |
| ☁️ **Deployment** | Vercel | Edge-optimized ISR caching, zero-config CI/CD |

<br/>

---

## Feature Deep-Dive

<br/>

### 1 · Real-Time Dashboard

> The command centre — a live overview of all shipments, alerts, port congestion, FX rates, and Trade Pulse intelligence on one screen.

Instead of a static table that goes stale, the dashboard subscribes to Supabase Postgres realtime changes. Every `INSERT`, `UPDATE`, and `DELETE` on the shipments table propagates to every open browser tab **instantly** — no refresh, no polling.

**What you get:**
- Scrollable shipment table with status pills, ETA, risk level, and cargo value in your selected currency
- Live Alerts panel — clicking any alert opens an inline view with full description, affected shipment, and direct navigation
- Port Congestion corridor overview — click any lane for P50 / P75 / P90 delay breakdowns
- Currency switcher (USD / EUR / AED / INR) with a **`LIVE`** badge backed by real exchange rates
- Filter by status, risk level, and transport mode
- Edit and Delete per row with **instant optimistic UI update** — no waiting for a round-trip

<br/>

---

### 2 · Shipment Tracking & Live Timeline

> A full shipment detail view with a 7-stage timeline, live intelligence sidebar, compliance score, route progress, and real port congestion data.

Every field subscribes to realtime updates. When a carrier changes a shipment status in Supabase, the timeline advances, the progress bar moves, and the risk badge updates — **live, without reload**.

**7-stage timeline:**
```
Booked → Docs Submitted → Departed → In Transit → Customs → Arrived → Delivered
```

**Capabilities:**
- Progress bar colour-coded by stage (blue = transit · amber = at-risk / customs hold · green = delivered)
- Delay risk panel with estimated delay days and root-cause reasons
- Sidebar: carrier, mode, weight, cargo value, HS code, incoterm, ETA — clean label/value rows with zero overlap
- Customs Readiness score ring (0–100) with per-issue breakdown
- Compliance Notes auto-formatted into bullet points
- Sanctions Screening with risk-level badge
- Port Congestion card pulling **real** waiting time from IMF PortWatch for that shipment's port

<br/>

---

### 3 · AI Route Optimization & Satellite Map

> Multi-criteria weighted route scoring across 4–5 alternatives, rendered on a live satellite map with true geodesic paths per transport mode.

Route selection is the highest-leverage decision in freight — the difference between sea and air is **10× cost** and **20× carbon**. The scoring algorithm applies weighted multi-criteria optimization so urgent shipments bias toward speed, green shipments bias toward emissions.

**Scoring formula:**
```
score = costW×(1−normCost) + timeW×(1−normDays) + carbonW×(1−normCarbon)
        + reliabilityW×normReliability + riskW×(1−normRisk)
```

**Weight profiles by shipment priority:**

| Priority | Cost | Time | Carbon | Reliability | Risk |
|:---:|:---:|:---:|:---:|:---:|:---:|
| 🔴 Urgent | 10% | 40% | 5% | 35% | 10% |
| 🟢 Low-cost | 40% | 15% | 15% | 20% | 10% |
| 🔵 Balanced | 22% | 22% | 22% | 22% | 12% |
| 🌿 Green | 18% | 12% | 40% | 18% | 12% |

**Real satellite map — per-mode route paths:**

| Mode | Route |
|:---:|:---|
| 🚢 Sea (Suez) | Origin → Malacca Strait → Indian Ocean → Hormuz → Aden → Bab-el-Mandeb → Suez Canal → Mediterranean → Gibraltar → Destination |
| 🚢 Sea (Cape) | Origin → Cape of Good Hope → South Atlantic → Gibraltar → Destination |
| 🚢 Sea (Transpacific) | Origin → Pacific → crosses antimeridian → US West Coast |
| ✈️ Air | True great-circle geodesic via spherical slerp (80-point interpolation) — arcs poleward on E-W routes as physics demands |
| 🚂 Rail (BRI) | Origin → Zhengzhou → Khorgos → Almaty → Tashkent → Moscow → Warsaw → Destination |

ESRI World Imagery satellite tiles — **completely free, no API key**. Full mouse-wheel zoom and click-drag pan.

<br/>

---

### 4 · Trade Pulse Intelligence

> A 7-feature advanced trade intelligence panel that monitors corridor health, detects statistical anomalies, surfaces live global news, and simulates cost disruption scenarios.

Logistics teams lose money to **delayed reactions**. Trade Pulse surfaces signals before they become problems.

| Feature | What it does | Data source |
|:---|:---|:---|
| 📡 Corridor Congestion Scores | Live composite score per major trade lane | IMF PortWatch + 6-layer signal model |
| 📈 Anomaly Detection | Z-score analysis — flags corridors deviating >1.5σ from 30-day history | localStorage rolling window |
| 📰 GDELT News Signals | Real-time global trade news classified by relevance and disruption impact | GDELT DOC API v2 (free) |
| 📦 ETA Confidence Bands | P50 / P75 / P90 arrival estimates per shipment | Corridor delay profiles + live port data |
| 🔮 What-If Simulator | "What if this corridor worsens by X%?" — shows cost impact at $850/TEU/day | Built-in cost model |
| 🗺 Supplier Risk Map | Maps suppliers to corridors and flags at-risk ones | Shipment + corridor correlation |
| 📉 Sparklines | 30-day score history per corridor as inline SVG | localStorage history |

<br/>

---

### 5 · Port Congestion — IMF PortWatch LIVE

> Real-time AIS-derived port waiting times from the IMF, replacing every static estimate with actual vessel data.

IMF PortWatch is the only **free, globally comprehensive, AIS-derived** dataset for port congestion. It aggregates vessel AIS transponder signals to compute actual anchorage waiting times — not estimated, not hardcoded.

**How the pipeline works:**

```
IMF PortWatch ArcGIS API
        │
        ▼  (public endpoint, no API key)
/api/port-congestion  ──── ISR cache (1 hour)
        │
        ▼
Client fuzzy port matcher
(exact → partial → slash-split name fallback)
        │
        ▼
applyPortWatchOverride()  ──  replaces rule-based score
        │
        ▼
📶 "IMF PortWatch" badge shown · waiting time in blue card
```

**Congestion score mapping (waiting time → 0–100):**

| Waiting time | Score | Risk level |
|:---:|:---:|:---:|
| 0 days | 0 | 🟢 Low |
| 0.5 days | 20 | 🟢 Low |
| 1 day | 40 | 🟡 Moderate |
| 2 days | 60 | 🟠 High |
| 4 days | 78 | 🔴 High |
| 7 days | 92 | 🔴 Severe |
| 10+ days | 100 | 🔴 Severe |

<br/>

---

### 6 · Graph-RAG AI Copilot

> An AI assistant that answers questions about your shipments using a typed knowledge graph — not a flat list of rows.

**Why Graph-RAG instead of plain RAG:**

Traditional RAG embeds text chunks and retrieves the closest match to a query. This fails for relational logistics questions that span multiple entities. Graph-RAG builds a **typed knowledge graph** where shipments, carriers, ports, countries, corridors, regulations, and alerts are nodes connected by semantic edges. BFS traversal (max 2 hops) extracts a relevant subgraph per query.

```
         [Red Sea Alert]
               │  HAS_ALERT
               ▼
         [Asia–Europe Corridor]
               │  TRAVELS_THROUGH
               ▼
         [SHP-2024-003] ←── USES_CARRIER ──► [Maersk]
               │
           DEPARTS_FROM
               │
               ▼
         [Port of Shanghai]
```

**Node types:** `shipment` · `carrier` · `port` · `country` · `corridor` · `regulation` · `hs_code` · `alert`

**Edge types:** `USES_CARRIER` · `DEPARTS_FROM` · `ARRIVES_AT` · `TRAVELS_THROUGH` · `SUBJECT_TO` · `HAS_ALERT` · `RELATED_TO`

**Example queries it handles:**
- _"Which shipments are affected by the Red Sea disruption?"_
- _"What is the compliance status of all Maersk shipments to Europe?"_
- _"Which corridors carry the most at-risk cargo value?"_

Powered by **Gemini 2.0 Flash** via OpenAI-compatible endpoint.

<br/>

---

### 7 · AI Document Intelligence

> Upload trade documents and get AI-extracted fields + compliance validation in seconds.

Document errors are the **#1 cause of customs holds**. Manual checking is slow and error-prone. Gemini extracts all critical fields and cross-validates them against the linked shipment record, flagging discrepancies before filing.

- Supports **PDF, JPG, PNG**
- Extracts: shipper, consignee, HS code, declared value, weight, incoterm, port of loading/discharge
- Validates completeness, value consistency, HS code format
- Cross-checks against the linked shipment record
- Per-issue severity: `error` / `warning` / `info`

<br/>

---

### 8 · Compliance & Sanctions Screening

> Automated pre-shipment compliance checks covering customs readiness, trade sanctions, and corridor-specific regulatory requirements.

**Customs Readiness (0–100):** HS code presence and format, declared value, incoterm validity, document completeness

**Sanctions Screening:** Flags shipments involving sanctioned countries, restricted carriers, dual-use goods by HS code, and high-risk corridors (OFAC, EU, UN lists)

**Corridor Compliance:** EU CBAM requirements, GSP preferential rates, Red Sea advisory notes, country-specific import restrictions

Checks run server-side on every detail page load and re-run live when shipment data changes.

<br/>

---

### 9 · Live FX Rates

> All cargo values displayed in the team's chosen currency using live rates — never hardcoded numbers.

Hardcoded rates drift 5–10% per quarter. A team budgeting in AED sees a very different number than a team in EUR for the same USD shipment.

- `/api/fx-rates` → `open.er-api.com` (free, no key, hourly updates)
- ISR cache (`revalidate: 3600`) — one upstream fetch per hour, instant for all users
- `useFxRates` hook with module-level 60-minute TTL
- Dashboard shows **`LIVE`** badge next to currency switcher
- Automatic fallback to static rates on API failure

<br/>

---

### 10 · Carbon Footprint & Green Rerouting

> Carbon emissions per shipment with modal comparison and rerouting suggestions — built for EU CBAM and Scope 3 compliance.

**Emission factors (GLEC Framework):**

| Mode | kg CO₂e / tonne·km |
|:---:|:---:|
| 🚢 Sea — Suez route | 0.016 |
| 🚢 Sea — Cape route | 0.018 |
| ✈️ Air freight | 0.550 |
| 🚂 Rail (electrified) | 0.007 |
| 🚂 Rail (diesel) | 0.022 |

The Reroute tool shows the **exact emission and cost difference** for switching modes on the current shipment's weight and route distance.

<br/>

---

### 11 · Tariff Simulator

> Pre-shipment landed cost estimation using HS code, declared value, destination country, and applicable trade agreements.

Unexpected import duties are a major source of cost overruns. Simulate total landed cost before booking — including GSP discounts, CBAM surcharges, and anti-dumping duties.

<br/>

---

### 12 · SMS & WhatsApp Notifications

> Real-time shipment alerts via SMS and WhatsApp — because email has a 20–40% open rate and SMS/WhatsApp is above 95%.

When a shipment hits customs hold at 2am, the right person must know immediately.

- **Twilio** sends to any registered number globally
- Triggered manually from the shipment detail page or on status change
- Message includes: shipment code, status, corridor, ETA, recommended action
- `/api/notify/test` endpoint for sandbox testing during development

<br/>

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     Next.js 16 — App Router                        │
│                                                                    │
│   Server Components (SSR / ISR)     Client Components              │
│   ──────────────────────────────    ──────────────────────────     │
│   Shipment detail pages             useShipments  (realtime WS)    │
│   Dashboard initial render          useShipment   (realtime WS)    │
│   Compliance checks                 useFxRates    (module cache)   │
│   Route optimization scoring        LiveIntelligenceSidebar        │
│                                     TradePulse Intelligence        │
│                                                                    │
│   API Routes (Edge / ISR)                                          │
│   ────────────────────────                                         │
│   /api/chat              ──►  Gemini 2.0 Flash   (Graph-RAG)      │
│   /api/fx-rates          ──►  open.er-api.com    (ISR 1 h)        │
│   /api/port-congestion   ──►  IMF PortWatch      (ISR 1 h)        │
│   /api/notify            ──►  Twilio             (SMS / WA)        │
│   /api/document-analysis ──►  Gemini             (OCR + extract)  │
│   /api/compliance-check  ──►  Gemini             (structured)     │
└───────────────────────────────────┬────────────────────────────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             ▼                      ▼                      ▼
    ┌─────────────────┐   ┌──────────────────┐   ┌───────────────┐
    │   Supabase      │   │  Gemini 2.0 Flash │   │    Twilio     │
    │   PostgreSQL    │   │  Graph-RAG copilot│   │  SMS/WhatsApp │
    │   Realtime WS   │   │  Document OCR     │   └───────────────┘
    └─────────────────┘   └──────────────────┘
                                    │
               ┌────────────────────┼────────────────────┐
               ▼                    ▼                    ▼
        ┌────────────┐   ┌────────────────────┐  ┌────────────────┐
        │   GDELT    │   │   IMF PortWatch     │  │ open.er-api    │
        │  DOC API   │   │  ArcGIS AIS Vessel  │  │  FX Rates      │
        │  (free)    │   │  Data  (free)       │  │  (free)        │
        └────────────┘   └────────────────────┘  └────────────────┘
```

<br/>

---

## APIs & Data Sources

| API / Service | Purpose | Cost | Auth |
|:---|:---|:---:|:---:|
| **Supabase** | Database, realtime push, authentication | Free tier | Project key |
| **Gemini 2.0 Flash** | AI copilot, document analysis, compliance checks | Free tier | API key |
| **IMF PortWatch** | Real-time port congestion — AIS vessel data | ✅ Free | None |
| **open.er-api.com** | Live FX exchange rates | ✅ Free | None |
| **GDELT DOC API v2** | Global trade news signals | ✅ Free | None |
| **ESRI Satellite Tiles** | Satellite map imagery | ✅ Free | None |
| **Twilio** | SMS + WhatsApp notifications | Pay-per-use | Account SID + token |

> 5 out of 7 external services require **zero API keys**.

<br/>

---

## Environment Variables

```env
# ── Supabase ──────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# ── Gemini AI  (https://ai.google.dev) ───────────────────────────
GEMINI_API_KEY=your-gemini-api-key

# ── Twilio  (optional — SMS/WhatsApp) ────────────────────────────
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# ── Email  (optional — Resend) ────────────────────────────────────
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM=CargoLens <onboarding@resend.dev>
```

> **IMF PortWatch · open.er-api.com · GDELT · ESRI tiles** require no keys — they work out of the box.

<br/>

---

## Folder Structure

```
cargolens/
├── app/
│   ├── api/
│   │   ├── chat/                  # Gemini Graph-RAG AI copilot
│   │   ├── compliance-check/      # AI compliance validation
│   │   ├── document-analysis/     # Gemini OCR + field extraction
│   │   ├── fx-rates/              # Live FX rates          (ISR 1h)
│   │   ├── notify/                # Twilio SMS + WhatsApp
│   │   └── port-congestion/       # IMF PortWatch live data (ISR 1h)
│   │
│   ├── components/
│   │   ├── CopilotDrawer.tsx           # Slide-in AI chat panel
│   │   ├── DocumentIntelligence.tsx    # Upload + AI field extraction
│   │   ├── LiveIntelligenceSidebar.tsx # Shipment detail right panel
│   │   ├── LiveTimeline.tsx            # 7-stage shipment timeline
│   │   ├── RouteMap.tsx                # SSR-off dynamic import wrapper
│   │   ├── RouteMapLeaflet.tsx         # Satellite map + geodesic routes
│   │   ├── RouteOptimizationPanel.tsx  # Scored route comparison
│   │   ├── ShipmentNotifyPanel.tsx     # SMS/WhatsApp trigger UI
│   │   └── TradePulse.tsx              # 7-feature intelligence panel
│   │
│   ├── lib/
│   │   ├── congestion.ts               # 6-layer model + IMF override
│   │   ├── delay-prediction.ts         # ETA delay risk engine
│   │   ├── document-validation.ts      # Customs readiness scoring
│   │   ├── estimation.ts               # Freight cost + transit profiles
│   │   ├── graph-rag.ts                # Knowledge graph + BFS traversal
│   │   ├── port-watch-types.ts         # Shared types (client-safe)
│   │   ├── route-optimizer.ts          # Multi-criteria route scoring
│   │   ├── sanctions-check.ts          # OFAC/EU sanctions screening
│   │   ├── trade-pulse-engine.ts       # GDELT + anomaly + what-if
│   │   └── hooks/
│   │       ├── useFxRates.ts                  # Live FX, module-level cache
│   │       ├── useShipment.ts                 # Single shipment realtime
│   │       ├── useShipments.ts                # All shipments realtime
│   │       └── useTradePulseIntelligence.ts
│   │
│   ├── dashboard/      # Main command centre
│   ├── shipments/      # List · detail · create · edit
│   ├── carbon/         # Carbon calculator + green rerouting
│   ├── chat/           # Full-page AI copilot
│   ├── compare/        # Rate comparison
│   ├── estimate/       # Freight cost estimation
│   ├── tariff/         # Tariff & landed cost simulator
│   └── settings/       # Preferences + notification config
│
├── supabase/
│   ├── seed-rich.sql              # Full demo dataset
│   └── seed-presentation.sql     # Hackathon demo seed
│
└── test-documents/                # Sample trade docs for AI testing
    ├── bill-of-lading.pdf
    ├── commercial-invoice.pdf
    └── packing-list.pdf
```

<br/>

---

## Why Graph-RAG? (Technical Note)

Standard RAG embeds text chunks and retrieves the closest matches to a query. For logistics data this breaks down immediately — **meaningful answers span multiple connected entities**.

**Example query:** _"Which of my shipments are most at risk from the Red Sea disruption?"_

| Approach | What the LLM sees | Result |
|:---|:---|:---:|
| Flat RAG | Random chunks closest to the query embedding | ❌ Misses carrier → corridor → alert connections |
| Graph-RAG | A connected subgraph: alert → corridor → shipment → carrier | ✅ Complete, relational answer |

**The Graph-RAG pipeline:**
1. Query seeds a BFS traversal from the `Red Sea alert` node
2. Traversal follows edges: `alert → corridor → shipment → carrier` (max 2 hops)
3. Extracted subgraph is serialised into structured context
4. Gemini receives a complete, connected picture — not random chunks

This is why CargoLens can answer multi-hop relational questions that a flat retrieval system simply cannot.

<br/>

---

<div align="center">

**Built with purpose. Powered by real data.**

_CargoLens — DP World Hackathon_

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ecf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/Gemini_AI-4285f4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)
[![IMF PortWatch](https://img.shields.io/badge/IMF_PortWatch-LIVE-22c55e?style=flat-square)](https://portwatch.imf.org)

</div>
#   C a r g o L e n s  
 