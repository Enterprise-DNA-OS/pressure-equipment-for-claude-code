-- Pressure Equipment for Claude Code: the register, inspections, thickness readings,
-- relief valves, certificates and anomalies of a plant that owns pressure equipment.
-- Runs on any Postgres 13+ and on PGlite. gen_random_uuid() is core from Postgres 13.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- The numbers every check uses. Set them from your written scheme of examination and
-- what your inspection body has agreed. The seeded values are demo values.
create table settings (
  key text primary key,
  value numeric not null,
  unit text not null default '',
  note text not null default '',
  updated_at timestamptz not null default now()
);

create table sites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  country text not null check (country in ('NZ','AU')),
  inspection_body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table equipment (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- the plant tag: V-101, BLR-01
  site_id uuid not null references sites(id),
  name text not null,
  kind text not null check (kind in ('pressure vessel','boiler','air receiver','heat exchanger','refrigeration vessel','autoclave','piping')),
  hazard_level text check (hazard_level in ('A','B','C','D','E')),   -- AS 4343
  fluid text,
  design_pressure_kpa numeric check (design_pressure_kpa > 0),
  design_temp_c numeric,
  manufacturer text,
  serial_no text,
  year_built int,
  design_registration text,                  -- AU: plant design registration number
  item_registration text,                    -- AU: plant item registration number
  in_service_on date,
  internal_interval_months int check (internal_interval_months > 0),
  external_interval_months int check (external_interval_months > 0),
  status text not null default 'in_service' check (status in ('in_service','out_of_service','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inspections (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  equipment_id uuid not null references equipment(id),
  kind text not null check (kind in ('internal','external','thickness','on-stream')),
  done_on date not null,
  inspector text,
  inspection_body text,
  result text not null check (result in ('pass','pass with conditions','fail')),
  findings text,
  report_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Condition monitoring locations: the points where wall thickness is measured.
create table cmls (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id),
  code text not null,
  location text not null,
  nominal_mm numeric not null check (nominal_mm > 0),
  required_mm numeric not null check (required_mm > 0),   -- minimum required thickness from the design calculation
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (equipment_id, code),
  check (required_mm < nominal_mm)
);

create table readings (
  id uuid primary key default gen_random_uuid(),
  cml_id uuid not null references cmls(id),
  measured_on date not null,
  thickness_mm numeric not null check (thickness_mm > 0),
  inspection_id uuid references inspections(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cml_id, measured_on)
);

create table relief_valves (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  equipment_id uuid not null references equipment(id),
  set_pressure_kpa numeric not null check (set_pressure_kpa > 0),
  size text,
  service text not null default 'typical' check (service in ('typical','clean')),   -- API 510 6.6.3.2: clean means nonfouling and noncorrosive
  interval_months int check (interval_months > 0),
  installed_on date,
  status text not null default 'in_service' check (status in ('in_service','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table valve_tests (
  id uuid primary key default gen_random_uuid(),
  valve_id uuid not null references relief_valves(id),
  tested_on date not null,
  pop_kpa numeric check (pop_kpa > 0),
  result text not null check (result in ('pass','adjusted','fail')),
  tested_by text,
  report_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (valve_id, tested_on)
);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id),
  cert_no text not null unique,
  issued_on date not null,
  expires_on date not null,
  issued_by text,
  conditions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on > issued_on)
);

create table anomalies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  equipment_id uuid not null references equipment(id),
  inspection_id uuid references inspections(id),
  raised_on date not null default current_date,
  description text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  due_on date,
  closed_on date,
  closed_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closed_on is null or closed_ref is not null)
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['settings','sites','equipment','inspections','cmls','readings','relief_valves','valve_tests','certificates','anomalies','notes'] loop
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

-- Inspection records, readings and valve tests are the history an inspection body
-- signs against. They are corrected with a new record, never deleted.
create or replace function keep_history() returns trigger language plpgsql as $$
begin raise exception '% records are history and cannot be deleted: add a correcting record instead', tg_table_name; end $$;
create trigger inspections_keep before delete on inspections for each row execute function keep_history();
create trigger readings_keep before delete on readings for each row execute function keep_history();
create trigger valve_tests_keep before delete on valve_tests for each row execute function keep_history();
create trigger certificates_keep before delete on certificates for each row execute function keep_history();

create or replace function setting(k text) returns numeric language sql stable as $$ select value from settings where key = k $$;

-- Corrosion at each monitoring point: long-term rate from the first reading, short-term
-- from the one before last, the higher governs (API 510 7.1.1), and the years left
-- before the wall reaches the required thickness.
create view v_cml_rates as
with r as (
  select cml_id, measured_on, thickness_mm,
    row_number() over (partition by cml_id order by measured_on) n_up,
    row_number() over (partition by cml_id order by measured_on desc) n_down
  from readings
), x as (
  select c.id cml_id, c.code cml, e.id equipment_id, e.code equipment, s.code site, c.location, c.nominal_mm, c.required_mm,
    f.measured_on first_on, f.thickness_mm first_mm, p.measured_on prev_on, p.thickness_mm prev_mm, l.measured_on last_on, l.thickness_mm last_mm,
    case when l.measured_on > f.measured_on then (f.thickness_mm - l.thickness_mm) / ((l.measured_on - f.measured_on) / 365.25) end lt,
    case when p.measured_on is not null then (p.thickness_mm - l.thickness_mm) / ((l.measured_on - p.measured_on) / 365.25) end st
  from cmls c
  join equipment e on e.id = c.equipment_id
  join sites s on s.id = e.site_id
  left join r f on f.cml_id = c.id and f.n_up = 1
  left join r l on l.cml_id = c.id and l.n_down = 1
  left join r p on p.cml_id = c.id and p.n_down = 2
)
select cml_id, cml, equipment_id, equipment, site, location, nominal_mm, required_mm, first_on, first_mm, prev_on, prev_mm, last_on, last_mm,
  round(lt, 3) long_term_mm_yr, round(st, 3) short_term_mm_yr,
  round(greatest(coalesce(lt, 0), coalesce(st, 0)), 3) rate_mm_yr,
  case when lt is null and st is null then null when coalesce(st, -1) > coalesce(lt, -1) then 'short term' else 'long term' end governs,
  round(last_mm - required_mm, 2) margin_mm,
  case when greatest(coalesce(lt, 0), coalesce(st, 0)) > 0 then round((last_mm - required_mm) / greatest(coalesce(lt, 0), coalesce(st, 0)), 1) end remaining_life_yrs,
  last_mm is not null and last_mm < required_mm below_required
from x;

create view v_equipment_life as
select distinct on (equipment_id) equipment_id, equipment, cml governing_cml, last_on, rate_mm_yr, remaining_life_yrs, below_required
from v_cml_rates
where last_mm is not null
order by equipment_id, below_required desc, remaining_life_yrs asc nulls last, rate_mm_yr desc;

create view v_certificates as
select distinct on (c.equipment_id) c.equipment_id, e.code equipment, c.cert_no, c.issued_on, c.expires_on, c.issued_by, c.conditions, c.expires_on - current_date days_left
from certificates c join equipment e on e.id = c.equipment_id
order by c.equipment_id, c.expires_on desc;

-- When each inspection falls due: the written scheme's interval, capped for internals at
-- half the remaining life or the ten-year ceiling (API 510 6.5.1.1), whichever is sooner.
create view v_due as
with last as (
  select equipment_id,
    max(done_on) filter (where kind = 'internal') last_internal,
    max(done_on) filter (where kind in ('external','internal')) last_external
  from inspections group by equipment_id
), base as (
  select e.id equipment_id, e.code equipment, s.code site, s.country, e.name, e.kind, e.hazard_level, e.status,
    e.internal_interval_months, e.external_interval_months,
    l.last_internal, l.last_external, coalesce(l.last_internal, e.in_service_on) internal_from, coalesce(l.last_external, e.in_service_on) external_from,
    life.remaining_life_yrs, life.governing_cml, life.last_on life_measured_on
  from equipment e join sites s on s.id = e.site_id
  left join last l on l.equipment_id = e.id
  left join v_equipment_life life on life.equipment_id = e.id
), calc as (
  select b.*,
    case when internal_interval_months is not null and internal_from is not null then (internal_from + make_interval(months => internal_interval_months))::date end scheme_internal,
    case when remaining_life_yrs > 0 then (life_measured_on + (remaining_life_yrs * setting('half_life_factor') * 365.25)::int)::date end half_life_internal,
    case when internal_from is not null then (internal_from + (setting('max_internal_years') * 365.25)::int)::date end ceiling_internal,
    case when external_interval_months is not null and external_from is not null then (external_from + make_interval(months => external_interval_months))::date end next_external
  from base b
), pick as (
  select c.*, least(scheme_internal, half_life_internal, ceiling_internal) next_internal from calc c
)
select equipment_id, equipment, site, country, name, kind, hazard_level, status, internal_interval_months, external_interval_months,
  last_internal, last_external, remaining_life_yrs, governing_cml, scheme_internal, half_life_internal, ceiling_internal, next_internal,
  case when next_internal is null then null
       when next_internal = scheme_internal then 'written scheme'
       when next_internal = half_life_internal then 'half remaining life'
       else 'ten year ceiling' end internal_set_by,
  next_external,
  next_internal - current_date internal_days,
  next_external - current_date external_days
from pick;

create view v_valves as
with t as (
  select distinct on (valve_id) valve_id, tested_on, pop_kpa, result, tested_by from valve_tests order by valve_id, tested_on desc
), passed as (
  select valve_id, max(tested_on) last_pass from valve_tests where result in ('pass','adjusted') group by valve_id
)
select v.id valve_id, v.code valve, e.code equipment, s.code site, v.set_pressure_kpa, e.design_pressure_kpa, v.service, v.status,
  coalesce(v.interval_months, case v.service when 'clean' then setting('prv_months_clean') else setting('prv_months_typical') end)::int interval_months,
  t.tested_on last_tested, t.pop_kpa last_pop_kpa, t.result last_result, p.last_pass,
  (coalesce(t.tested_on, v.installed_on) + make_interval(months => coalesce(v.interval_months, case v.service when 'clean' then setting('prv_months_clean') else setting('prv_months_typical') end)::int))::date next_due,
  (coalesce(t.tested_on, v.installed_on) + make_interval(months => coalesce(v.interval_months, case v.service when 'clean' then setting('prv_months_clean') else setting('prv_months_typical') end)::int))::date - current_date days_left
from relief_valves v
join equipment e on e.id = v.equipment_id
join sites s on s.id = e.site_id
left join t on t.valve_id = v.id
left join passed p on p.valve_id = v.id;

create view v_register as
select e.id equipment_id, e.code, s.code site, e.name, e.kind, e.hazard_level, e.fluid, e.design_pressure_kpa, e.status,
  c.cert_no, c.expires_on cert_expires, d.next_internal, d.next_external, d.remaining_life_yrs,
  (select count(*) from relief_valves v where v.equipment_id = e.id and v.status = 'in_service')::int valves,
  (select count(*) from anomalies a where a.equipment_id = e.id and a.closed_on is null)::int open_anomalies
from equipment e join sites s on s.id = e.site_id
left join v_certificates c on c.equipment_id = e.id
left join v_due d on d.equipment_id = e.id;

-- Every rule this system checks. Sources and what each one means: docs/compliance.md.
create view v_compliance as
with live as (select * from equipment where status = 'in_service')
select 'CERT-NONE' rule, e.code record, 'in service with no certificate of inspection on record' issue
  from live e where not exists (select 1 from certificates c where c.equipment_id = e.id)
  and position(coalesce(e.hazard_level, 'A') in substr('ABCDE', 1, setting('cert_levels_through')::int)) > 0
union all
select 'CERT-EXPIRED', c.equipment, 'certificate ' || c.cert_no || ' expired ' || c.expires_on || ' (' || -c.days_left || ' days ago) and the item is still in service'
  from v_certificates c join live e on e.id = c.equipment_id where c.days_left < 0
union all
select 'INTERNAL-OVERDUE', d.equipment, 'internal inspection was due ' || d.next_internal || ' (' || d.internal_set_by || '), ' || -d.internal_days || ' days ago'
  from v_due d where d.status = 'in_service' and d.internal_days < 0
union all
select 'EXTERNAL-OVERDUE', d.equipment, 'external inspection was due ' || d.next_external || ', ' || -d.external_days || ' days ago'
  from v_due d where d.status = 'in_service' and d.external_days < 0
union all
select 'HALF-LIFE', d.equipment, 'the written scheme puts the next internal at ' || d.scheme_internal || ', past half the remaining life at ' || d.governing_cml || ' (' || d.remaining_life_yrs || ' years left): inspect by ' || d.half_life_internal
  from v_due d where d.status = 'in_service' and d.scheme_internal > d.half_life_internal
union all
select 'BELOW-REQUIRED', r.equipment, r.cml || ' (' || r.location || ') measured ' || r.last_mm || ' mm on ' || r.last_on || ', under the ' || r.required_mm || ' mm required'
  from v_cml_rates r join live e on e.id = r.equipment_id where r.below_required
union all
select 'NO-RELIEF', e.code, e.kind || ' in service with no relief device recorded'
  from live e where e.kind <> 'piping' and not exists (select 1 from relief_valves v where v.equipment_id = e.id and v.status = 'in_service')
union all
select 'RELIEF-SET-HIGH', v.valve, 'set at ' || v.set_pressure_kpa || ' kPa, above the ' || v.design_pressure_kpa || ' kPa design pressure of ' || v.equipment
  from v_valves v where v.status = 'in_service' and v.design_pressure_kpa is not null and v.set_pressure_kpa > v.design_pressure_kpa
union all
select 'RELIEF-OVERDUE', v.valve, case when v.last_tested is null then 'never tested; ' else 'last tested ' || v.last_tested || '; ' end || 'due ' || v.next_due || ', ' || -v.days_left || ' days ago (' || v.equipment || ')'
  from v_valves v where v.status = 'in_service' and v.days_left < 0
union all
select 'RELIEF-FAILED', v.valve, 'failed its test on ' || v.last_tested || ' and has not passed since (' || v.equipment || ')'
  from v_valves v where v.status = 'in_service' and v.last_result = 'fail'
union all
select 'ANOMALY-OVERDUE', a.code, e.code || ': ' || a.description || ' (' || a.severity || ') was due ' || a.due_on
  from anomalies a join equipment e on e.id = a.equipment_id where a.closed_on is null and a.due_on < current_date
union all
select 'AU-ITEM-REGISTRATION', e.code, e.kind || ' hazard level ' || e.hazard_level || ' at an Australian site with no plant item registration recorded'
  from live e join sites s on s.id = e.site_id
  where s.country = 'AU' and e.item_registration is null
  and e.kind <> 'piping' and e.hazard_level in ('A','B','C')
union all
select 'AU-DESIGN-REGISTRATION', e.code, e.kind || ' hazard level ' || e.hazard_level || ' at an Australian site with no design registration recorded'
  from live e join sites s on s.id = e.site_id
  where s.country = 'AU' and e.design_registration is null and e.kind <> 'piping' and e.hazard_level in ('A','B','C','D');

-- What needs chasing in the coming weeks, before it becomes a finding.
create view v_attention as
select 'certificate expiring' kind, c.equipment record, c.expires_on due, c.cert_no || ', ' || c.days_left || ' days left' detail
  from v_certificates c join equipment e on e.id = c.equipment_id where e.status = 'in_service' and c.days_left between 0 and setting('warn_days_certificate')
union all
select 'internal due', d.equipment, d.next_internal, d.internal_days || ' days, set by ' || d.internal_set_by
  from v_due d where d.status = 'in_service' and d.internal_days between 0 and setting('warn_days_internal')
union all
select 'external due', d.equipment, d.next_external, d.external_days || ' days'
  from v_due d where d.status = 'in_service' and d.external_days between 0 and setting('warn_days_external')
union all
select 'relief valve due', v.valve, v.next_due, v.days_left || ' days (' || v.equipment || ')'
  from v_valves v where v.status = 'in_service' and v.days_left between 0 and setting('warn_days_valve')
union all
select 'anomaly due', a.code, a.due_on, e.code || ': ' || a.description
  from anomalies a join equipment e on e.id = a.equipment_id where a.closed_on is null and a.due_on between current_date and current_date + setting('warn_days_anomaly')::int
union all
select 'short remaining life', r.equipment, (r.last_on + (r.remaining_life_yrs * 365.25)::int)::date, r.cml || ' at ' || r.rate_mm_yr || ' mm a year, ' || r.remaining_life_yrs || ' years left'
  from v_cml_rates r join equipment e on e.id = r.equipment_id where e.status = 'in_service' and not r.below_required and r.remaining_life_yrs < setting('warn_remaining_life_yrs')
union all
select 'condition after a failed inspection', e.code, i.done_on, i.code || ' failed: ' || coalesce(i.findings, 'no findings written')
  from inspections i join equipment e on e.id = i.equipment_id
  where i.result = 'fail' and e.status = 'in_service'
  and not exists (select 1 from inspections j where j.equipment_id = i.equipment_id and j.kind = i.kind and j.done_on > i.done_on and j.result <> 'fail');
