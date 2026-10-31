// npm test: a temp database, migrate, seed twice, then every command and every rule.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { run, reads } from './integrity.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pressure-equipment-test-'));
// A blank URL keeps tests off any real database named in .env.
process.env.DATABASE_URL = ''; process.env.DATA_DIR = path.join(temp, 'db'); process.env.OUTPUT_DIR = temp;
let db; let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const rejects = async (args, re) => { await assert.rejects(() => run(db, args), re); checks++; };
const child = (script, args = []) => {
  const p = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { env: process.env, encoding: 'utf8', cwd: REPO_ROOT });
  assert.equal(p.status, 0, p.stderr || p.stdout); checks++; return p.stdout;
};
const daysFrom = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const rules = async () => (await run(db, ['compliance'])).map((r) => `${r.rule} ${r.record}`);

try {
  db = await getDb();
  eq((await migrate(db)).ran.length, 1); eq((await migrate(db)).ran.length, 0);
  const seed = fs.readFileSync(path.join(REPO_ROOT, 'supabase/seed.sql'), 'utf8');
  await db.exec(seed); await db.exec(seed);
  eq((await run(db, ['register'])).length, 10); eq((await run(db, ['inspections'])).length, 22);
  eq((await run(db, ['readings'])).length, 22); eq((await run(db, ['valves'])).length, 10);
  eq((await db.query('select count(*)::int n from notes'))[0].n, 2);

  for (const name of Object.keys(reads)) ok(Array.isArray(await run(db, [name])), name);

  // The demo has something to say on every rule, and each one lands on the right record.
  eq((await rules()).sort(), [
    'ANOMALY-OVERDUE A-007', 'AU-DESIGN-REGISTRATION AR-11', 'AU-ITEM-REGISTRATION V-112', 'BELOW-REQUIRED E-201', 'CERT-EXPIRED AR-01', 'CERT-NONE AR-02',
    'EXTERNAL-OVERDUE AR-02', 'EXTERNAL-OVERDUE BLR-11', 'HALF-LIFE AR-01', 'HALF-LIFE V-101', 'INTERNAL-OVERDUE BLR-11', 'NO-RELIEF V-111',
    'RELIEF-FAILED PSV-001B', 'RELIEF-OVERDUE PSV-102', 'RELIEF-SET-HIGH PSV-AR11',
  ]);

  // Corrosion: the higher of the long and short term rates governs; remaining life follows.
  const rates = await run(db, ['corrosion']);
  const c3 = rates.find((r) => r.equipment === 'V-101' && r.cml === 'CML-03');
  eq(c3.governs, 'short term'); eq(Number(c3.rate_mm_yr), 0.436); eq(Number(c3.remaining_life_yrs), 2.5);
  eq(rates[0].equipment, 'E-201'); eq(rates[0].below_required, true);
  // Half the remaining life beats the written scheme on V-101; the scheme sets BLR-01.
  const due = await run(db, ['due']);
  eq(due.find((r) => r.equipment === 'V-101').internal_set_by, 'half remaining life');
  eq(due.find((r) => r.equipment === 'BLR-01').internal_days, 25);
  eq((await run(db, ['overdue'])).map((r) => `${r.equipment} ${r.overdue}`), ['AR-02 external', 'BLR-11 internal and external']);
  eq((await run(db, ['shutdown-plan'])).map((r) => r.equipment), ['BLR-01', 'V-102', 'BLR-11']);
  eq((await run(db, ['cert-renewals'])).map((r) => r.equipment), ['AR-01', 'BLR-01']);
  eq((await run(db, ['valves-due'])).map((r) => r.valve), ['PSV-102', 'PSV-001A', 'PSV-101', 'PSV-011', 'PSV-001B']);
  eq((await run(db, ['open-anomalies'])).map((r) => r.code), ['A-009', 'A-008', 'A-007']);
  eq((await run(db, ['bad-actors']))[0].equipment, 'E-201');
  eq((await run(db, ['site-summary'])).map((r) => [r.site, r.in_service, r.findings]), [['MAT', 6, 9], ['TBA', 4, 6]]);
  const attention = await run(db, ['attention']);
  for (const k of ['certificate expiring', 'internal due', 'external due', 'relief valve due', 'anomaly due', 'short remaining life', 'condition after a failed inspection']) ok(attention.some((r) => r.kind === k), k);
  const v101 = await run(db, ['equipment', 'v-101']);
  eq(v101.corrosion.length, 3); eq(v101.findings.map((r) => r.rule), ['HALF-LIFE']); eq(v101.notes.length, 1);
  eq((await run(db, ['equipment', 'BLR-01'])).findings.map((r) => r.rule), ['RELIEF-FAILED']);

  // Matching: partial codes and names, ambiguity lists candidates.
  await rejects(['equipment', 'AR-0'], /Ambiguous equipment.*AR-01.*AR-02/);
  await rejects(['equipment', 'ZZZ'], /No matching equipment/);
  eq((await run(db, ['equipment', 'calandria'])).equipment[0].code, 'E-201');
  await rejects(['test-valve', 'PSV-00', '--result=pass'], /Ambiguous relief valve.*PSV-001A.*PSV-001B/);

  // Writes: a new item, its points, readings, a valve, inspections and a certificate.
  await run(db, ['add', 'site', 'akl', 'Auckland', 'depot', '--country=nz', '--body=Waikato Plant Inspection Ltd']);
  await rejects(['add', 'site', 'X', 'Nowhere', '--country=UK'], /Invalid country/);
  await run(db, ['add', 'equipment', 'v-301', 'Glycol', 'buffer', 'tank', '--site=AKL', '--kind=pressure vessel', '--hazard=C', '--pressure=600', '--internal=48', '--external=24', `--in-service=${daysFrom(-800)}`]);
  await rejects(['add', 'equipment', 'V-302', 'Bad', '--site=AKL', '--kind=tank'], /Invalid kind/);
  await rejects(['add', 'equipment', 'V-302', 'Bad', '--site=AKL', '--kind=boiler', '--hazard=F'], /hazard level/);
  ok((await rules()).includes('CERT-NONE V-301')); ok((await rules()).includes('NO-RELIEF V-301'));
  ok((await rules()).includes('EXTERNAL-OVERDUE V-301'));
  await rejects(['add', 'cml', 'V-301', 'CML-01', '--location=Shell', '--nominal=8', '--required=9'], /under the nominal/);
  await run(db, ['add', 'cml', 'V-301', 'cml-01', '--location=Shell', '--nominal=8', '--required=6']);
  await run(db, ['reading', 'V-301', 'CML-01', '7.9', `--date=${daysFrom(-800)}`]);
  const r2 = await run(db, ['reading', 'V-301', 'cml-01', '7.1']);
  ok(Number(r2[0].rate_mm_yr) > 0.3); ok(Number(r2[0].remaining_life_yrs) < 4);
  await rejects(['reading', 'V-301', 'CML-09', '7'], /no monitoring point CML-09/);
  await rejects(['reading', 'V-301', 'CML-01', '40'], /check the reading/);
  await rejects(['reading', 'V-301', 'CML-01', '7', `--date=${daysFrom(3)}`], /before it is taken/);
  await rejects(['reading', 'V-301', 'CML-01', '7.1'], /duplicate|unique/i);
  ok((await rules()).includes('HALF-LIFE V-301'));
  await run(db, ['add', 'valve', 'psv-301', '--on=V-301', '--set=650', '--service=clean']);
  ok((await rules()).includes('RELIEF-SET-HIGH PSV-301')); ok(!(await rules()).includes('NO-RELIEF V-301'));
  eq((await run(db, ['valves'])).find((r) => r.valve === 'PSV-301').interval_months, 120);
  const insp = await run(db, ['inspect', 'V-301', '--kind=external', '--result=pass with conditions', '--by=K. Ngata', '--findings=Paint breakdown at the saddles']);
  eq(insp[0].code, 'I-0209');
  await rejects(['inspect', 'V-301', '--kind=x-ray', '--result=pass'], /Invalid kind/);
  ok(!(await rules()).includes('EXTERNAL-OVERDUE V-301'));
  await run(db, ['certify', 'V-301', 'WPI-C-26-001', `--expires=${daysFrom(700)}`]);
  ok(!(await rules()).includes('CERT-NONE V-301'));
  await rejects(['certify', 'V-301', 'WPI-C-26-002', `--issued=${daysFrom(0)}`, `--expires=${daysFrom(-1)}`], /expire after/);
  await run(db, ['interval', 'V-301', '--internal=24']);
  eq((await run(db, ['due'])).find((r) => r.equipment === 'V-301').internal_set_by, 'written scheme');
  await rejects(['interval', 'V-301'], /Give --internal/);

  // Relief valves: a failed test is a finding until a pass; an overdue one clears on test.
  await run(db, ['test-valve', 'PSV-001B', '--result=adjusted', '--pop=1405', '--by=Valve Services Waikato']);
  ok(!(await rules()).includes('RELIEF-FAILED PSV-001B'));
  await rejects(['test-valve', 'PSV-001B', '--result=pass'], /duplicate|unique/i);
  await run(db, ['test-valve', 'PSV-102', '--result=pass', '--pop=2090', `--date=${daysFrom(-1)}`]);
  ok(!(await rules()).includes('RELIEF-OVERDUE PSV-102'));
  await run(db, ['valve-status', 'PSV-AR11', 'removed']);
  ok(!(await rules()).includes('RELIEF-SET-HIGH PSV-AR11')); ok((await rules()).includes('NO-RELIEF AR-11'));

  // Anomalies, status, settings, notes.
  const an = await run(db, ['anomaly', 'V-301', 'Paint', 'breakdown', 'at', 'the', 'saddles', '--severity=low', `--due=${daysFrom(-2)}`, '--inspection=I-0209']);
  eq(an[0].code, 'A-0010');
  ok((await rules()).includes('ANOMALY-OVERDUE A-0010'));
  await rejects(['close', 'A-0010'], /closing reference/);
  await run(db, ['close', 'A-0010', '--ref=WO-5521']);
  await rejects(['close', 'A-0010', '--ref=WO-5521'], /was closed/);
  ok(!(await rules()).includes('ANOMALY-OVERDUE A-0010'));
  await run(db, ['status', 'AR-01', 'out_of_service']);
  ok(!(await rules()).includes('CERT-EXPIRED AR-01'));
  await rejects(['status', 'AR-01', 'broken'], /Invalid status/);
  await run(db, ['setting', 'cert_levels_through', '3']);
  ok(!(await rules()).includes('CERT-NONE AR-02'));
  await rejects(['setting', 'nope', '1'], /No setting nope/);
  await run(db, ['log', 'V-301', 'Saddle', 'paint', 'repaired']);
  eq((await run(db, ['equipment', 'V-301'])).notes.length, 1);

  // History stays: inspections, readings, tests and certificates cannot be deleted.
  await assert.rejects(() => db.query("delete from inspections where code='I-0101'"), /history/); checks++;
  await assert.rejects(() => db.query('delete from readings'), /history/); checks++;

  // Import from Cenosco IMS sheets saved as CSV: dry run, real run, repeat, rollback, mapping.
  const fixtures = path.join(REPO_ROOT, 'tests/fixtures/ims');
  await run(db, ['import', 'ims', fixtures, '--dry-run']);
  eq((await db.query("select count(*)::int n from equipment where code like '%-5__'"))[0].n, 0);
  const imported = await run(db, ['import', 'ims', fixtures]); await run(db, ['import', 'ims', fixtures]);
  eq(imported.map((r) => r.entity), ['equipment', 'inspections', 'thickness', 'valves']);
  eq((await db.query("select count(*)::int n from equipment where code like '%-5__'"))[0].n, 3);
  eq((await db.query("select kind from equipment where code='E-501'"))[0].kind, 'heat exchanger');
  eq((await db.query("select count(*)::int n from inspections i join equipment e on e.id=i.equipment_id where e.code like '%-5__'"))[0].n, 5);
  eq((await db.query("select result from inspections i join equipment e on e.id=i.equipment_id where e.code='V-501' and i.kind='external'"))[0].result, 'pass with conditions');
  eq((await db.query("select to_char(done_on,'YYYY-MM-DD') d from inspections i join equipment e on e.id=i.equipment_id where e.code='V-501' and i.kind='internal'"))[0].d, '2022-05-12');
  eq((await db.query("select count(*)::int n from readings r join cmls c on c.id=r.cml_id join equipment e on e.id=c.equipment_id where e.code like '%-5__'"))[0].n, 4);
  ok((await rules()).includes('RELIEF-FAILED PSV-503'));
  const bad = path.join(temp, 'bad'); fs.mkdirSync(bad);
  fs.writeFileSync(path.join(bad, 'Equipment.csv'), 'Asset ID,Equipment description,Plant,Class\nV-777,Test vessel,Hamilton bottling plant,Vessel\n');
  fs.writeFileSync(path.join(bad, 'Inspections.csv'), 'Tag,Inspection date,Inspection type,Result\nV-NOPE,2025-01-01,Internal,Pass\n');
  await rejects(['import', 'ims', bad], /V-NOPE is not in the database/);
  eq((await db.query("select count(*)::int n from equipment where code='V-777'"))[0].n, 0);
  fs.writeFileSync(path.join(bad, 'Inspections.csv'), 'Tag,Inspection date,Inspection type,Result\nV-777,31/02/2025,Internal,Pass\n');
  await rejects(['import', 'ims', bad], /Invalid .*date/);
  fs.rmSync(path.join(bad, 'Inspections.csv'));
  fs.writeFileSync(path.join(bad, 'Equipment.csv'), 'Item,Title,Plant\nV-778,Mapped vessel,Hamilton bottling plant\n');
  const map = path.join(temp, 'map.json'); fs.writeFileSync(map, JSON.stringify({ equipment: { Tag: 'Item', Description: 'Title' } }));
  await run(db, ['import', 'ims', bad, `--map=${map}`]);
  eq((await db.query("select name from equipment where code='V-778'"))[0].name, 'Mapped vessel');
  fs.writeFileSync(map, JSON.stringify({ equipment: { Tag: 'Missing column' } }));
  await rejects(['import', 'ims', bad, `--map=${map}`], /mapped column "Missing column"/);
  fs.writeFileSync(path.join(bad, 'Invoices.csv'), 'x\ny\n');
  await rejects(['import', 'ims', bad], /Unrecognised file Invoices.csv/);
  await rejects(['import', 'other', bad], /Usage: import ims/);

  // Export and drafts.
  const exported = await run(db, ['export', path.join(temp, 'export')]);
  eq(exported.length, 11); ok(fs.existsSync(path.join(temp, 'export', 'manifest.json')));
  const booking = await run(db, ['draft-booking', 'BLR-01']);
  const bt = fs.readFileSync(booking[0].file, 'utf8');
  ok(bt.includes('To: Waikato Plant Inspection Ltd')); ok(bt.includes('PSV-001A set at 1400 kPa')); ok(bt.includes('Nothing has been sent'));
  const notice = await run(db, ['draft-anomaly', 'A-008']);
  ok(fs.readFileSync(notice[0].file, 'utf8').includes('This is high severity'));
  await db.close(); db = null;

  // The CLI as a process: --json, help, ambiguity exits 1.
  ok(JSON.parse(child('integrity.mjs', ['compliance', '--json'])).length > 0);
  ok(child('integrity.mjs', ['help']).includes('reading <equipment> <cml> <mm>'));
  const amb = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts/integrity.mjs'), 'equipment', 'AR-0'], { env: process.env, encoding: 'utf8' });
  eq(amb.status, 1); ok(amb.stderr.includes('Candidates:'));
  child('view.mjs'); child('docs.mjs');
  for (const v of JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'views.json'), 'utf8'))) ok(fs.existsSync(path.join(temp, 'views', `${v.name}.html`)), v.name);
  for (const d of JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'documents.json'), 'utf8'))) ok(fs.readdirSync(path.join(temp, 'docs-out', d.name)).length >= 1, d.name);

  const commands = fs.readdirSync(path.join(REPO_ROOT, '.claude/commands')).filter((f) => f.endsWith('.md') && f !== 'README.md');
  for (const f of commands) ok(/^---\ndescription: .+\n---/m.test(fs.readFileSync(path.join(REPO_ROOT, '.claude/commands', f), 'utf8')), `${f} has a description`);
  console.log(`PASS: ${checks} assertions; ${Object.keys(reads).length} read commands; ${commands.length} slash commands; register, inspections, corrosion rates, remaining life, relief valves, certificates, anomalies, import rollback, export, drafts and HTML.`);
} finally {
  await db?.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
