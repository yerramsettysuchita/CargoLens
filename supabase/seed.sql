-- ─── CargoLens — 50 Seeded Shipments (DISABLED) ──────────────────────────────
-- Seeding is disabled. App starts with zero shipments.
-- All shipments are created by users through the website.
-- To re-enable for demo purposes, uncomment the insert below.

/* DISABLED
insert into public.shipments (
  user_id,
  shipment_code,
  shipper_company,
  contact_name,
  email,
  origin_country,
  origin_port,
  destination_country,
  destination_port,
  consignee_name,
  cargo_category,
  hs_code,
  weight,
  volume,
  incoterm,
  shipment_mode,
  priority,
  expected_dispatch_date,
  declared_value,
  currency,
  status,
  risk_level,
  eta_date,
  corridor,
  carrier,
  carbon_kg,
  compliance_notes,
  notes,
  is_seeded
)
select
  null,
  'SHP-' || lpad(gs::text, 3, '0'),
  (array[
    'BlueWave Textiles','Desert Global Trade','EuroMach Systems','Apex Pharma Export',
    'GreenHarvest Foods','Nova Consumer Goods','TransAsia Components','Gulf Bridge Logistics',
    'Horizon Chemicals','Atlas Industrial Supply'
  ])[1 + (gs % 10)],
  (array[
    'Aarav Shah','Maya Nair','Omar Hassan','Lina Joseph','Ravi Menon',
    'Fatima Noor','Daniel George','Sara Khan','Karan Patel','Nadia Ali'
  ])[1 + (gs % 10)],
  'ops' || gs || '@cargolens.app',
  (array['India','UAE','Singapore','China','Germany','Netherlands'])[1 + (gs % 6)],
  (array['Nhava Sheva','Jebel Ali','Singapore Port','Shanghai','Hamburg','Rotterdam'])[1 + (gs % 6)],
  (array['Netherlands','Kenya','Germany','United States','UAE','South Africa'])[1 + (gs % 6)],
  (array['Rotterdam','Mombasa','Hamburg','New York','Jebel Ali','Durban'])[1 + (gs % 6)],
  (array[
    'Euro Retail BV','Mombasa Trade Hub','Nordic Distribution GmbH',
    'Atlantic Imports LLC','Middle East Retail FZCO','Cape Supply Chain Ltd'
  ])[1 + (gs % 6)],
  (array['Textiles','Pharma','Electronics','Machinery','Food & Agri','Chemicals','Consumer Goods'])[1 + (gs % 7)],
  (array['5208','3004','8542','8479','1006','2901','6205'])[1 + (gs % 7)],
  1000 + (gs * 125),
  8 + (gs % 22),
  (array['FOB','CIF','DAP','EXW'])[1 + (gs % 4)],
  (array['sea','air','rail','multimodal'])[1 + (gs % 4)],
  (array['lowest_cost','fastest','balanced','low_carbon'])[1 + (gs % 4)],
  current_date + ((gs % 12) || ' days')::interval,
  15000 + (gs * 3200),
  (array['USD','EUR','INR','AED'])[1 + (gs % 4)],
  (array['draft','booked','in_transit','customs_hold','delayed','delivered','at_risk'])[1 + (gs % 7)],
  (array['low','medium','high','critical'])[1 + (gs % 4)],
  (current_date + ((gs % 20) || ' days')::interval)::date,
  (array[
    'India → EU','India → US','UAE → East Africa','SE Asia → Europe','China → Middle East','Europe → Africa'
  ])[1 + (gs % 6)],
  (array['Maersk','MSC','CMA CGM','Emirates SkyCargo','DB Schenker','DHL Global Forwarding'])[1 + (gs % 6)],
  180 + (gs * 14),
  (array[
    'No major compliance flags',
    'CBAM reporting exposure',
    'Section 301 tariff review',
    'Customs certificate mismatch risk',
    'UFLPA supplier traceability review',
    'Sanctions screening required'
  ])[1 + (gs % 6)],
  (array[
    'Priority account',
    'Monitor handoff at transshipment port',
    'Possible weather disruption window',
    'Customer requested tighter ETA',
    'Inspect docs before customs filing',
    'Watch carrier rollover risk'
  ])[1 + (gs % 6)],
  true
from generate_series(1, 50) as gs
on conflict (shipment_code) do nothing;
DISABLED */
