-- ─── CargoLens Presentation Dataset ─────────────────────────────────────────
-- Run this in Supabase SQL Editor (bypasses RLS).
-- Step 1: Clear all existing seeded shipments
-- Step 2: Insert 10 real-world shipments covering all app features
--
-- Each shipment covers a unique corridor, compliance scenario, and risk
-- profile so every AI engine (congestion, delay, sanctions, tariff, carbon)
-- produces different, meaningful output.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Remove existing seeded shipments ─────────────────────────────────
DELETE FROM shipment_events WHERE shipment_id IN (
  SELECT id FROM shipments WHERE is_seeded = true
);
DELETE FROM shipments WHERE is_seeded = true;

-- ── Step 2: Insert 10 real presentation shipments ────────────────────────────

INSERT INTO shipments (
  shipment_code, shipper_company, contact_name, email,
  origin_country, origin_port, destination_country, destination_port,
  consignee_name, cargo_category, hs_code, weight, volume,
  incoterm, shipment_mode, priority,
  expected_dispatch_date, declared_value, currency,
  status, risk_level, eta_date, corridor, carrier,
  carbon_kg, compliance_notes, notes, is_seeded
) VALUES

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SHP-2026-001 | India → Netherlands | Sea | In Transit | Medium Risk
--    Textiles (HS 6205.20). EU CBAM + Red Sea Cape reroute active.
--    Good test for: compliance score, route optimization (sea vs rail), carbon.
-- ─────────────────────────────────────────────────────────────────────────────
(
  'SHP-2026-001',
  'Sunrise Garments Ltd',
  'Arun Mehta',
  'arun.mehta@sunrisegarments.in',
  'India', 'Nhava Sheva (Mumbai)',
  'Netherlands', 'Rotterdam',
  'EuroTextile Distribution BV',
  'Textiles & Apparel',
  '6205.20',
  8500, 45.0,
  'CIF', 'sea', 'balanced',
  '2026-03-08', 142000, 'USD',
  'in_transit', 'medium', '2026-04-22',
  'India → EU', 'Maersk',
  1632,
  'EU CBAM reporting required from Jan 2026. Certificate of Origin Form A submitted for EU GSP preferential rate. Red Sea disruption active — current routing via Cape of Good Hope adds 9 days and ~$900/TEU.',
  'FCL 40HC. Vessel: Maersk Altair, Voyage 2026-14W. Port of loading completed 10-Mar.',
  true
),

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SHP-2026-002 | India → USA | Sea | Customs Hold | High Risk
--    Pharma API (HS 2941.10). FDA Prior Notice pending + UFLPA flag.
--    Good test for: sanctions engine, compliance errors, delay prediction.
-- ─────────────────────────────────────────────────────────────────────────────
(
  'SHP-2026-002',
  'BioSynth Pharma Pvt Ltd',
  'Dr. Priya Nair',
  'priya.nair@biosynthpharma.com',
  'India', 'Nhava Sheva (Mumbai)',
  'USA', 'New York / Newark',
  'Atlantic BioSciences Inc.',
  'Pharmaceuticals & Life Sciences',
  '2941.10',
  2100, 8.0,
  'DAP', 'sea', 'urgent',
  '2026-03-01', 285000, 'USD',
  'customs_hold', 'high', '2026-04-20',
  'India → US', 'Hapag-Lloyd',
  538,
  'FDA Prior Notice submission rejected — resubmission with corrected establishment registration number pending CBP review. UFLPA supply chain documentation requested: full list of API raw material suppliers required. Section 301 pharmaceutical tariff (HS 2941) tariff exclusion application filed.',
  'LCL shipment. Container held at Port Newark CBP Examination Facility since 28-Mar. Broker: Global Trade Services NY. Est. clearance 7-10 business days pending FDA response.',
  true
),

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SHP-2026-003 | UAE → Kenya | Sea | Booked | Low Risk
--    Consumer Electronics (HS 8471.30). KRA conformity inspection required.
--    Good test for: booking flow, corridor optimizer, carbon baseline.
-- ─────────────────────────────────────────────────────────────────────────────
(
  'SHP-2026-003',
  'Al-Futtaim Industrial LLC',
  'Hassan Al-Rashid',
  'h.alrashid@alfuttaimindustrial.ae',
  'UAE', 'Jebel Ali',
  'Kenya', 'Mombasa',
  'Nairobi Tech Distributors Ltd',
  'Electronics & Technology',
  '8471.30',
  3800, 18.0,
  'CFR', 'sea', 'balanced',
  '2026-04-20', 198000, 'USD',
  'booked', 'low', '2026-05-03',
  'UAE → East Africa', 'MSC',
  243,
  'Kenya Revenue Authority (KRA) Certificate of Conformity (CoC) required — PVOC application submitted to Intertek Nairobi. Import Declaration Form (IDF) lodged via KeTRaDE. DP World Jebel Ali confirmed FCL slot 20-Apr.',
  'FCL 20GP. Booking confirmed with MSC Beatrice, Voyage EA-2026-17. Pre-stacking at Jebel Ali CFS 18-Apr.',
  true
),

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SHP-2026-004 | Singapore → Netherlands | Sea | In Transit | Medium Risk
--    Semiconductors (HS 8542.31). EU dual-use + CBAM declarant obligation.
--    Good test for: sanctions screening (semiconductor dual-use), route map.
-- ─────────────────────────────────────────────────────────────────────────────
(
  'SHP-2026-004',
  'TechStar Singapore Pte Ltd',
  'Wei Liang Chen',
  'wlchen@techstarsg.com',
  'Singapore', 'Singapore (PSA — Tanjong Pagar)',
  'Netherlands', 'Rotterdam',
  'Quantum Chip Solutions BV',
  'Electronics & Technology',
  '8542.31',
  4200, 12.0,
  'CIF', 'sea', 'balanced',
  '2026-03-10', 520000, 'USD',
  'in_transit', 'medium', '2026-04-22',
  'SE Asia → Europe', 'CMA CGM',
  1008,
  'EU dual-use export classification under Reg. 2021/821 — end-user certificate submitted for advanced semiconductor ICs. Singapore Strategic Goods (Control) Act export permit obtained. CBAM declarant registration completed for Q1 2026 reporting. Rotterdam customs pre-notification filed.',
  'FCL 20GP. CMA CGM Thalassa, Voyage AEX-2026-12. Transshipment at Port Klang completed 22-Mar. On schedule.',
  true
),

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. SHP-2026-005 | China → UAE | Sea | At Risk | High Risk
--    Heavy Machinery (HS 8429.51). COSCO reliability + port congestion risk.
--    Good test for: congestion algorithm (COSCO reliability), sanctions flags.
-- ─────────────────────────────────────────────────────────────────────────────
(
  'SHP-2026-005',
  'Shenzhen Dragon Heavy Industries Co. Ltd',
  'Li Wei Zhang',
  'liwei.zhang@dragonheavy.cn',
  'China', 'Shenzhen / Yantian',
  'UAE', 'Jebel Ali',
  'Gulf Bridge Engineering FZCO',
  'Machinery & Industrial Equipment',
  '8429.51',
  22000, 65.0,
  'FOB', 'sea', 'balanced',
  '2026-03-20', 485000, 'USD',
  'at_risk', 'high', '2026-04-18',
  'China → Middle East', 'COSCO',
  2640,
  'UAE Ministry of Economy import permit required for heavy construction equipment — application under review. Chinese CCIC export inspection certificate obtained. UAE ESMA conformity assessment pending for electrical sub-components. Vessel schedule slippage reported by COSCO — ETA revised twice.',
  'OOG (Out of Gauge) cargo. 2×40HC + 1×OOG flat rack. Vessel: COSCO Shanghai, Voyage ME-2026-08. At-risk flag raised after vessel skipped Colombo transshipment port.',
  true
),

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SHP-2026-006 | India → UK | Air | In Transit | Low Risk
--    Automotive Parts (HS 8708.99). Air express, UK DCTS preferential rate.
--    Good test for: air carbon footprint, UK post-Brexit compliance, speed.
-- ─────────────────────────────────────────────────────────────────────────────
(
  'SHP-2026-006',
  'Precision Auto Components Ltd',
  'Rajesh Kumar',
  'rajesh.kumar@precisionauto.in',
  'India', 'Chennai',
  'UK', 'Felixstowe',
  'British Automotive Supplies Ltd',
  'Automotive & Spare Parts',
  '8708.99',
  520, 2.5,
  'DAP', 'air', 'urgent',
  '2026-04-03', 78000, 'USD',
  'in_transit', 'low', '2026-04-08',
  'India → EU', 'Emirates SkyCargo',
  2090,
  'UK DCTS tariff preference claimed — Form C88 submitted with UK GSP certificate. UK Modern Slavery Act transparency statement on file. Post-Brexit customs formality: UK import entry lodged via CHIEF. Air waybill: EK-2026-7741.',
  'Air freight via Emirates SkyCargo, Chennai → Dubai (DXB) → London Heathrow (LHR). JIT delivery for BMW production line. Priority handling confirmed.',
  true
),

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. SHP-2026-007 | Vietnam → Netherlands | Sea | Delayed | Medium Risk
--    Wooden Furniture (HS 9403.60). EU AD/CVD investigation active.
--    Good test for: delay prediction, sanctions (AD/CVD), route comparison.
-- ─────────────────────────────────────────────────────────────────────────────
(
  'SHP-2026-007',
  'Mekong Furniture Export Co.',
  'Nguyen Thi Lan',
  'nguyen.lan@mekongfurniture.vn',
  'Vietnam', 'Ho Chi Minh City (Cat Lai)',
  'Netherlands', 'Rotterdam',
  'Dutch Living Imports BV',
  'Furniture & Home Goods',
  '9403.60',
  6200, 38.0,
  'FOB', 'sea', 'low-cost',
  '2026-02-25', 89000, 'USD',
  'delayed', 'medium', '2026-04-25',
  'SE Asia → Europe', 'Evergreen',
  1389,
  'EU anti-dumping investigation on Vietnamese wooden furniture (Case AD-2025-VN) — shipment flagged for verification of Vietnamese origin. EVFTA Certificate of Origin EUR.1 submitted. Delay: 21-day equipment shortage at Cat Lai terminal caused missed vessel. Additional 2-day delay at Singapore transshipment.',
  'LCL consolidation, 2×20GP. Original vessel missed (Evergreen Emerald 12-Mar). Rebooked Evergreen Elixir 01-Apr. Customer notified of revised delivery window 25–28 Apr.',
  true
),

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. SHP-2026-008 | Bangladesh → Netherlands | Sea | In Transit | Low Risk
--    Garments (HS 6204.62). EU EBA 0% duty. Red Sea Cape reroute adds days.
--    Good test for: EBA compliance, clean compliance score, carbon routing.
-- ─────────────────────────────────────────────────────────────────────────────
(
  'SHP-2026-008',
  'Delta Garments Ltd',
  'Mohammad Hasan',
  'm.hasan@deltagarments.bd',
  'Bangladesh', 'Chittagong',
  'Netherlands', 'Rotterdam',
  'Amsterdam Fashion Wholesale BV',
  'Textiles & Apparel',
  '6204.62',
  14500, 82.0,
  'CIF', 'sea', 'low-cost',
  '2026-03-20', 165000, 'USD',
  'in_transit', 'low', '2026-04-30',
  'SE Asia → Europe', 'MSC',
  2552,
  'EU EBA (Everything But Arms) 0% import duty applied — EUR.1 Certificate of Origin submitted. ILO core convention compliance audit completed Mar 2026. Red Sea disruption active — Cape of Good Hope reroute, ETA extended 8 days. CBAM declarant registration N/A (garments excluded from current scope).',
  'FCL 2×40HC. MSC Aurora, Voyage EU-2026-09. Colombo transshipment 28-Mar. On schedule for revised ETA 30-Apr.',
  true
),

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. SHP-2026-009 | Netherlands → Nigeria | Sea | In Transit | Medium Risk
--    Industrial Generators (HS 8502.13). Nigerian SON/Form M complexity.
--    Good test for: Europe → Africa corridor, complex import customs.
-- ─────────────────────────────────────────────────────────────────────────────
(
  'SHP-2026-009',
  'Energex Industrial BV',
  'Pieter van den Berg',
  'p.vandenberg@energexbv.nl',
  'Netherlands', 'Rotterdam',
  'Nigeria', 'Lagos',
  'Lagos Power Solutions Ltd',
  'Machinery & Industrial Equipment',
  '8502.13',
  9800, 52.0,
  'CIF', 'sea', 'balanced',
  '2026-03-18', 324000, 'USD',
  'in_transit', 'medium', '2026-04-14',
  'Europe → Africa', 'Hapag-Lloyd',
  1333,
  'Nigerian Standards Organisation (SON) pre-shipment inspection certificate obtained via SGS Lagos. Central Bank of Nigeria Form M pre-import declaration approved (ref: CBN-2026-IMP-44821). NAFDAC permit not required for generators. Destination Inspection (DI) scan required at Apapa Port — agent pre-notified.',
  'FCL 2×40GP. Hapag-Lloyd vessel: Colombo Express, Voyage WAF-2026-07. ETA Lagos 14-Apr. Clearing agent: Meridian Freight Nigeria.',
  true
),

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. SHP-2026-010 | UAE → Tanzania | Sea | At Risk | Medium Risk
--     Steel Wire (HS 7217.10). EAC certificate + Dar es Salaam port congestion.
--     Good test for: port congestion (Dar es Salaam bottleneck), delay risk.
-- ─────────────────────────────────────────────────────────────────────────────
(
  'SHP-2026-010',
  'Gulf Bridge Engineering FZCO',
  'Mohammed Al-Khatib',
  'm.alkhatib@gulfbridge.ae',
  'UAE', 'Jebel Ali',
  'Tanzania', 'Dar es Salaam',
  'Tanzania Infrastructure Supplies Ltd',
  'Construction Materials',
  '7217.10',
  28500, 120.0,
  'CFR', 'sea', 'balanced',
  '2026-03-25', 198000, 'USD',
  'at_risk', 'medium', '2026-04-18',
  'UAE → East Africa', 'Evergreen',
  2052,
  'EAC Certificate of Origin required for COMESA preferential duty rate (0% vs standard 25%). Tanzania Revenue Authority (TRA) Single Window pre-declaration submitted. Tanzania Bureau of Standards (TBS) type approval required for galvanised steel wire — pending verification. Dar es Salaam port congestion advisory: 4–6 day anchorage wait reported by TPA.',
  'FCL 2×40HC + 1×20GP (break bulk steel coils). Evergreen vessel: Ever Gem, Voyage EA-2026-11. At-risk flag: Dar es Salaam port congestion + TBS approval pending.',
  true
);

-- ─── Seed shipment events for the in-transit shipments ────────────────────────
-- These give the timeline panel real data to display on the detail page.

-- Events for SHP-2026-001 (India → Netherlands, in_transit)
INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'booking',    'Booking Confirmed',         'Nhava Sheva, India',  'completed', '2026-03-05 09:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-001';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'export',     'Cargo Loaded — Port of Origin', 'Nhava Sheva, India', 'completed', '2026-03-10 14:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-001';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'departure',  'Vessel Departed',           'Nhava Sheva, India',  'completed', '2026-03-10 22:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-001';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'waypoint',   'Cape of Good Hope Passage', 'Cape Town, South Africa', 'completed', '2026-03-28 08:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-001';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'in_transit', 'In Transit — North Atlantic', 'Atlantic Ocean',     'active',    '2026-04-05 00:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-001';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'import',     'Port Arrival — Customs Clearance', 'Rotterdam, Netherlands', 'pending', '2026-04-22 00:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-001';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'delivery',   'Final Delivery',            'Amsterdam, Netherlands', 'pending', '2026-04-24 00:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-001';

-- Events for SHP-2026-002 (India → USA, customs_hold)
INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'booking',    'Booking Confirmed',         'Nhava Sheva, India',  'completed', '2026-02-25 10:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-002';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'export',     'Cargo Loaded',              'Nhava Sheva, India',  'completed', '2026-03-03 12:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-002';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'in_transit', 'Vessel In Transit',         'Indian Ocean',        'completed', '2026-03-10 00:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-002';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'arrival',    'Port Arrival — CBP Examination', 'Port Newark, USA', 'completed', '2026-03-26 08:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-002';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'customs_hold', 'Customs Hold — FDA Prior Notice Rejected', 'Port Newark CBP, USA', 'active', '2026-03-28 14:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-002';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'delivery',   'Release & Delivery (Pending CBP)',  'Newark, USA',  'pending', '2026-04-20 00:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-002';

-- Events for SHP-2026-004 (Singapore → Netherlands, in_transit)
INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'booking',    'Booking Confirmed',         'Singapore',           'completed', '2026-03-06 09:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-004';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'export',     'Cargo Loaded — PSA Terminal', 'Singapore',         'completed', '2026-03-12 16:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-004';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'waypoint',   'Transshipment — Port Klang', 'Port Klang, Malaysia', 'completed', '2026-03-22 10:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-004';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'in_transit', 'In Transit — Suez Canal Passage', 'Red Sea / Suez',  'active',  '2026-04-04 00:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-004';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'import',     'Rotterdam Arrival & Customs', 'Rotterdam, Netherlands', 'pending', '2026-04-22 00:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-004';

-- Events for SHP-2026-007 (Vietnam → Netherlands, delayed)
INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'booking',    'Booking Confirmed',         'Ho Chi Minh City, Vietnam', 'completed', '2026-02-20 09:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-007';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'delay',      'Vessel Missed — Equipment Shortage', 'Cat Lai Terminal, Vietnam', 'completed', '2026-03-12 18:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-007';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'export',     'Cargo Loaded (Rebooked Vessel)', 'Ho Chi Minh City, Vietnam', 'completed', '2026-04-01 12:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-007';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'in_transit', 'In Transit via Singapore', 'South China Sea',     'active',    '2026-04-04 00:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-007';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'import',     'Rotterdam Arrival',         'Rotterdam, Netherlands', 'pending', '2026-04-25 00:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-007';

-- Events for SHP-2026-009 (Netherlands → Nigeria, in_transit)
INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'booking',    'Booking Confirmed',         'Rotterdam, Netherlands', 'completed', '2026-03-14 10:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-009';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'export',     'Cargo Loaded — Rotterdam',  'Rotterdam, Netherlands', 'completed', '2026-03-20 14:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-009';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'waypoint',   'Passed Las Palmas, Canaries', 'Las Palmas, Canary Islands', 'completed', '2026-03-30 06:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-009';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'in_transit', 'In Transit — Gulf of Guinea', 'Atlantic Ocean, WAF', 'active',   '2026-04-05 00:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-009';

INSERT INTO shipment_events (shipment_id, event_type, event_label, location, status, occurred_at)
SELECT id, 'import',     'Lagos Arrival & Customs Clearance', 'Lagos (Apapa), Nigeria', 'pending', '2026-04-14 00:00:00+00'
FROM shipments WHERE shipment_code = 'SHP-2026-009';
