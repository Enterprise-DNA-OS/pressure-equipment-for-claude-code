#!/usr/bin/env node
// The one CLI for Pressure Equipment for Claude Code. Human tables by default, --json for machines.
//   npm run integrity -- help
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table } from './lib/format.mjs';
import { parseCsv, pick } from './lib/csv.mjs';

// Every read the integrity engineer, the plant manager and the inspection body ask for, by name.
export const reads = {
  sites: 'select code,name,country,inspection_body from sites order by code',
  register: 'select code,site,name,kind,hazard_level,fluid,design_pressure_kpa,status,cert_no,cert_expires,next_internal,next_external,remaining_life_yrs,valves,open_anomalies from v_register order by site,code',
  certificates: "select c.equipment,s.code site,c.cert_no,c.issued_on,c.expires_on,c.days_left,c.issued_by,c.conditions from v_certificates c join equipment e on e.id=c.equipment_id join sites s on s.id=e.site_id where e.status<>'retired' order by c.expires_on,c.equipment",
  'cert-renewals': "select c.equipment,s.code site,c.cert_no,c.expires_on,c.days_left,d.next_internal,d.next_external,s.inspection_body from v_certificates c join equipment e on e.id=c.equipment_id join sites s on s.id=e.site_id join v_due d on d.equipment_id=e.id where e.status='in_service' and c.days_left<=90 order by c.expires_on,c.equipment",
  inspections: 'select i.code,e.code equipment,i.kind,i.done_on,i.result,i.inspector,i.inspection_body,i.report_ref,i.findings from inspections i join equipment e on e.id=i.equipment_id order by i.done_on desc,i.code',
  due: "select equipment,site,kind,hazard_level,last_internal,next_internal,internal_days,internal_set_by,last_external,next_external,external_days from v_due where status='in_service' order by least(next_internal,next_external) nulls last,equipment",
  overdue: "select equipment,site,case when internal_days<0 and external_days<0 then 'internal and external' when internal_days<0 then 'internal' else 'external' end overdue,next_internal,internal_days,next_external,external_days,internal_set_by from v_due where status='in_service' and (internal_days<0 or external_days<0) order by least(internal_days,external_days),equipment",
  'shutdown-plan': "select site,equipment,name,kind,next_internal,internal_days,internal_set_by,(select count(*) from relief_valves v where v.equipment_id=d.equipment_id and v.status='in_service')::int valves,(select count(*) from anomalies a where a.equipment_id=d.equipment_id and a.closed_on is null)::int open_anomalies from v_due d where status='in_service' and internal_days<=365 order by site,next_internal,equipment",
  corrosion: 'select equipment,cml,location,nominal_mm,required_mm,first_on,first_mm,last_on,last_mm,long_term_mm_yr,short_term_mm_yr,rate_mm_yr,governs,margin_mm,remaining_life_yrs,below_required from v_cml_rates order by below_required desc,remaining_life_yrs nulls last,equipment,cml',
  'remaining-life': "select l.equipment,s.code site,l.governing_cml,l.last_on measured_on,l.rate_mm_yr,l.remaining_life_yrs,l.below_required,d.scheme_internal,d.half_life_internal,d.next_internal from v_equipment_life l join equipment e on e.id=l.equipment_id join sites s on s.id=e.site_id join v_due d on d.equipment_id=e.id order by l.below_required desc,l.remaining_life_yrs nulls last,l.equipment",
  readings: 'select e.code equipment,c.code cml,c.location,r.measured_on,r.thickness_mm,c.required_mm from readings r join cmls c on c.id=r.cml_id join equipment e on e.id=c.equipment_id order by e.code,c.code,r.measured_on',
  valves: 'select valve,equipment,site,set_pressure_kpa,design_pressure_kpa,service,interval_months,last_tested,last_pop_kpa,last_result,next_due,days_left,status from v_valves order by next_due,valve',
  'valves-due': "select valve,equipment,site,set_pressure_kpa,last_tested,last_result,next_due,days_left from v_valves where status='in_service' and (days_left<=90 or last_result='fail') order by days_left,valve",
  anomalies: "select a.code,e.code equipment,a.severity,a.raised_on,a.description,a.due_on,a.closed_on,a.closed_ref,case when a.closed_on is not null then 'closed' when a.due_on<current_date then 'overdue' else 'open' end state from anomalies a join equipment e on e.id=a.equipment_id order by a.closed_on nulls first,a.due_on nulls last,a.code",
  'open-anomalies': "select a.code,e.code equipment,s.code site,a.severity,a.raised_on,a.description,a.due_on,a.due_on-current_date days_left from anomalies a join equipment e on e.id=a.equipment_id join sites s on s.id=e.site_id where a.closed_on is null order by case a.severity when 'high' then 1 when 'medium' then 2 else 3 end,a.due_on nulls last,a.code",
  'bad-actors': "select * from (select e.code equipment,s.code site,e.name,max(r.rate_mm_yr) worst_rate_mm_yr,min(r.remaining_life_yrs) least_life_yrs,(select count(*) from inspections i where i.equipment_id=e.id and i.result<>'pass' and i.done_on>=current_date-1096)::int findings_3y,(select count(*) from anomalies a where a.equipment_id=e.id and a.raised_on>=current_date-1096)::int anomalies_3y,(select count(*) from valve_tests t join relief_valves v on v.id=t.valve_id where v.equipment_id=e.id and t.result<>'pass' and t.tested_on>=current_date-1096)::int valve_findings_3y from equipment e join sites s on s.id=e.site_id left join v_cml_rates r on r.equipment_id=e.id where e.status<>'retired' group by e.id,e.code,s.code,e.name) x order by findings_3y+anomalies_3y+valve_findings_3y desc,worst_rate_mm_yr desc nulls last,equipment",
  'site-summary': "select s.code site,s.name,count(distinct e.id) filter (where e.status='in_service')::int in_service,count(distinct d.equipment_id) filter (where d.status='in_service' and (d.internal_days<0 or d.external_days<0))::int overdue,count(distinct c.equipment_id) filter (where c.days_left<0 and e.status='in_service')::int certs_expired,(select count(*) from v_compliance v where exists (select 1 from equipment x where x.site_id=s.id and (x.code=v.record or exists (select 1 from relief_valves r where r.equipment_id=x.id and r.code=v.record) or exists (select 1 from anomalies n where n.equipment_id=x.id and n.code=v.record))))::int findings,(select count(*) from anomalies a join equipment x on x.id=a.equipment_id where x.site_id=s.id and a.closed_on is null)::int open_anomalies from sites s left join equipment e on e.site_id=s.id left join v_due d on d.equipment_id=e.id left join v_certificates c on c.equipment_id=e.id group by s.id,s.code,s.name order by s.code",
  settings: 'select key,value,unit,note from settings order by key',
  compliance: 'select rule,record,issue from v_compliance order by rule,record',
  attention: 'select kind,record,due,detail from v_attention order by due,kind,record',
};

const named = {
  sites: { by: 'code', names: true }, equipment: { by: 'code', names: true }, relief_valves: { by: 'code' },
  anomalies: { by: 'code', names: 'description' }, inspections: { by: 'code' },
};
const labels = { relief_valves: 'relief valve', anomalies: 'anomaly', inspections: 'inspection', sites: 'site', equipment: 'equipment' };

// Exact code or id first, then a unique prefix or name match. Ambiguity lists candidates.
export async function resolve(db, entity, value) {
  const label = labels[entity];
  if (!value || value === true) throw Error(`Supply a ${label} code, name or id prefix`);
  const { by, names } = named[entity];
  const exact = await db.query(`select * from ${entity} where lower(${by})=lower($1) or id::text=$1`, [String(value)]);
  if (exact.length === 1) return exact[0];
  const nameCol = names === true ? 'name' : names;
  const found = await db.query(`select * from ${entity} where starts_with(lower(${by}),lower($1)) or starts_with(id::text,$1)${nameCol ? ` or position(lower($1) in lower(${nameCol}))>0` : ''} order by ${by}`, [String(value)]);
  if (found.length === 1) return found[0];
  const list = found.map((r) => `${r[by]}${nameCol ? ' ' + r[nameCol] : ''}`).join('; ') || '(none)';
  throw Error(`${found.length ? 'Ambiguous' : 'No matching'} ${label}: ${value}. Candidates: ${list}`);
}

const required = (v, n) => { if (v === undefined || v === null || v === true || String(v).trim() === '') throw Error(`Required: ${n}`); return String(v).trim(); };
const number = (v, n, { positive = false, min } = {}) => {
  const x = Number(required(v, n));
  if (!Number.isFinite(x) || (positive && x <= 0) || (min !== undefined && x < min)) throw Error(`Invalid ${n}: ${v}`);
  return x;
};
const int = (v, n) => { const x = number(v, n, { positive: true }); if (!Number.isInteger(x)) throw Error(`Invalid ${n}: ${v} (whole months)`); return x; };
const date = (v, n = 'date') => {
  required(v, n);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v) throw Error(`Invalid ${n}: use a real YYYY-MM-DD date`);
  return v;
};
const oneOf = (v, n, list) => { const s = required(v, n).toLowerCase().replace(/_/g, ' '); if (!list.includes(s)) throw Error(`Invalid ${n}: ${v}. Use one of: ${list.join(', ')}`); return s; };
const today = () => new Date().toISOString().slice(0, 10);
const ymd = (d) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);
const KINDS = ['pressure vessel', 'boiler', 'air receiver', 'heat exchanger', 'refrigeration vessel', 'autoclave', 'piping'];
const HAZARD = (v) => { const h = String(v || '').trim().toUpperCase().replace(/^HAZARD LEVEL\s*/, ''); if (!h) return null; if (!/^[A-E]$/.test(h)) throw Error(`Invalid hazard level: ${v}. Use A to E (AS 4343)`); return h; };

async function transaction(db, fn, dry = false) {
  await db.exec('begin');
  try { const out = await fn(); await db.exec(dry ? 'rollback' : 'commit'); return out; }
  catch (e) { await db.exec('rollback'); throw e; }
}
async function nextCode(db, tableName, prefix) {
  const r = await db.query(`select coalesce(max(nullif(regexp_replace(code,'\\D','','g'),'')::int),0)+1 n from ${tableName} where code like $1`, [`${prefix}%`]);
  return `${prefix}${String(r[0].n).padStart(4, '0')}`;
}

const entities = ['settings', 'sites', 'equipment', 'inspections', 'cmls', 'readings', 'relief_valves', 'valve_tests', 'certificates', 'anomalies', 'notes'];

export const help = [
  ...Object.keys(reads),
  'equipment <tag>',
  'add site <code> <name> --country=NZ|AU [--body=inspection body]',
  `add equipment <tag> <name> --site=.. --kind="${KINDS.join('|')}" [--hazard=A-E] [--fluid=..] [--pressure=kPa] [--temp=C] [--internal=months] [--external=months] [--in-service=YYYY-MM-DD] [--design-reg=..] [--item-reg=..] [--serial=..] [--maker=..] [--year=..]`,
  'add cml <equipment> <code> --location=".." --nominal=mm --required=mm',
  'add valve <code> --on=<equipment> --set=kPa [--service=typical|clean] [--interval=months] [--size=..] [--installed=YYYY-MM-DD]',
  'inspect <equipment> --kind=internal|external|thickness|on-stream --result=pass|"pass with conditions"|fail [--date=YYYY-MM-DD] [--by=..] [--body=..] [--report=..] [--findings=".."]',
  'reading <equipment> <cml> <mm> [--date=YYYY-MM-DD] [--inspection=code]',
  'test-valve <valve> --result=pass|adjusted|fail [--pop=kPa] [--date=YYYY-MM-DD] [--by=..] [--report=..]',
  'certify <equipment> <certificate no> --expires=YYYY-MM-DD [--issued=YYYY-MM-DD] [--by=..] [--conditions=".."]',
  'anomaly <equipment> <description> [--severity=low|medium|high] [--due=YYYY-MM-DD] [--inspection=code]',
  'close <anomaly> --ref=work order or report',
  'status <equipment> in_service|out_of_service|retired', 'valve-status <valve> in_service|removed',
  'interval <equipment> [--internal=months] [--external=months]', 'setting <key> <value>', 'log <equipment> <note>',
  'import ims <folder> [--dry-run] [--map=file.json] [--country=NZ|AU]', 'export <folder>',
  'draft-booking <equipment>', 'draft-anomaly <anomaly>',
];

export async function run(db, args) {
  const flags = {}; const pos = [];
  for (const a of args) {
    if (a.startsWith('--')) { const i = a.indexOf('='); flags[a.slice(2, i < 0 ? undefined : i)] = i < 0 ? true : a.slice(i + 1); }
    else pos.push(a);
  }
  const [cmd = 'help', ...a] = pos;
  if (cmd === 'help') return help.map((command) => ({ command }));
  if (reads[cmd]) return db.query(reads[cmd]);

  if (cmd === 'equipment') {
    const e = await resolve(db, 'equipment', a.join(' '));
    return {
      equipment: await db.query('select r.code,r.site,r.name,r.kind,r.hazard_level,r.fluid,r.design_pressure_kpa,e.design_temp_c,e.manufacturer,e.serial_no,e.year_built,e.design_registration,e.item_registration,r.status from v_register r join equipment e on e.id=r.equipment_id where r.equipment_id=$1', [e.id]),
      certificate: await db.query('select cert_no,issued_on,expires_on,days_left,issued_by,conditions from v_certificates where equipment_id=$1', [e.id]),
      due: await db.query('select last_internal,next_internal,internal_set_by,internal_days,last_external,next_external,external_days from v_due where equipment_id=$1', [e.id]),
      corrosion: await db.query('select cml,location,last_on,last_mm,required_mm,rate_mm_yr,governs,remaining_life_yrs,below_required from v_cml_rates where equipment_id=$1 order by cml', [e.id]),
      valves: await db.query('select v.valve,v.set_pressure_kpa,v.last_tested,v.last_result,v.next_due,v.days_left,v.status from v_valves v join relief_valves r on r.id=v.valve_id where r.equipment_id=$1 order by valve', [e.id]),
      inspections: await db.query('select code,kind,done_on,result,inspector,report_ref,findings from inspections where equipment_id=$1 order by done_on desc', [e.id]),
      anomalies: await db.query('select code,severity,raised_on,description,due_on,closed_on,closed_ref from anomalies where equipment_id=$1 order by raised_on desc', [e.id]),
      findings: await db.query("select rule,issue from v_compliance where record=$1 or issue like '%(' || $1 || ')%' or issue like $1 || ':%' order by rule", [e.code]),
      notes: await db.query('select created_at,body from notes where equipment_id=$1 order by created_at', [e.id]),
    };
  }

  if (cmd === 'export') {
    const dir = path.resolve(required(a[0], 'export folder'));
    fs.mkdirSync(dir, { recursive: true });
    return transaction(db, async () => {
      await db.exec('set transaction isolation level repeatable read');
      const counts = [];
      for (const t of entities) {
        const rows = await db.query(`select * from ${t} order by ${t === 'settings' ? 'key' : 'id'}`);
        fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(rows, null, 2) + '\n');
        counts.push({ entity: t, rows: rows.length });
      }
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: 1, at: new Date().toISOString(), counts }, null, 2) + '\n');
      return counts;
    });
  }

  if (cmd === 'import') return importIms(db, a, flags);
  if (cmd === 'add') return transaction(db, () => add(db, a, flags));

  if (cmd === 'inspect') return transaction(db, async () => {
    const e = await resolve(db, 'equipment', a.join(' '));
    if (e.status === 'retired') throw Error(`${e.code} is retired`);
    const kind = oneOf(flags.kind, 'kind (--kind)', ['internal', 'external', 'thickness', 'on-stream']);
    const result = oneOf(flags.result, 'result (--result)', ['pass', 'pass with conditions', 'fail']);
    const on = flags.date ? date(flags.date) : today();
    if (on > today()) throw Error('An inspection cannot be recorded before it happens');
    const site = (await db.query('select inspection_body from sites where id=$1', [e.site_id]))[0];
    return db.query('insert into inspections(code,equipment_id,kind,done_on,inspector,inspection_body,result,findings,report_ref) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning code,kind,done_on,result',
      [await nextCode(db, 'inspections', 'I-'), e.id, kind, on, flags.by || null, flags.body || site?.inspection_body || null, result, flags.findings || null, flags.report || null]);
  });

  if (cmd === 'reading') return transaction(db, async () => {
    const e = await resolve(db, 'equipment', a[0]);
    const c = (await db.query('select * from cmls where equipment_id=$1 and lower(code)=lower($2)', [e.id, required(a[1], 'monitoring point (CML)')]))[0];
    if (!c) throw Error(`${e.code} has no monitoring point ${a[1]}. Points: ${(await db.query('select code from cmls where equipment_id=$1 order by code', [e.id])).map((r) => r.code).join(', ') || '(none)'}`);
    const mm = number(a[2], 'thickness in mm', { positive: true });
    if (mm > Number(c.nominal_mm) * 1.5) throw Error(`${mm} mm is far above the ${c.nominal_mm} mm nominal at ${c.code}: check the reading`);
    const on = flags.date ? date(flags.date) : today();
    if (on > today()) throw Error('A reading cannot be recorded before it is taken');
    const insp = flags.inspection ? await resolve(db, 'inspections', flags.inspection) : null;
    await db.query('insert into readings(cml_id,measured_on,thickness_mm,inspection_id) values($1,$2,$3,$4)', [c.id, on, mm, insp?.id || null]);
    return db.query('select cml,last_mm,required_mm,rate_mm_yr,governs,remaining_life_yrs,below_required from v_cml_rates where cml_id=$1', [c.id]);
  });

  if (cmd === 'test-valve') return transaction(db, async () => {
    const v = await resolve(db, 'relief_valves', a[0]);
    const result = oneOf(flags.result, 'result (--result)', ['pass', 'adjusted', 'fail']);
    const on = flags.date ? date(flags.date) : today();
    if (on > today()) throw Error('A test cannot be recorded before it happens');
    await db.query('insert into valve_tests(valve_id,tested_on,pop_kpa,result,tested_by,report_ref) values($1,$2,$3,$4,$5,$6)',
      [v.id, on, flags.pop ? number(flags.pop, 'pop pressure (kPa)', { positive: true }) : null, result, flags.by || null, flags.report || null]);
    return db.query('select valve,last_tested,last_pop_kpa,last_result,next_due from v_valves where valve_id=$1', [v.id]);
  });

  if (cmd === 'certify') return transaction(db, async () => {
    const e = await resolve(db, 'equipment', a[0]);
    const issued = flags.issued ? date(flags.issued, 'issued date') : today();
    const expires = date(flags.expires, 'expiry date (--expires)');
    if (expires <= issued) throw Error('The certificate must expire after it is issued');
    const site = (await db.query('select inspection_body from sites where id=$1', [e.site_id]))[0];
    return db.query('insert into certificates(equipment_id,cert_no,issued_on,expires_on,issued_by,conditions) values($1,$2,$3,$4,$5,$6) returning cert_no,issued_on,expires_on,issued_by',
      [e.id, required(a[1], 'certificate number'), issued, expires, flags.by || site?.inspection_body || null, flags.conditions || null]);
  });

  if (cmd === 'anomaly') return transaction(db, async () => {
    const e = await resolve(db, 'equipment', a[0]);
    const severity = flags.severity ? oneOf(flags.severity, 'severity', ['low', 'medium', 'high']) : 'medium';
    const insp = flags.inspection ? await resolve(db, 'inspections', flags.inspection) : null;
    return db.query('insert into anomalies(code,equipment_id,inspection_id,description,severity,due_on) values($1,$2,$3,$4,$5,$6) returning code,severity,description,due_on',
      [await nextCode(db, 'anomalies', 'A-'), e.id, insp?.id || null, required(a.slice(1).join(' '), 'description'), severity, flags.due ? date(flags.due, 'due date') : null]);
  });

  if (cmd === 'close') return transaction(db, async () => {
    const x = await resolve(db, 'anomalies', a[0]);
    if (x.closed_on) throw Error(`${x.code} was closed on ${ymd(x.closed_on)} (${x.closed_ref})`);
    return db.query('update anomalies set closed_on=current_date,closed_ref=$2 where id=$1 returning code,closed_on,closed_ref', [x.id, required(flags.ref, 'closing reference (--ref)')]);
  });

  if (cmd === 'status') return transaction(db, async () => {
    const e = await resolve(db, 'equipment', a[0]);
    const s = oneOf(a[1], 'status', ['in service', 'out of service', 'retired']).replace(/ /g, '_');
    return db.query('update equipment set status=$2 where id=$1 returning code,status', [e.id, s]);
  });

  if (cmd === 'valve-status') return transaction(db, async () => {
    const v = await resolve(db, 'relief_valves', a[0]);
    const s = oneOf(a[1], 'status', ['in service', 'removed']).replace(/ /g, '_');
    return db.query('update relief_valves set status=$2 where id=$1 returning code,status', [v.id, s]);
  });

  if (cmd === 'interval') return transaction(db, async () => {
    const e = await resolve(db, 'equipment', a[0]);
    if (flags.internal === undefined && flags.external === undefined) throw Error('Give --internal=months and/or --external=months');
    await db.query('update equipment set internal_interval_months=coalesce($2,internal_interval_months),external_interval_months=coalesce($3,external_interval_months) where id=$1',
      [e.id, flags.internal !== undefined ? int(flags.internal, 'internal interval') : null, flags.external !== undefined ? int(flags.external, 'external interval') : null]);
    return db.query('select equipment,internal_interval_months,external_interval_months,next_internal,internal_set_by,next_external from v_due where equipment_id=$1', [e.id]);
  });

  if (cmd === 'setting') return transaction(db, async () => {
    const key = required(a[0], 'setting key');
    const r = await db.query('update settings set value=$2 where key=$1 returning key,value,unit,note', [key, number(a[1], 'value', { min: 0 })]);
    if (!r.length) throw Error(`No setting ${key}. Settings: ${(await db.query('select key from settings order by key')).map((x) => x.key).join(', ')}`);
    return r;
  });

  if (cmd === 'log') return transaction(db, async () => {
    const e = await resolve(db, 'equipment', a[0]);
    return db.query('insert into notes(equipment_id,body) values($1,$2) returning created_at,body', [e.id, required(a.slice(1).join(' '), 'note')]);
  });

  if (cmd === 'draft-booking' || cmd === 'draft-anomaly') return draft(db, cmd, a.join(' '));
  throw Error(`Unknown command: ${cmd}. Run help for the list`);
}

async function add(db, a, flags) {
  const [what, ...rest] = a;
  if (what === 'site') {
    const country = oneOf(flags.country, 'country (--country)', ['nz', 'au']).toUpperCase();
    return db.query('insert into sites(code,name,country,inspection_body) values($1,$2,$3,$4) returning code,name,country,inspection_body',
      [required(rest[0], 'site code').toUpperCase(), required(rest.slice(1).join(' '), 'site name'), country, flags.body || null]);
  }
  if (what === 'equipment') {
    const site = await resolve(db, 'sites', flags.site);
    return db.query(`insert into equipment(code,site_id,name,kind,hazard_level,fluid,design_pressure_kpa,design_temp_c,manufacturer,serial_no,year_built,design_registration,item_registration,in_service_on,internal_interval_months,external_interval_months)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning code,name,kind,hazard_level,internal_interval_months,external_interval_months`,
      [required(rest[0], 'equipment tag').toUpperCase(), site.id, required(rest.slice(1).join(' '), 'equipment name'), oneOf(flags.kind, 'kind (--kind)', KINDS), HAZARD(flags.hazard), flags.fluid || null,
        flags.pressure ? number(flags.pressure, 'design pressure (kPa)', { positive: true }) : null, flags.temp !== undefined ? number(flags.temp, 'design temperature') : null,
        flags.maker || null, flags.serial || null, flags.year ? int(flags.year, 'year built') : null, flags['design-reg'] || null, flags['item-reg'] || null,
        flags['in-service'] ? date(flags['in-service'], 'in service date') : today(), flags.internal ? int(flags.internal, 'internal interval') : null, flags.external ? int(flags.external, 'external interval') : null]);
  }
  if (what === 'cml') {
    const e = await resolve(db, 'equipment', rest[0]);
    const nominal = number(flags.nominal, 'nominal thickness (--nominal)', { positive: true });
    const req = number(flags.required, 'required thickness (--required)', { positive: true });
    if (req >= nominal) throw Error('The required thickness must be under the nominal thickness');
    return db.query('insert into cmls(equipment_id,code,location,nominal_mm,required_mm) values($1,$2,$3,$4,$5) returning code,location,nominal_mm,required_mm',
      [e.id, required(rest[1], 'monitoring point code').toUpperCase(), required(flags.location, 'location (--location)'), nominal, req]);
  }
  if (what === 'valve') {
    const e = await resolve(db, 'equipment', flags.on);
    return db.query('insert into relief_valves(code,equipment_id,set_pressure_kpa,size,service,interval_months,installed_on) values($1,$2,$3,$4,$5,$6,$7) returning code,set_pressure_kpa,service,interval_months',
      [required(rest[0], 'valve tag').toUpperCase(), e.id, number(flags.set, 'set pressure (--set, kPa)', { positive: true }), flags.size || null,
        flags.service ? oneOf(flags.service, 'service', ['typical', 'clean']) : 'typical', flags.interval ? int(flags.interval, 'test interval') : null, flags.installed ? date(flags.installed, 'installed date') : today()]);
  }
  throw Error('add what? site, equipment, cml or valve');
}

// Cenosco IMS PEI imports from Excel templates. Save each sheet you have (or each report you
// already run) as CSV in one folder: Equipment, Inspections, Thickness, ReliefValves.
const importFiles = [
  { match: /equip|asset|register/, entity: 'equipment' },
  { match: /inspect/, entity: 'inspections' },
  { match: /thick|cml|tml|^ut/, entity: 'thickness' },
  { match: /relief|valve|psv|prv/, entity: 'valves' },
];
const kindOf = (t) => {
  const s = String(t || '').toLowerCase();
  if (/boiler/.test(s)) return 'boiler';
  if (/air/.test(s)) return 'air receiver';
  if (/exchang|calandria|condenser|cooler/.test(s)) return 'heat exchanger';
  if (/refrig|ammonia/.test(s)) return 'refrigeration vessel';
  if (/autoclave|steriliser|sterilizer/.test(s)) return 'autoclave';
  if (/pip|line/.test(s)) return 'piping';
  return 'pressure vessel';
};
const resultOf = (t) => (/fail|reject|unfit/i.test(t) ? 'fail' : /condition|recommend|monitor/i.test(t) ? 'pass with conditions' : 'pass');
const inspKind = (t) => (/internal/i.test(t) ? 'internal' : /thick|ut\b|ultrason/i.test(t) ? 'thickness' : /on.?stream/i.test(t) ? 'on-stream' : 'external');
const dayOf = (v, n) => {
  const s = required(v, n).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return date(s.slice(0, 10), n);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // day first, as NZ and AU write it
  if (m) return date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, n);
  throw Error(`Invalid ${n}: ${s}. Use YYYY-MM-DD or DD/MM/YYYY`);
};

async function importIms(db, a, flags) {
  if (String(a[0] || '').toLowerCase() !== 'ims') throw Error('Usage: import ims <folder> [--dry-run] [--map=file.json]');
  const dir = path.resolve(required(a[1], 'folder of CSV files'));
  if (!fs.existsSync(dir)) throw Error(`No folder ${dir}`);
  const mapping = flags.map ? JSON.parse(fs.readFileSync(path.resolve(String(flags.map)), 'utf8')) : {};
  const country = flags.country ? oneOf(flags.country, 'country', ['nz', 'au']).toUpperCase() : 'NZ';
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv'));
  if (!files.length) throw Error(`No CSV files in ${dir}`);
  const rank = (f) => importFiles.findIndex((x) => x.match.test(f.toLowerCase()));
  files.sort((x, y) => rank(x) - rank(y) || x.localeCompare(y));
  return transaction(db, async () => {
    const out = [];
    for (const file of files) {
      const spec = importFiles.find((x) => x.match.test(file.toLowerCase()));
      if (!spec) throw Error(`Unrecognised file ${file}: expected Equipment, Inspections, Thickness or ReliefValves. See docs/replace-cenosco.md`);
      const rows = parseCsv(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (!rows.length) throw Error(`Empty file: ${file}`);
      let added = 0;
      for (const raw of rows) {
        const row = { ...raw };
        for (const [ours, theirs] of Object.entries(mapping[spec.entity] || {})) {
          if (!(theirs in raw)) throw Error(`${file}: mapped column "${theirs}" is not in the file`);
          row[ours] = raw[theirs];
        }
        const tag = required(pick(row, 'Tag', 'Equipment', 'Equipment tag', 'Asset', 'Asset ID', 'Functional location'), `${file} row ${added + 2}: Tag`).toUpperCase();
        const eq = async () => {
          const e = (await db.query('select id,code,site_id from equipment where lower(code)=lower($1)', [tag]))[0];
          if (!e) throw Error(`${file}: ${tag} is not in the database or the Equipment file`);
          return e;
        };
        if (spec.entity === 'equipment') {
          const siteName = pick(row, 'Site', 'Plant', 'Location', 'Unit') || 'Imported';
          const siteCode = siteName.replace(/[^A-Za-z0-9]+/g, '').slice(0, 8).toUpperCase() || 'IMPORT';
          const site = (await db.query('insert into sites(code,name,country) values($1,$2,$3) on conflict(code) do update set code=excluded.code returning id', [siteCode, siteName, country]))[0];
          const p = pick(row, 'Design pressure (kPa)', 'Design pressure', 'MAWP (kPa)', 'MAWP');
          const t = pick(row, 'Design temperature (C)', 'Design temperature');
          const im = pick(row, 'Internal interval (months)', 'Internal interval');
          const em = pick(row, 'External interval (months)', 'External interval');
          await db.query(`insert into equipment(code,site_id,name,kind,hazard_level,fluid,design_pressure_kpa,design_temp_c,manufacturer,serial_no,year_built,internal_interval_months,external_interval_months,in_service_on)
            values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) on conflict(code) do update set name=excluded.name,kind=excluded.kind,hazard_level=coalesce(excluded.hazard_level,equipment.hazard_level),
            design_pressure_kpa=coalesce(excluded.design_pressure_kpa,equipment.design_pressure_kpa),internal_interval_months=coalesce(excluded.internal_interval_months,equipment.internal_interval_months),external_interval_months=coalesce(excluded.external_interval_months,equipment.external_interval_months)`,
            [tag, site.id, pick(row, 'Description', 'Name', 'Equipment description') || tag, kindOf(pick(row, 'Equipment type', 'Type', 'Class', 'Equipment class')), HAZARD(pick(row, 'Hazard level', 'Hazard')),
              pick(row, 'Fluid', 'Service', 'Contents') || null, p ? number(p, `${file} ${tag}: design pressure`, { positive: true }) : null, t ? number(t, `${file} ${tag}: design temperature`) : null,
              pick(row, 'Manufacturer', 'Maker') || null, pick(row, 'Serial number', 'Serial') || null, pick(row, 'Year built', 'Year') ? int(pick(row, 'Year built', 'Year'), `${file} ${tag}: year`) : null,
              im ? int(im, `${file} ${tag}: internal interval`) : null, em ? int(em, `${file} ${tag}: external interval`) : null,
              pick(row, 'In service date', 'Commissioned') ? dayOf(pick(row, 'In service date', 'Commissioned'), `${file} ${tag}: in service date`) : null]);
        } else if (spec.entity === 'inspections') {
          const e = await eq();
          const on = dayOf(pick(row, 'Inspection date', 'Date', 'Completed'), `${file} ${tag}: date`);
          const kind = inspKind(pick(row, 'Inspection type', 'Type', 'Task'));
          const exists = (await db.query('select 1 from inspections where equipment_id=$1 and done_on=$2 and kind=$3', [e.id, on, kind])).length;
          if (!exists) await db.query('insert into inspections(code,equipment_id,kind,done_on,inspector,inspection_body,result,findings,report_ref) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [await nextCode(db, 'inspections', 'I-'), e.id, kind, on, pick(row, 'Inspector') || null, pick(row, 'Inspection body', 'Company') || null, resultOf(pick(row, 'Result', 'Outcome', 'Condition')),
              pick(row, 'Findings', 'Comments', 'Remarks') || null, pick(row, 'Report', 'Report number', 'Report no') || null]);
        } else if (spec.entity === 'thickness') {
          const e = await eq();
          const code = required(pick(row, 'CML', 'TML', 'CML ID', 'Point'), `${file} ${tag}: CML`).toUpperCase();
          const nominal = pick(row, 'Nominal thickness', 'Nominal', 'Nominal (mm)'); const req = pick(row, 'Required thickness', 'Minimum required', 't-min', 'Tmin', 'Retirement thickness');
          await db.query('insert into cmls(equipment_id,code,location,nominal_mm,required_mm) values($1,$2,$3,$4,$5) on conflict(equipment_id,code) do nothing',
            [e.id, code, pick(row, 'Location', 'Description') || code, number(nominal, `${file} ${tag} ${code}: nominal`, { positive: true }), number(req, `${file} ${tag} ${code}: required thickness`, { positive: true })]);
          const c = (await db.query('select id from cmls where equipment_id=$1 and code=$2', [e.id, code]))[0];
          await db.query('insert into readings(cml_id,measured_on,thickness_mm) values($1,$2,$3) on conflict(cml_id,measured_on) do nothing',
            [c.id, dayOf(pick(row, 'Date', 'Measured', 'Reading date'), `${file} ${tag} ${code}: date`), number(pick(row, 'Thickness', 'Measured thickness', 'Reading', 'Thickness (mm)'), `${file} ${tag} ${code}: thickness`, { positive: true })]);
        } else {
          const valve = required(pick(row, 'Valve', 'Valve tag', 'PSV'), `${file}: Valve`).toUpperCase();
          const e = await eq();
          const iv = pick(row, 'Interval (months)', 'Test interval');
          await db.query('insert into relief_valves(code,equipment_id,set_pressure_kpa,size,interval_months,installed_on) values($1,$2,$3,$4,$5,current_date) on conflict(code) do update set set_pressure_kpa=excluded.set_pressure_kpa',
            [valve, e.id, number(pick(row, 'Set pressure (kPa)', 'Set pressure'), `${file} ${valve}: set pressure`, { positive: true }), pick(row, 'Size') || null, iv ? int(iv, `${file} ${valve}: interval`) : null]);
          const last = pick(row, 'Last test date', 'Last tested', 'Test date');
          if (last) {
            const v = (await db.query('select id from relief_valves where code=$1', [valve]))[0];
            const r = pick(row, 'Result', 'Last result');
            await db.query('insert into valve_tests(valve_id,tested_on,result,tested_by) values($1,$2,$3,$4) on conflict(valve_id,tested_on) do nothing',
              [v.id, dayOf(last, `${file} ${valve}: last test date`), /fail/i.test(r) ? 'fail' : /adjust/i.test(r) ? 'adjusted' : 'pass', pick(row, 'Tested by') || null]);
          }
        }
        added++;
      }
      out.push({ file, entity: spec.entity, rows: added, dry_run: Boolean(flags['dry-run']) });
    }
    return out;
  }, Boolean(flags['dry-run']));
}

async function draft(db, cmd, ref) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  let body; let code;
  if (cmd === 'draft-booking') {
    const e = await resolve(db, 'equipment', ref);
    const i = (await db.query('select d.*,s.name site_name,s.inspection_body,c.cert_no,c.expires_on from v_due d join sites s on s.code=d.site left join v_certificates c on c.equipment_id=d.equipment_id where d.equipment_id=$1', [e.id]))[0];
    const valves = await db.query('select v.valve,v.set_pressure_kpa,v.next_due from v_valves v join relief_valves r on r.id=v.valve_id where r.equipment_id=$1 and v.status=\'in_service\' order by v.valve', [e.id]);
    const open = await db.query('select code,description,severity from anomalies where equipment_id=$1 and closed_on is null order by code', [e.id]);
    code = e.code;
    const kind = i.internal_days !== null && (i.external_days === null || i.internal_days <= i.external_days) ? 'internal' : 'external';
    body = `# DRAFT: inspection booking for ${e.code}\n\nTo: ${i.inspection_body || '(no inspection body recorded for this site)'}\n\nHello,\n\nWe would like to book the ${kind} inspection of ${e.code}, ${i.name}, at our ${i.site_name}.\n\n- Equipment: ${i.kind}${i.hazard_level ? `, hazard level ${i.hazard_level}` : ''}\n- Next internal due: ${i.next_internal ? ymd(i.next_internal) : 'not set'} (${i.internal_set_by || 'no basis recorded'})\n- Next external due: ${i.next_external ? ymd(i.next_external) : 'not set'}\n- Current certificate: ${i.cert_no ? `${i.cert_no}, expires ${ymd(i.expires_on)}` : 'none on record'}\n${valves.length ? `- Relief valves on this item: ${valves.map((v) => `${v.valve} set at ${v.set_pressure_kpa} kPa, test due ${ymd(v.next_due)}`).join('; ')}\n` : ''}${i.remaining_life_yrs !== null && i.remaining_life_yrs !== undefined ? `- Thickness: ${i.governing_cml} has ${i.remaining_life_yrs} years of remaining life at the measured rate\n` : ''}${open.length ? `- Open items from earlier inspections: ${open.map((x) => `${x.code} ${x.description} (${x.severity})`).join('; ')}\n` : ''}\nPlease send through the dates you have available and anything you need us to have ready (isolation, cleaning, scaffolding, access).\n\nFor review before sending. Nothing has been sent.\n`;
  } else {
    const x = await resolve(db, 'anomalies', ref);
    const i = (await db.query('select a.*,e.code equipment,e.name,e.status,s.name site_name,i.code inspection,i.report_ref,i.inspector from anomalies a join equipment e on e.id=a.equipment_id join sites s on s.id=e.site_id left join inspections i on i.id=a.inspection_id where a.id=$1', [x.id]))[0];
    code = i.code;
    body = `# DRAFT: anomaly notice ${i.code} on ${i.equipment}\n\nTo: plant manager, ${i.site_name}\n\n${i.equipment}, ${i.name}, has an open ${i.severity} severity finding.\n\n- Finding: ${i.description}\n- Raised: ${ymd(i.raised_on)}${i.inspection ? ` from inspection ${i.inspection}${i.report_ref ? ` (report ${i.report_ref})` : ''}${i.inspector ? ` by ${i.inspector}` : ''}` : ''}\n- Due: ${i.due_on ? ymd(i.due_on) : 'no date set'}\n- Equipment status: ${i.status.replace('_', ' ')}\n\n${i.severity === 'high' ? 'This is high severity. Agree with the inspection body whether the item stays in service until it is closed out.\n\n' : ''}Please confirm who owns the fix and the work order number, so it can be closed against it.\n\nFor review before sending. Nothing has been sent.\n`;
  }
  const file = path.join(dir, `${cmd.replace('draft-', '')}-${code}-${Date.now()}.md`);
  fs.writeFileSync(file, body);
  return [{ file, record: code }];
}

function print(value) {
  if (Array.isArray(value)) { console.log(value.length ? table(value, Object.keys(value[0]).map((key) => ({ key, label: key, format: fmt }))) : '(none)'); return; }
  for (const [key, v] of Object.entries(value)) { console.log(`\n${key}`); print(Array.isArray(v) ? v : [v]); }
}
function fmt(v) {
  if (v instanceof Date) return v.toISOString().slice(0, v.getUTCHours() || v.getUTCMinutes() ? 16 : 10).replace('T', ' ');
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return v;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  try {
    db = await getDb();
    const out = await run(db, process.argv.slice(2));
    if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2)); else print(out);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { await db?.close(); }
}
