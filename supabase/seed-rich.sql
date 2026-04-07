-- ─── CargoLens Rich Seed Data ─────────────────────────────────────────────────
-- 16 realistic shipments covering all backend model scenarios:
--   sanctions: low / medium / high / critical cases
--   customs readiness: clear / minor gaps / multiple issues
--   port congestion: low (Rotterdam) to severe (Lagos, Mombasa)
--   delay prediction: on-track / at-risk / delayed / critical
-- Run: paste into Supabase SQL editor

DELETE FROM shipments WHERE is_seeded = true;

INSERT INTO shipments (
  shipment_code, shipper_company, contact_name, email,
  origin_country, origin_port, destination_country, destination_port,
  consignee_name, cargo_category, hs_code, weight, volume, incoterm,
  shipment_mode, priority, expected_dispatch_date, declared_value, currency,
  status, risk_level, eta_date, corridor, carrier, carbon_kg,
  compliance_notes, notes, is_seeded
) VALUES

-- ── 1. India → EU — Cotton textiles, in_transit, medium risk (UFLPA) ─────────
('SHP-IN-EU-001',
 'Indra Textiles Ltd', 'Rajesh Kumar', 'rk@indratextiles.in',
 'India', 'Nhava Sheva', 'Netherlands', 'Rotterdam',
 'EuroFabrics B.V.', 'Fashion & Apparel', '6006.22',
 18500, 95.0, 'CIF', 'sea_fcl', 'balanced',
 CURRENT_DATE - INTERVAL '25 days', 285000, 'USD',
 'in_transit', 'medium',
 CURRENT_DATE + INTERVAL '8 days',
 'India → EU', 'Maersk', 4736,
 'Cotton sourced from Gujarat mills. UFLPA traceability documentation available upon request.',
 'FCL 40HQ. Red Sea rerouted via Cape. ETA revised +8 days.', true),

-- ── 2. UAE → East Africa — Electronics, customs_hold, high risk ──────────────
('SHP-UAE-KE-002',
 'Gulf Sourcing FZCO', 'Amina Al-Hassan', 'amina@gulfsourcing.ae',
 'UAE', 'Jebel Ali', 'Kenya', 'Mombasa',
 'Nairobi Tech Hub Ltd', 'Electronics & Technology', '8542.31',
 3200, 12.5, 'DAP', 'sea_lcl', 'urgent',
 CURRENT_DATE - INTERVAL '30 days', 480000, 'USD',
 'customs_hold', 'high',
 CURRENT_DATE - INTERVAL '3 days',
 'UAE → East Africa', 'MSC', 384,
 'KRA pre-shipment inspection pending. Dual-use classification under review. Certificate of conformity mismatch with HS code declared.',
 'LCL consolidation. KRA hold since 22 Mar. Consignee notified.', true),

-- ── 3. SE Asia → Europe — Semiconductors, booked, low risk ──────────────────
('SHP-SG-NL-003',
 'SingTech Components Pte Ltd', 'Wei Liang', 'wliang@singtech.sg',
 'Singapore', 'Singapore Port', 'Germany', 'Hamburg',
 'MünchTech GmbH', 'Electronics & Technology', '8542.31',
 4800, 22.0, 'FOB', 'sea_fcl', 'balanced',
 CURRENT_DATE + INTERVAL '8 days', 1250000, 'USD',
 'booked', 'low',
 CURRENT_DATE + INTERVAL '48 days',
 'SE Asia → Europe', 'Evergreen', 9360,
 'BIS export license confirmed. EU dual-use declaration filed. No CBAM exposure for semiconductors at current classification.',
 'Booking confirmed. Container allocation secured with Evergreen.', true),

-- ── 4. India → US — Pharma API, delayed, critical risk ──────────────────────
('SHP-IN-US-004',
 'BioSynth Pharma Pvt Ltd', 'Dr. Priya Patel', 'ppatel@biosynth.in',
 'India', 'Chennai', 'United States', 'Los Angeles / Long Beach',
 'PharmaCorp USA Inc', 'Pharmaceutical & Life Sciences', '2941.90',
 2100, 8.2, 'CIP', 'sea_fcl', 'urgent',
 CURRENT_DATE - INTERVAL '35 days', 3200000, 'USD',
 'delayed', 'critical',
 CURRENT_DATE + INTERVAL '5 days',
 'India → US', 'Hapag-Lloyd', 2688,
 'FDA prior notice filed (PRN-2025-0234781). UFLPA supply chain audit complete. Vessel diverted: Cape reroute adds 11 days. Consignee flagged for enhanced due diligence.',
 'Temperature-controlled 20ft reefer. Delayed 11 days due to Red Sea reroute.', true),

-- ── 5. China → US — Consumer electronics, at_risk, high risk ────────────────
('SHP-CN-US-005',
 'Shenzhen ElectroWorld Co Ltd', 'Lin Wei', 'lin@electroworld.cn',
 'China', 'Shenzhen / Yantian', 'United States', 'Los Angeles / Long Beach',
 'BestBuy Imports LLC', 'Electronics & Technology', '8471.30',
 22000, 110.0, 'FOB', 'sea_fcl', 'balanced',
 CURRENT_DATE - INTERVAL '18 days', 5600000, 'USD',
 'at_risk', 'high',
 CURRENT_DATE + INTERVAL '6 days',
 'China → US', 'COSCO', 19360,
 'Section 301 tariff 25% applies. Trans-Pacific vessel delayed 5 days — port congestion at LA. US CBP ISF filed. Anti-dumping duty bond active.',
 '5x40HC containers. Tariff bond posted. LA congestion advisory active.', true),

-- ── 6. Netherlands → Nigeria — Machinery, in_transit, low risk ──────────────
('SHP-NL-NG-006',
 'Rotterdam Machinery BV', 'Pieter Van Dam', 'pvandam@rtm-mach.nl',
 'Netherlands', 'Rotterdam', 'Nigeria', 'Lagos Apapa',
 'Lagos Industrial Corp', 'Machinery & Industrial Equipment', '8457.10',
 38000, 180.0, 'CFR', 'sea_fcl', 'low-cost',
 CURRENT_DATE - INTERVAL '22 days', 920000, 'USD',
 'in_transit', 'low',
 CURRENT_DATE + INTERVAL '12 days',
 'Europe → Africa', 'MSC', 11552,
 'NAFDAC import permit obtained. SON pre-shipment inspection certificate issued. No dual-use classification.',
 '2x40HC. Nigeria customs pre-lodgement done. Lagos Apapa high dwell time expected.', true),

-- ── 7. India → UAE — Textiles, delivered, clear ──────────────────────────────
('SHP-IN-UAE-007',
 'Mumbai Export House', 'Sanjay Shah', 'sshah@mumbai-exports.in',
 'India', 'Nhava Sheva', 'UAE', 'Jebel Ali',
 'Dubai Trading LLC', 'Fashion & Apparel', '6204.62',
 6200, 31.0, 'FOB', 'sea_lcl', 'balanced',
 CURRENT_DATE - INTERVAL '38 days', 125000, 'USD',
 'delivered', 'low',
 CURRENT_DATE - INTERVAL '10 days',
 'India → Middle East', 'DP World / MSC', 744,
 'All documentation clear. UAE customs cleared without issues. No compliance flags.',
 'Delivered on schedule. KPI green. 100% condition.', true),

-- ── 8. Bangladesh → Netherlands — Garments, in_transit, medium risk ──────────
('SHP-BD-NL-008',
 'Dhaka Garment Industries Ltd', 'Farhan Ahmed', 'fahmed@dgi.bd',
 'Bangladesh', 'Chittagong', 'Netherlands', 'Antwerp',
 'H&M Logistics B.V.', 'Fashion & Apparel', '6204.43',
 28000, 140.0, 'FOB', 'sea_fcl', 'low-cost',
 CURRENT_DATE - INTERVAL '20 days', 420000, 'USD',
 'in_transit', 'medium',
 CURRENT_DATE + INTERVAL '14 days',
 'SE Asia → Europe', 'Maersk', 10640,
 'EU EBA zero-duty certificate attached. ILO GSP+ compliance verified. Red Sea rerouted via Cape of Good Hope.',
 'FCL 40HC x3. EBA Form A attached. Cape reroute +9 days vs original ETA.', true),

-- ── 9. China → Germany — Machinery dual-use, customs_hold, critical ──────────
('SHP-CN-DE-009',
 'Chengdu Industrial Tech Co', 'Zhang Wei', 'zhang@chengdu-ind.cn',
 'China', 'Shanghai', 'Germany', 'Hamburg',
 'Siemens AG Import Logistics', 'Machinery & Industrial Equipment', '8543.70',
 14500, 68.0, 'CIF', 'sea_fcl', 'balanced',
 CURRENT_DATE - INTERVAL '28 days', 2800000, 'USD',
 'customs_hold', 'critical',
 CURRENT_DATE + INTERVAL '10 days',
 'China → EU', 'COSCO', 24360,
 'German customs dual-use review initiated (AWG Section 8). BIS export license pending evaluation. CBAM carbon content declaration required. EU anti-dumping deposit posted at EUR 180/MT.',
 'Held by Bundeszollamt Hamburg for dual-use verification. Legal team engaged.', true),

-- ── 10. Singapore → USA — Chemicals, booked, low risk ───────────────────────
('SHP-SG-US-010',
 'ChemAsia Pte Ltd', 'Mei Lin Tan', 'mltan@chemasia.sg',
 'Singapore', 'Singapore Port', 'United States', 'Houston',
 'Dow Chemical Imports USA', 'Chemicals & Petrochemicals', '2902.90',
 45000, 85.0, 'DDP', 'sea_fcl', 'balanced',
 CURRENT_DATE + INTERVAL '15 days', 580000, 'USD',
 'booked', 'low',
 CURRENT_DATE + INTERVAL '52 days',
 'SE Asia → US', 'ONE', 28800,
 'US-Singapore FTA Form E certificate ready. TSCA compliance confirmed. IMO DG pack group III declaration filed. EPA import notice submitted.',
 'ISO tank container x3. Booking confirmed ONE liner. All DG docs in order.', true),

-- ── 11. Vietnam → USA — Furniture AD/CVD, in_transit, high risk ─────────────
('SHP-VN-US-011',
 'Hanoi Furniture Exports JSC', 'Nguyen Van An', 'vanan@hanoifurn.vn',
 'Vietnam', 'Ho Chi Minh City', 'United States', 'Los Angeles / Long Beach',
 'IKEA North America LLC', 'Consumer Goods', '9403.30',
 35000, 220.0, 'FOB', 'sea_fcl', 'balanced',
 CURRENT_DATE - INTERVAL '15 days', 750000, 'USD',
 'in_transit', 'high',
 CURRENT_DATE + INTERVAL '15 days',
 'SE Asia → US', 'Evergreen', 30800,
 'US CBP anti-circumvention investigation active on wooden furniture. AD/CVD cash deposit posted at 8.24%. Vietnamese Form B origin certificate provided. Trans-shipping verification complete.',
 'FCL 40HC x4. AD/CVD bond active. CBP may request additional documentation at arrival.', true),

-- ── 12. India → Tanzania — FMCG, at_risk, medium risk (monsoon) ─────────────
('SHP-IN-TZ-012',
 'Ahmedabad FMCG Exporters', 'Kiran Patel', 'kpatel@ahm-fmcg.in',
 'India', 'Mundra', 'Tanzania', 'Dar es Salaam',
 'Dar Commercial Trading Co', 'Fast-Moving Consumer Goods (FMCG)', '2103.90',
 8500, 42.0, 'CIF', 'sea_lcl', 'low-cost',
 CURRENT_DATE - INTERVAL '12 days', 185000, 'USD',
 'at_risk', 'medium',
 CURRENT_DATE + INTERVAL '8 days',
 'India → East Africa', 'MSC', 1020,
 'Tanzania Revenue Authority (TRA) import permit obtained. EAC Certificate of Origin filed. Indian Ocean monsoon swell advisory issued — Dar es Salaam approach delay risk.',
 'LCL consolidation. Monsoon risk flagged by captain. Port congestion at Dar es Salaam severe.', true),

-- ── 13. China → UAE — Steel, in_transit, medium risk ────────────────────────
('SHP-CN-UAE-013',
 'Tianjin Steel Export Corp', 'Li Jian', 'ljian@tjsteel.cn',
 'China', 'Tianjin', 'UAE', 'Jebel Ali',
 'Emirates Steel FZC', 'Bulk Commodities', '7208.51',
 85000, 170.0, 'CFR', 'sea_fcl', 'low-cost',
 CURRENT_DATE - INTERVAL '18 days', 3400000, 'USD',
 'in_transit', 'medium',
 CURRENT_DATE + INTERVAL '9 days',
 'China → Middle East', 'COSCO', 4080,
 'UAE anti-dumping duty on Chinese steel active (AED 180/MT). Carbon content declaration required per UAE Customs Circular 2024. Certificate of origin form F attached.',
 '2,400 MT hot-rolled coil. Carbon content declaration filed.', true),

-- ── 14. Brazil → Netherlands — Coffee, booked, clear ────────────────────────
('SHP-BR-NL-014',
 'Santos Coffee Exporters SA', 'Carlos Mendes', 'cmendes@santoscoffee.br',
 'Brazil', 'Santos', 'Netherlands', 'Rotterdam',
 'Douwe Egberts Procurement B.V.', 'Fresh Produce & Perishables', '0901.11',
 18000, 90.0, 'CIF', 'sea_fcl', 'low-cost',
 CURRENT_DATE + INTERVAL '5 days', 1890000, 'USD',
 'booked', 'low',
 CURRENT_DATE + INTERVAL '47 days',
 'South America → EU', 'Maersk', 23040,
 'EU phytosanitary certificate required (EC 2017/625). Organic certification attached (ECOCERT). No CBAM exposure for unprocessed agricultural goods.',
 'Bulk green coffee in jumbo bags. 18 FCL 40HC. Organic cert valid.', true),

-- ── 15. South Africa → Germany — Minerals, delayed, high risk ───────────────
('SHP-ZA-DE-015',
 'Durban Minerals Export Ltd', 'James Nkosi', 'jnkosi@durban-min.za',
 'South Africa', 'Durban', 'Germany', 'Hamburg',
 'BASF Materials Import GmbH', 'Bulk Commodities', '2615.10',
 65000, 130.0, 'FOB', 'sea_fcl', 'balanced',
 CURRENT_DATE - INTERVAL '42 days', 8500000, 'USD',
 'delayed', 'high',
 CURRENT_DATE + INTERVAL '7 days',
 'Europe → Africa', 'MSC', 55640,
 'Transnet port strike delay — 8 days berth wait at Durban. German Einfuhranmeldung pre-lodged. REACH compliance for mineral compounds confirmed. No conflict minerals flag.',
 'Titanium ore concentrate. Transnet strike added 8 days to loading.', true),

-- ── 16. India → UK — Auto parts, in_transit, low risk (air) ─────────────────
('SHP-IN-UK-016',
 'Pune Auto Components Pvt Ltd', 'Vikram Joshi', 'vjoshi@puneauto.in',
 'India', 'Nhava Sheva', 'United Kingdom', 'Felixstowe',
 'Jaguar Land Rover Supply Chain Ltd', 'Automotive & Spare Parts', '8708.99',
 1200, 4.8, 'DAP', 'air_express', 'urgent',
 CURRENT_DATE - INTERVAL '2 days', 2100000, 'USD',
 'in_transit', 'low',
 CURRENT_DATE + INTERVAL '1 days',
 'India → EU', 'Emirates SkyCargo', 2640,
 'UK DCTS preferential duty confirmed (Form A). Post-Brexit UK customs entry filed via CDS. HMRC CHIEF pre-lodgement complete. No Modern Slavery Act risk identified in supply chain audit.',
 'Air charter — JLR production line critical part. Dubai hub transit confirmed.', true);
