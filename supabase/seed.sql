-- Fictional Kaimai Valley Dairy: a milk powder site at Matamata (NZ) and a cheese site at
-- Toowoomba (AU). Dates move with today, so the demo always has something to say:
-- a certificate lapsed after a failed inspection, a boiler past its internal, a shell under
-- its required thickness, a relief valve that failed its bench test, and a vessel whose
-- written scheme runs past half its remaining life. Safe to run twice.

insert into settings(key, value, unit, note) values
  ('max_internal_years', 10, 'years', 'Ceiling on any internal inspection interval (API 510 6.5.1.1)'),
  ('half_life_factor', 0.5, 'of remaining life', 'Next internal no later than this share of the remaining life (API 510 6.5.1.1)'),
  ('prv_months_typical', 60, 'months', 'Relief valve test interval, typical service, when the valve has none of its own (API 510 6.6.3.2 maximum)'),
  ('prv_months_clean', 120, 'months', 'Relief valve test interval, clean nonfouling noncorrosive service (API 510 6.6.3.2 maximum)'),
  ('cert_levels_through', 4, 'A=1 .. E=5', 'Hazard levels that need a certificate of inspection: 4 means A to D. Confirm with your inspection body'),
  ('warn_days_certificate', 60, 'days', 'Flag a certificate this many days before it expires'),
  ('warn_days_internal', 90, 'days', 'Flag an internal inspection this many days ahead, to book the outage'),
  ('warn_days_external', 60, 'days', 'Flag an external inspection this many days ahead'),
  ('warn_days_valve', 45, 'days', 'Flag a relief valve test this many days ahead'),
  ('warn_days_anomaly', 30, 'days', 'Flag an open anomaly this many days before its due date'),
  ('warn_remaining_life_yrs', 4, 'years', 'Flag a monitoring point with less remaining life than this')
on conflict (key) do nothing;

insert into sites(code, name, country, inspection_body) values
  ('MAT', 'Matamata milk powder site', 'NZ', 'Waikato Plant Inspection Ltd'),
  ('TBA', 'Toowoomba cheese site', 'AU', 'Darling Downs Plant Inspection')
on conflict (code) do nothing;

insert into equipment(code, site_id, name, kind, hazard_level, fluid, design_pressure_kpa, design_temp_c, manufacturer, serial_no, year_built, design_registration, item_registration, in_service_on, internal_interval_months, external_interval_months)
select v.code, s.id, v.name, v.kind, v.hz, v.fluid, v.p, v.t, v.mfr, v.sn, v.yr, v.dreg, v.ireg, (current_date - v.age)::date, v.im, v.em
from (values
  ('BLR-01', 'MAT', 'Package fire-tube steam boiler', 'boiler', 'A', 'steam', 1400, 198, 'Thermon Boilers', 'TB-4471', 2009, null, null, 5800, 12, 12),
  ('V-101', 'MAT', 'Steam accumulator', 'pressure vessel', 'B', 'steam', 1200, 192, 'Hutt Fabrication', 'HF-2290', 2011, null, null, 5100, 48, 24),
  ('V-102', 'MAT', 'Ammonia high pressure receiver', 'refrigeration vessel', 'B', 'ammonia', 2100, 50, 'Coldline Engineering', 'CE-0815', 2008, null, null, 6100, 48, 24),
  ('AR-01', 'MAT', 'Plant air receiver', 'air receiver', 'C', 'air', 1000, 50, 'Pacific Air Systems', 'PA-7733', 2012, null, null, 4900, 48, 24),
  ('AR-02', 'MAT', 'Dryer instrument air receiver', 'air receiver', 'D', 'air', 1000, 50, 'Pacific Air Systems', 'PA-8120', 2015, null, null, 3900, 60, 24),
  ('E-201', 'MAT', 'Evaporator calandria, steam side', 'heat exchanger', 'B', 'steam', 300, 140, 'Dairy Process Engineering', 'DPE-551', 2010, null, null, 5400, 48, 24),
  ('BLR-11', 'TBA', 'Water-tube steam boiler', 'boiler', 'A', 'steam', 2500, 225, 'Southern Cross Boilers', 'SCB-1904', 2014, 'B-DR-20115', 'B-IR-30882', 4200, 12, 12),
  ('V-111', 'TBA', 'Boiler feed deaerator', 'pressure vessel', 'B', 'water and steam', 200, 120, 'Southern Cross Boilers', 'SCB-1905', 2014, 'PV-DR-20116', 'PV-IR-30883', 4200, 48, 24),
  ('AR-11', 'TBA', 'Plant air receiver', 'air receiver', 'C', 'air', 1000, 50, 'Pacific Air Systems', 'PA-9011', 2016, null, 'PV-IR-31020', 3500, 48, 24),
  ('V-112', 'TBA', 'Ammonia receiver', 'refrigeration vessel', 'B', 'ammonia', 2100, 50, 'Coldline Engineering', 'CE-1140', 2016, 'PV-DR-20410', null, 3500, 48, 24)
) v(code, site, name, kind, hz, fluid, p, t, mfr, sn, yr, dreg, ireg, age, im, em)
join sites s on s.code = v.site
on conflict (code) do nothing;

insert into inspections(code, equipment_id, kind, done_on, inspector, inspection_body, result, findings, report_ref)
select v.code, e.id, v.kind, (current_date - v.ago)::date, v.who, v.body, v.result, v.findings, v.ref
from (values
  ('I-0101', 'BLR-01', 'internal', 340, 'R. Tane', 'Waikato Plant Inspection Ltd', 'pass', 'Fire side clean, no wastage at the tube plates', 'WPI-24-118'),
  ('I-0102', 'BLR-01', 'external', 340, 'R. Tane', 'Waikato Plant Inspection Ltd', 'pass', null, 'WPI-24-119'),
  ('I-0103', 'V-101', 'internal', 730, 'R. Tane', 'Waikato Plant Inspection Ltd', 'pass with conditions', 'Wall loss below the steam inlet at CML-03: thickness check in 18 months', 'WPI-23-077'),
  ('I-0104', 'V-101', 'external', 700, 'R. Tane', 'Waikato Plant Inspection Ltd', 'pass', null, 'WPI-23-081'),
  ('I-0105', 'V-101', 'thickness', 60, 'K. Ngata', 'Waikato Plant Inspection Ltd', 'pass with conditions', 'CML-03 down another 0.8 mm', 'WPI-25-210'),
  ('I-0106', 'V-102', 'internal', 1300, 'R. Tane', 'Waikato Plant Inspection Ltd', 'pass', null, 'WPI-21-040'),
  ('I-0107', 'V-102', 'external', 690, 'K. Ngata', 'Waikato Plant Inspection Ltd', 'pass with conditions', 'Pitting at the lower shell to head weld, under insulation', 'WPI-23-090'),
  ('I-0108', 'AR-01', 'internal', 800, 'K. Ngata', 'Waikato Plant Inspection Ltd', 'pass', null, 'WPI-23-031'),
  ('I-0109', 'AR-01', 'external', 12, 'K. Ngata', 'Waikato Plant Inspection Ltd', 'fail', 'Corrosion at the drain connection and wall loss at the bottom head', 'WPI-25-266'),
  ('I-0110', 'AR-02', 'internal', 1400, 'R. Tane', 'Waikato Plant Inspection Ltd', 'pass', null, 'WPI-21-002'),
  ('I-0111', 'AR-02', 'external', 790, 'R. Tane', 'Waikato Plant Inspection Ltd', 'pass', null, 'WPI-23-020'),
  ('I-0112', 'E-201', 'internal', 900, 'R. Tane', 'Waikato Plant Inspection Ltd', 'pass', null, 'WPI-22-140'),
  ('I-0113', 'E-201', 'external', 600, 'K. Ngata', 'Waikato Plant Inspection Ltd', 'pass', null, 'WPI-23-150'),
  ('I-0114', 'E-201', 'thickness', 20, 'K. Ngata', 'Waikato Plant Inspection Ltd', 'pass with conditions', 'Shell CML-02 under the required thickness', 'WPI-25-280'),
  ('I-0201', 'BLR-11', 'internal', 385, 'D. Walsh', 'Darling Downs Plant Inspection', 'pass', null, 'DDPI-1192'),
  ('I-0202', 'BLR-11', 'external', 385, 'D. Walsh', 'Darling Downs Plant Inspection', 'pass', null, 'DDPI-1193'),
  ('I-0203', 'V-111', 'internal', 600, 'D. Walsh', 'Darling Downs Plant Inspection', 'pass', null, 'DDPI-1031'),
  ('I-0204', 'V-111', 'external', 600, 'D. Walsh', 'Darling Downs Plant Inspection', 'pass', null, 'DDPI-1032'),
  ('I-0205', 'AR-11', 'internal', 400, 'D. Walsh', 'Darling Downs Plant Inspection', 'pass', null, 'DDPI-1170'),
  ('I-0206', 'AR-11', 'external', 400, 'D. Walsh', 'Darling Downs Plant Inspection', 'pass', null, 'DDPI-1171'),
  ('I-0207', 'V-112', 'internal', 500, 'D. Walsh', 'Darling Downs Plant Inspection', 'pass', null, 'DDPI-1101'),
  ('I-0208', 'V-112', 'external', 500, 'D. Walsh', 'Darling Downs Plant Inspection', 'pass', null, 'DDPI-1102')
) v(code, eq, kind, ago, who, body, result, findings, ref)
join equipment e on e.code = v.eq
on conflict (code) do nothing;

insert into cmls(equipment_id, code, location, nominal_mm, required_mm)
select e.id, v.code, v.loc, v.nom, v.req
from (values
  ('V-101', 'CML-01', 'Shell, mid course', 12.5, 9.5),
  ('V-101', 'CML-02', 'Bottom head', 14.0, 11.0),
  ('V-101', 'CML-03', 'Shell below the steam inlet', 12.5, 9.5),
  ('V-102', 'CML-01', 'Shell, lower course', 16.0, 12.0),
  ('AR-01', 'CML-01', 'Bottom head at the drain', 8.0, 5.5),
  ('E-201', 'CML-01', 'Shell, upper course', 8.0, 6.0),
  ('E-201', 'CML-02', 'Shell, lower course at the condensate outlet', 8.0, 6.0),
  ('BLR-11', 'CML-01', 'Steam drum', 25.0, 20.0)
) v(eq, code, loc, nom, req)
join equipment e on e.code = v.eq
on conflict (equipment_id, code) do nothing;

insert into readings(cml_id, measured_on, thickness_mm)
select c.id, (current_date - v.ago)::date, v.mm
from (values
  ('V-101', 'CML-01', 2190, 12.10), ('V-101', 'CML-01', 730, 12.00), ('V-101', 'CML-01', 60, 11.95),
  ('V-101', 'CML-02', 2190, 14.00), ('V-101', 'CML-02', 730, 13.90), ('V-101', 'CML-02', 60, 13.90),
  ('V-101', 'CML-03', 2190, 12.40), ('V-101', 'CML-03', 730, 11.40), ('V-101', 'CML-03', 60, 10.60),
  ('V-102', 'CML-01', 3000, 16.00), ('V-102', 'CML-01', 1300, 15.80),
  ('AR-01', 'CML-01', 2500, 7.80), ('AR-01', 'CML-01', 800, 7.20), ('AR-01', 'CML-01', 12, 6.40),
  ('E-201', 'CML-01', 2000, 7.90), ('E-201', 'CML-01', 900, 7.60), ('E-201', 'CML-01', 20, 7.40),
  ('E-201', 'CML-02', 2000, 7.60), ('E-201', 'CML-02', 900, 6.90), ('E-201', 'CML-02', 20, 5.80),
  ('BLR-11', 'CML-01', 1800, 24.80), ('BLR-11', 'CML-01', 385, 24.60)
) v(eq, cml, ago, mm)
join equipment e on e.code = v.eq
join cmls c on c.equipment_id = e.id and c.code = v.cml
on conflict (cml_id, measured_on) do nothing;

insert into relief_valves(code, equipment_id, set_pressure_kpa, size, service, interval_months, installed_on)
select v.code, e.id, v.setp, v.size, v.service, v.im, (current_date - v.age)::date
from (values
  ('PSV-001A', 'BLR-01', 1400, 'DN50', 'typical', 12, 3000),
  ('PSV-001B', 'BLR-01', 1400, 'DN50', 'typical', 12, 3000),
  ('PSV-101', 'V-101', 1200, 'DN40', 'typical', null, 5100),
  ('PSV-102', 'V-102', 2100, 'DN25', 'typical', null, 6100),
  ('PSV-AR1', 'AR-01', 1000, 'DN20', 'clean', null, 4900),
  ('PSV-AR2', 'AR-02', 1000, 'DN15', 'clean', null, 3900),
  ('PSV-E201', 'E-201', 300, 'DN80', 'typical', 24, 5400),
  ('PSV-011', 'BLR-11', 2500, 'DN65', 'typical', 12, 4200),
  ('PSV-112', 'V-112', 2100, 'DN25', 'typical', null, 3500),
  ('PSV-AR11', 'AR-11', 1100, 'DN20', 'clean', null, 3500)
) v(code, eq, setp, size, service, im, age)
join equipment e on e.code = v.eq
on conflict (code) do nothing;

insert into valve_tests(valve_id, tested_on, pop_kpa, result, tested_by, report_ref)
select r.id, (current_date - v.ago)::date, v.pop, v.result, v.who, v.ref
from (values
  ('PSV-001A', 340, 1395, 'pass', 'Valve Services Waikato', 'VSW-3301'),
  ('PSV-001B', 340, 1402, 'pass', 'Valve Services Waikato', 'VSW-3302'),
  ('PSV-001B', 10, 1530, 'fail', 'Valve Services Waikato', 'VSW-3655'),
  ('PSV-101', 1796, 1190, 'pass', 'Valve Services Waikato', 'VSW-2201'),
  ('PSV-102', 1866, 2080, 'pass', 'Valve Services Waikato', 'VSW-2150'),
  ('PSV-AR1', 400, 990, 'pass', 'Valve Services Waikato', 'VSW-3240'),
  ('PSV-AR2', 300, 1005, 'adjusted', 'Valve Services Waikato', 'VSW-3360'),
  ('PSV-E201', 500, 298, 'pass', 'Valve Services Waikato', 'VSW-3150'),
  ('PSV-011', 300, 2490, 'pass', 'Downs Valve and Gauge', 'DVG-0871'),
  ('PSV-112', 500, 2095, 'pass', 'Downs Valve and Gauge', 'DVG-0790'),
  ('PSV-AR11', 200, 1095, 'pass', 'Downs Valve and Gauge', 'DVG-0912')
) v(valve, ago, pop, result, who, ref)
join relief_valves r on r.code = v.valve
on conflict (valve_id, tested_on) do nothing;

insert into certificates(equipment_id, cert_no, issued_on, expires_on, issued_by, conditions)
select e.id, v.no, (current_date - v.issued)::date, (current_date + v.expires)::date, v.body, v.cond
from (values
  ('BLR-01', 'WPI-C-24-118', 340, 25, 'Waikato Plant Inspection Ltd', null),
  ('V-101', 'WPI-C-23-077', 730, 700, 'Waikato Plant Inspection Ltd', 'Thickness check at CML-03 within 18 months'),
  ('V-102', 'WPI-C-21-040', 1300, 400, 'Waikato Plant Inspection Ltd', null),
  ('AR-01', 'WPI-C-23-031', 800, -12, 'Waikato Plant Inspection Ltd', null),
  ('E-201', 'WPI-C-22-140', 900, 560, 'Waikato Plant Inspection Ltd', null),
  ('BLR-11', 'DDPI-C-1192', 385, 200, 'Darling Downs Plant Inspection', null),
  ('V-111', 'DDPI-C-1031', 600, 800, 'Darling Downs Plant Inspection', null),
  ('AR-11', 'DDPI-C-1170', 400, 900, 'Darling Downs Plant Inspection', null),
  ('V-112', 'DDPI-C-1101', 500, 1000, 'Darling Downs Plant Inspection', null)
) v(eq, no, issued, expires, body, cond)
join equipment e on e.code = v.eq
on conflict (cert_no) do nothing;

insert into anomalies(code, equipment_id, inspection_id, raised_on, description, severity, due_on, closed_on, closed_ref)
select v.code, e.id, i.id, (current_date - v.raised)::date, v.descr, v.sev, (current_date + v.due)::date, case when v.closed is not null then (current_date - v.closed)::date end, v.ref
from (values
  ('A-005', 'BLR-11', null, 230, 'Gauge glass cracked', 'medium', -220, 200, 'WO-4410'),
  ('A-007', 'V-102', 'I-0107', 60, 'Pitting at the lower shell to head weld: remove insulation and assess', 'medium', -15, null, null),
  ('A-008', 'E-201', 'I-0114', 20, 'Shell CML-02 under required thickness: fitness-for-service assessment or repair', 'high', 10, null, null),
  ('A-009', 'AR-01', 'I-0109', 12, 'Drain connection corrosion: replace the drain and re-inspect before return to service', 'high', 5, null, null)
) v(code, eq, insp, raised, descr, sev, due, closed, ref)
join equipment e on e.code = v.eq
left join inspections i on i.code = v.insp
on conflict (code) do nothing;

insert into notes(equipment_id, body)
select e.id, v.body from (values
  ('AR-01', 'Inspector asked for the receiver to be isolated until the drain is replaced. Production says it is needed for the dryer start-up.'),
  ('V-101', 'Engineering suspects condensate impingement below the inlet. Baffle plate option to be priced for the next shutdown.')
) v(eq, body)
join equipment e on e.code = v.eq
where not exists (select 1 from notes n where n.equipment_id = e.id and n.body = v.body);
