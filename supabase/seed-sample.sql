-- ─── CargoLens — 10 Demo Sample Shipments ─────────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor
-- is_seeded = true → visible to all users via RLS (no auth required to view)
-- Covers all major CargoLens features: delay, sanctions, congestion, customs, carbon
--
-- Cleanup: DELETE FROM public.shipments WHERE id::text LIKE 'a1000001%';
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove previous demo data if re-running
DELETE FROM public.shipments
  WHERE id IN (
    'a1000001-0000-4000-8000-000000000001',
    'a1000001-0000-4000-8000-000000000002',
    'a1000001-0000-4000-8000-000000000003',
    'a1000001-0000-4000-8000-000000000004',
    'a1000001-0000-4000-8000-000000000005',
    'a1000001-0000-4000-8000-000000000006',
    'a1000001-0000-4000-8000-000000000007',
    'a1000001-0000-4000-8000-000000000008',
    'a1000001-0000-4000-8000-000000000009',
    'a1000001-0000-4000-8000-000000000010'
  );

-- ─── Shipments ────────────────────────────────────────────────────────────────

INSERT INTO public.shipments (
  id, user_id, shipment_code,
  shipper_company, contact_name, email,
  origin_country, origin_port,
  destination_country, destination_port,
  consignee_name, cargo_category, hs_code,
  weight, volume, incoterm, shipment_mode, priority,
  expected_dispatch_date, declared_value, currency,
  status, risk_level, eta_date,
  corridor, carrier, carbon_kg,
  compliance_notes, notes, is_seeded
) VALUES

-- 1. India → EU textiles | CBAM/customs exposure | in_transit medium risk
-- Triggers: delay alert (India→EU corridor), customs warning (CBAM), congestion overlay
(
  'a1000001-0000-4000-8000-000000000001', NULL, 'SMP-001',
  'Bangalore Textile Exports Pvt Ltd', 'Ravi Sharma', 'ravi@btex.in',
  'India', 'Nhava Sheva',
  'Netherlands', 'Rotterdam',
  'EuroFabrics BV', 'Textiles & Garments', '5208.21',
  18500, 28.0, 'FOB', 'sea', 'balanced',
  '2026-02-10', 142000, 'USD',
  'in_transit', 'medium', '2026-04-25',
  'India → EU', 'Maersk', 3552,
  'EU CBAM reporting obligation applies from 2026. GOTS certification attached. No Xinjiang-origin materials confirmed.',
  'Full container load, 2 × 20ft. Cape reroute in effect — ETA extended 10 days.',
  true
),

-- 2. India → US cotton | UFLPA sanctions sensitivity | at_risk high risk
-- Triggers: sanctions flag (UFLPA), delay alert (at_risk + high + India→US corridor)
(
  'a1000001-0000-4000-8000-000000000002', NULL, 'SMP-002',
  'Coimbatore Cotton Mills Ltd', 'Priya Natarajan', 'priya@ccm.in',
  'India', 'Mundra',
  'United States', 'New York / Newark',
  'American Textile Imports Inc', 'Textiles & Garments', '5201.00',
  12000, 18.0, 'CIF', 'sea', 'balanced',
  '2026-02-25', 95000, 'USD',
  'at_risk', 'high', '2026-04-10',
  'India → US', 'Hapag-Lloyd', 3072,
  'UFLPA screening required — supply chain audit in progress. Section 301 tariff (15%) applies HS 5201.00. Cotton origin traceability documentation must be provided to US CBP before clearance. Xinjiang sourcing risk present.',
  'Awaiting CBP pre-clearance advisory. Customer notified of possible delay.',
  true
),

-- 3. UAE → Kenya electronics | customs_hold | certificate mismatch
-- Triggers: customs_hold (delay critical), cert mismatch (doc validation error), Mombasa congestion (severe)
(
  'a1000001-0000-4000-8000-000000000003', NULL, 'SMP-003',
  'Gulf Electronics Distribution LLC', 'Ahmed Al-Rashidi', 'ahmed@gulfedist.ae',
  'UAE', 'Jebel Ali',
  'Kenya', 'Mombasa',
  'East Africa Tech Supplies Ltd', 'Electronics & Technology', '8471.30',
  8200, 12.0, 'DDU', 'sea', 'express',
  '2026-03-05', 285000, 'USD',
  'customs_hold', 'high', '2026-04-05',
  'UAE → East Africa', 'MSC', 525,
  'Kenya Revenue Authority (KRA) pre-shipment inspection triggered. Certificate of conformity mismatch on HS 8471.30 — CoC does not match manifest description. Corrected document resubmitted. Est. 3–5 day hold.',
  'High-priority electronics for retail chain. Customer escalation raised.',
  true
),

-- 4. Singapore → Germany pharma | booked low-risk | strong documentation
-- Triggers: clean baseline, REACH compliant, booked timeline, no major alerts
(
  'a1000001-0000-4000-8000-000000000004', NULL, 'SMP-004',
  'SingPharma International Pte Ltd', 'Li Wei Chen', 'liwei@singpharma.sg',
  'Singapore', 'Singapore Port',
  'Germany', 'Hamburg',
  'MedLogistics GmbH', 'Pharmaceuticals & Life Sciences', '3004.90',
  3500, 5.0, 'DAP', 'sea', 'fastest',
  '2026-04-08', 920000, 'USD',
  'booked', 'low', '2026-05-20',
  'SE Asia → Europe', 'Hapag-Lloyd', 868,
  'EU REACH compliant. GMP certified manufacturer. Temperature-controlled 2–8°C throughout. German customs: EudraVigilance reference provided. No dual-use restrictions apply.',
  'Controlled temperature reefer container. Pre-booked priority slot at Hamburg.',
  true
),

-- 5. China → UAE chemicals | at_risk critical | sanctions/dual-use HS
-- Triggers: OFAC keywords, dual-use HS 2814, critical risk → sanctions high, delay critical
(
  'a1000001-0000-4000-8000-000000000005', NULL, 'SMP-005',
  'Zhejiang Chemical Exports Co Ltd', 'Zhang Wei', 'zw@zjchem.cn',
  'China', 'Shanghai',
  'UAE', 'Jebel Ali',
  'Middle East Industrial Chemicals LLC', 'Chemicals & Petrochemicals', '2814.10',
  22000, 15.0, 'FOB', 'sea', 'balanced',
  '2026-03-01', 180000, 'USD',
  'at_risk', 'critical', '2026-04-08',
  'China → Middle East', 'COSCO', 2816,
  'OFAC screening required. HS 2814.10 (anhydrous ammonia) is a restricted dual-use chemical precursor. Consignee identity requires enhanced due diligence. Denied party check pending. Possible restricted end-use — escalate to compliance officer immediately.',
  'Hazardous goods class 2.3 / 8. UN2672. Special port handling required.',
  true
),

-- 6. Netherlands → South Africa machinery | in_transit | congestion + OOG
-- Triggers: Europe→Africa congestion overlay, Durban port score, medium delay
(
  'a1000001-0000-4000-8000-000000000006', NULL, 'SMP-006',
  'Dutch Industrial Machinery BV', 'Erik van der Berg', 'erik@dutchindustrial.nl',
  'Netherlands', 'Rotterdam',
  'South Africa', 'Durban',
  'SA Mining Equipment Ltd', 'Machinery & Industrial Equipment', '8430.10',
  35000, 45.0, 'CIF', 'sea', 'balanced',
  '2026-03-12', 620000, 'USD',
  'in_transit', 'medium', '2026-04-28',
  'Europe → Africa', 'Maersk', 5600,
  'SARS import permit required for industrial machinery. HS 8430.10 verified. No restricted end-use. Durban port congestion advisory — 3–5 day delay possible on arrival.',
  'OOG (out of gauge) flat rack container. Special port equipment pre-arranged.',
  true
),

-- 7. India → Japan general cargo | delivered | low-risk baseline
-- Triggers: clean delivered timeline with all events, no alerts — baseline comparison
(
  'a1000001-0000-4000-8000-000000000007', NULL, 'SMP-007',
  'Mumbai Export House Pvt Ltd', 'Suresh Mehta', 'suresh@mumbaiexports.in',
  'India', 'Mundra',
  'Japan', 'Tokyo',
  'Japan Trade Partners KK', 'General Cargo & Commodities', '6302.10',
  9500, 14.0, 'FOB', 'sea', 'balanced',
  '2026-02-01', 67000, 'USD',
  'delivered', 'low', '2026-03-15',
  'India → Japan', 'ONE', 1368,
  'Japan Customs standard clearance. No special permits required. Certificate of Origin (COO) issued.',
  'Clean delivery — no customs issues. Good corridor benchmark.',
  true
),

-- 8. Bangladesh → UK garments | booked | document mismatch risk
-- Triggers: doc validation error (mismatch keyword), sanctions flag (mismatch keyword)
(
  'a1000001-0000-4000-8000-000000000008', NULL, 'SMP-008',
  'Dhaka Garments Manufacturing Ltd', 'Rafiqul Islam', 'rafiq@dhakagarments.bd',
  'Bangladesh', 'Chittagong',
  'UK', 'Felixstowe',
  'UK Fashion Group Ltd', 'Textiles & Garments', '6204.62',
  14000, 22.0, 'FOB', 'sea', 'balanced',
  '2026-04-05', 118000, 'USD',
  'booked', 'medium', '2026-05-10',
  'Bangladesh → UK', 'MSC', 2688,
  'Document mismatch: Certificate of Origin (Form A) GSP does not match packing list quantity. UK DCTS 0% duty rate application pending Form A correction. UKCA marking required. Customs entry on hold pending corrected CoO.',
  'UK DCTS preferential duty pending. Resubmission deadline 3 days.',
  true
),

-- 9. Vietnam → France consumer goods | in_transit | low-carbon optimised
-- Triggers: EVFTA compliance (info note), low carbon priority, SE Asia→Europe overlay, low risk
(
  'a1000001-0000-4000-8000-000000000009', NULL, 'SMP-009',
  'Vietnam Consumer Goods Export Co', 'Nguyen Thi Hoa', 'hoa@vcgec.vn',
  'Vietnam', 'Ho Chi Minh City',
  'France', 'Le Havre',
  'Importations France SAS', 'Consumer Goods & FMCG', '9403.20',
  11000, 32.0, 'CIF', 'sea', 'low_carbon',
  '2026-03-18', 87000, 'EUR',
  'in_transit', 'low', '2026-04-25',
  'SE Asia → Europe', 'CMA CGM', 2288,
  'EVFTA (EU-Vietnam FTA) applicable — EUR.1 certificate issued. Low-carbon consolidated LCL load. Carbon footprint documentation provided for EU Green Claims compliance. REACH not applicable for furniture category.',
  'LCL consolidation for carbon optimisation. Optimised load factor verified.',
  true
),

-- 10. Turkey → US industrial components | delayed high risk | tariff/CBP exposure
-- Triggers: delay critical (delayed + high risk + compliance flags), cbp hold keyword, sanctions flag
(
  'a1000001-0000-4000-8000-000000000010', NULL, 'SMP-010',
  'Istanbul Steel Works AS', 'Mehmet Yilmaz', 'mehmet@istanbulsteel.tr',
  'Turkey', 'Istanbul',
  'United States', 'Houston',
  'Gulf Coast Industrials LLC', 'Machinery & Industrial Equipment', '7308.10',
  28000, 20.0, 'CFR', 'sea', 'balanced',
  '2026-02-15', 340000, 'USD',
  'delayed', 'high', '2026-04-15',
  'Turkey → US', 'MSC', 5376,
  'US Section 232 steel tariff: 25% import duty on HS 7308.10 structural steel. CBP hold for anti-dumping review. Possible detained status pending AD case resolution. Confirm tariff exclusion certificate before re-release.',
  'Structural steel for industrial facility. Delayed by AD/CVD customs review.',
  true
);

-- ─── Shipment Events ──────────────────────────────────────────────────────────
-- Events power the timeline on the shipment detail page.
-- status: completed | active | pending

INSERT INTO public.shipment_events
  (id, shipment_id, event_type, event_label, location, occurred_at, status, notes)
VALUES

-- SMP-001 India → EU | in_transit: departed, transshipment active
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000001', 'booked',          'Shipment Booked',                     'India',              '2026-02-10T08:00:00Z', 'completed', 'Booking confirmed with Maersk. BL issued.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000001', 'customs_filed',   'Export Customs Filed',                'Nhava Sheva',        '2026-02-12T10:00:00Z', 'completed', 'Indian customs cleared. Shipping bill filed.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000001', 'at_origin_port',  'At Nhava Sheva Port',                 'Nhava Sheva',        '2026-02-14T06:00:00Z', 'completed', 'Container loaded and sealed.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000001', 'departed',        'Departed Nhava Sheva',                'Nhava Sheva',        '2026-02-15T18:00:00Z', 'completed', 'Vessel departed. Cape of Good Hope reroute in effect.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000001', 'transshipment',   'Transshipment — Cape of Good Hope',   'Cape Town',          '2026-03-20T12:00:00Z', 'active',    'Red Sea diversion via Cape — +10 days added to ETA.'),

-- SMP-002 India → US | at_risk: in transit with CBP advisory
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000002', 'booked',          'Shipment Booked',                     'India',              '2026-02-25T08:00:00Z', 'completed', 'Booking confirmed with Hapag-Lloyd.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000002', 'customs_filed',   'Export Customs Filed',                'Mundra',             '2026-02-27T10:00:00Z', 'completed', 'Indian customs cleared.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000002', 'at_origin_port',  'At Mundra Port',                      'Mundra',             '2026-02-28T08:00:00Z', 'completed', 'Container stuffed and sealed.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000002', 'departed',        'Departed Mundra',                     'Mundra',             '2026-03-01T20:00:00Z', 'completed', 'Vessel departed for Trans-Pacific.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000002', 'transshipment',   'At Risk — CBP Pre-Clearance Hold',    'Indian Ocean',       '2026-03-20T09:00:00Z', 'active',    'US CBP UFLPA advisory triggered. Supply chain audit underway. Shipment at risk of detention on arrival.'),

-- SMP-003 UAE → Kenya | customs_hold: arrived, customs active
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000003', 'booked',          'Shipment Booked',                     'UAE',                '2026-03-05T08:00:00Z', 'completed', 'Booking confirmed with MSC.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000003', 'customs_filed',   'UAE Export Customs Cleared',          'Jebel Ali',          '2026-03-07T10:00:00Z', 'completed', 'UAE export clearance complete. CoO issued.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000003', 'at_origin_port',  'At Jebel Ali Terminal',               'Jebel Ali',          '2026-03-08T07:00:00Z', 'completed', '3x 40ft containers received at DP World terminal.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000003', 'departed',        'Departed Jebel Ali',                  'Jebel Ali',          '2026-03-09T16:00:00Z', 'completed', 'MSC vessel departed for Mombasa.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000003', 'arrived_destination', 'Arrived Mombasa Port',            'Mombasa',            '2026-03-22T09:00:00Z', 'completed', 'Vessel berthed at Mombasa. KRA inspection initiated.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000003', 'customs_clearance', 'Import Customs Hold — KRA Inspection', 'Mombasa',          '2026-03-22T14:00:00Z', 'active',    'Kenya Revenue Authority flagged HS code mismatch on electronics. Corrected CoC submitted. Est. 3–5 day hold.'),

-- SMP-004 Singapore → Germany | booked: only booking event
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000004', 'booked',          'Shipment Booked',                     'Singapore',          '2026-04-04T09:00:00Z', 'completed', 'Booking confirmed with Hapag-Lloyd. Reefer container reserved.'),

-- SMP-005 China → UAE | at_risk critical: in transit, risk flagged
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000005', 'booked',          'Shipment Booked',                     'China',              '2026-03-01T08:00:00Z', 'completed', 'Booking confirmed with COSCO.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000005', 'customs_filed',   'China Export Customs Filed',          'Shanghai',           '2026-03-03T10:00:00Z', 'completed', 'Chinese customs clearance pending final OFAC review.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000005', 'at_origin_port',  'At Shanghai Port',                    'Shanghai',           '2026-03-04T07:00:00Z', 'completed', 'Hazardous cargo loaded per IMDG code.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000005', 'departed',        'Departed Shanghai',                   'Shanghai',           '2026-03-05T20:00:00Z', 'completed', 'COSCO vessel departed. Compliance hold advisory issued.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000005', 'transshipment',   'Compliance Hold — OFAC Screening',    'Indian Ocean',       '2026-03-22T09:00:00Z', 'active',    'Compliance team escalation active. OFAC screening of consignee in progress. Shipment flagged at risk.'),

-- SMP-006 Netherlands → South Africa | in_transit: mid-ocean with congestion signal
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000006', 'booked',          'Shipment Booked',                     'Netherlands',        '2026-03-12T08:00:00Z', 'completed', 'Booking confirmed with Maersk. Flat rack arranged.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000006', 'customs_filed',   'Netherlands Export Customs Filed',    'Rotterdam',          '2026-03-14T10:00:00Z', 'completed', 'EU export clearance complete.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000006', 'at_origin_port',  'At Rotterdam Port',                   'Rotterdam',          '2026-03-15T07:00:00Z', 'completed', 'OOG flat rack loaded. Special lashing certified.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000006', 'departed',        'Departed Rotterdam',                  'Rotterdam',          '2026-03-16T14:00:00Z', 'completed', 'Vessel departed for Durban via Canary Islands.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000006', 'transshipment',   'In Transit — Atlantic Ocean',         'Atlantic Ocean',     '2026-04-01T09:00:00Z', 'active',    'On schedule. Durban port congestion advisory in effect — 3–5 day delay on arrival expected.'),

-- SMP-007 India → Japan | delivered: all events completed with realistic dates
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000007', 'booked',          'Shipment Booked',                     'India',              '2026-02-01T08:00:00Z', 'completed', 'Booking confirmed with ONE Line.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000007', 'customs_filed',   'India Export Customs Cleared',        'Mundra',             '2026-02-03T10:00:00Z', 'completed', 'Export clearance complete. Shipping bill issued.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000007', 'at_origin_port',  'At Mundra Port',                      'Mundra',             '2026-02-05T07:00:00Z', 'completed', 'Container loaded and sealed.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000007', 'departed',        'Departed Mundra',                     'Mundra',             '2026-02-06T16:00:00Z', 'completed', 'Vessel departed for Singapore transshipment.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000007', 'transshipment',   'Transshipment — Singapore',           'Singapore',          '2026-02-18T09:00:00Z', 'completed', 'Transshipped at Singapore PSA to Japan direct service.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000007', 'arrived_destination', 'Arrived Tokyo Port',              'Tokyo',              '2026-03-08T07:00:00Z', 'completed', 'Vessel berthed at Tokyo. Japan Customs notified.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000007', 'customs_clearance', 'Japan Import Customs Cleared',      'Tokyo',              '2026-03-10T14:00:00Z', 'completed', 'Japan customs cleared same day. No issues.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000007', 'out_for_delivery', 'Out for Delivery',                   'Tokyo',              '2026-03-14T08:00:00Z', 'completed', 'Final mile delivery dispatched.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000007', 'delivered',       'Delivered to Consignee',              'Tokyo',              '2026-03-15T11:00:00Z', 'completed', 'Delivered to Japan Trade Partners KK. POD signed.'),

-- SMP-008 Bangladesh → UK | booked: only booking event
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000008', 'booked',          'Shipment Booked',                     'Bangladesh',         '2026-04-05T08:00:00Z', 'completed', 'MSC booking confirmed. CoO correction in progress.'),

-- SMP-009 Vietnam → France | in_transit: mid-ocean, low carbon
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000009', 'booked',          'Shipment Booked',                     'Vietnam',            '2026-03-18T08:00:00Z', 'completed', 'CMA CGM booking confirmed. LCL consolidation arranged.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000009', 'customs_filed',   'Vietnam Export Customs Filed',        'Ho Chi Minh City',   '2026-03-20T10:00:00Z', 'completed', 'Vietnam customs cleared. EUR.1 certificate issued.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000009', 'at_origin_port',  'At Ho Chi Minh City Port',            'Ho Chi Minh City',   '2026-03-21T07:00:00Z', 'completed', 'LCL cargo consolidated and loaded.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000009', 'departed',        'Departed Ho Chi Minh City',           'Ho Chi Minh City',   '2026-03-22T14:00:00Z', 'completed', 'CMA CGM vessel departed via Cape of Good Hope.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000009', 'transshipment',   'In Transit — Indian Ocean',           'Indian Ocean',       '2026-04-05T09:00:00Z', 'active',    'On schedule. Low-carbon load factor tracking nominal.'),

-- SMP-010 Turkey → US | delayed: stuck at transshipment / CBP hold
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000010', 'booked',          'Shipment Booked',                     'Turkey',             '2026-02-15T08:00:00Z', 'completed', 'MSC booking confirmed.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000010', 'customs_filed',   'Turkey Export Customs Filed',         'Istanbul',           '2026-02-17T10:00:00Z', 'completed', 'Turkish customs export declaration filed.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000010', 'at_origin_port',  'At Istanbul Port',                    'Istanbul',           '2026-02-18T07:00:00Z', 'completed', 'Container loaded.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000010', 'departed',        'Departed Istanbul',                   'Istanbul',           '2026-02-20T16:00:00Z', 'completed', 'Vessel departed via Mediterranean and Atlantic.'),
(gen_random_uuid(), 'a1000001-0000-4000-8000-000000000010', 'transshipment',   'Delayed — CBP AD/CVD Hold',           'Atlantic Ocean',     '2026-03-25T09:00:00Z', 'active',    'US CBP anti-dumping review triggered on HS 7308.10 structural steel. Shipment delayed pending AD case resolution. Section 232 tariff exclusion review in progress.');
