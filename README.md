<h1 align="center">Pressure Equipment for Claude Code</h1>

<p align="center">
  <strong>The open-source pressure equipment integrity system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Cenosco IMS PEI data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=cenosco">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/cenosco?utm_source=github&utm_medium=readme&utm_campaign=cenosco">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-cenosco">Instead of Cenosco IMS PEI</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Pressure Equipment for Claude Code does the job you pay Cenosco IMS PEI for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Cenosco IMS PEI dashboard cannot.

Cenosco does not publish a price: IMS PEI is quoted privately, as a monthly or yearly subscription ([cenosco.com](https://cenosco.com/insights/integrity-management-software-saas-or-perpetual-license)), and Capterra lists it from EUR 29,500 per site per year ([capterra.co.nz](https://www.capterra.co.nz/software/194170/ims-suite)), before data migration and integration services.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=cenosco).

It is for plants in New Zealand and Australia that own boilers, pressure vessels, air receivers, heat exchangers and refrigeration vessels and have them inspected by an outside inspection body: dairy, food and beverage, timber, chemicals, mining, hospitals. It holds the equipment register with AS 4343 hazard levels, certificates of inspection, internal and external inspections against the written scheme, wall thickness at every monitoring point with long and short term corrosion rates and remaining life, relief valves and their bench tests, and the anomalies each inspection raises, in one database. It checks them against the NZ pressure equipment regulations, the Australian plant registration rules and the API 510 half-life and relief valve limits. It does not run a full RBI model, show 3D models or replace your inspector.

The fictional Kaimai Valley Dairy demo has a milk powder site at Matamata and a cheese site at Toowoomba with ten items. An air receiver failed its external twelve days ago and is still running on an expired certificate, the Toowoomba boiler is 20 days past its internal, the evaporator calandria shell is under its required thickness, a boiler safety valve failed its bench test, and the steam accumulator is losing wall below the inlet fast enough that half its remaining life lands a year before the written scheme says to look inside.

## Ten questions the Cenosco IMS PEI dashboard does not answer

Each one is a single command here:

1. Which items are in service without a current certificate of inspection? (`/compliance`)
2. Which vessels will reach half their remaining life before the internal our written scheme allows? (`/remaining-life`)
3. Which monitoring points lost wall faster in the last interval than over their whole life? (`/corrosion`)
4. Which certificates expire in the next 90 days, and is the inspection due before then? (`/cert-renewals`)
5. Which relief valves are set above the design pressure of the item they protect? (`/compliance`)
6. Which relief valves failed their last bench test and have not passed since? (`/valves-due`)
7. What internals and valve tests must go into next year's shutdown, site by site? (`/shutdown-plan`)
8. Which items cause the most trouble: findings, anomalies and failed valves over three years? (`/bad-actors`)
9. Which Australian boilers and vessels are missing a design or item registration? (`/compliance`)
10. Which anomalies from inspections are past their due date, worst first? (`/open-anomalies`)

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/pressure-equipment-for-claude-code.git
cd pressure-equipment-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/monday-integrity` for the week's findings and what to book, or `/attention` for what falls due soon. `npm run view` writes the week, register, corrosion and shutdown views to `views/`; `npm run docs` writes equipment records, remaining life assessments, relief valve registers, anomaly reports and certificate schedules to `docs-out/`, in the brand set in `brand.json`.

## Your first hour: ten things to ask for

1. "Load our register": `/import` from your IMS PEI sheets, after a test run.
2. "What is in service without a current certificate?"
3. "Show me everything overdue, longest first."
4. "Which vessels does half the remaining life make due before the written scheme?"
5. "Plan the March shutdown at Matamata."
6. "Draft the booking to the inspection body for BLR-01."
7. "The inspector was here yesterday. Here is the report." (`/after-inspection`)
8. "Which relief valves are due before Christmas?"
9. "Our boiler valves are tested every 12 months, not 60." (`/customise` or `/interval`)
10. "Put our name and logo on the certificate schedule." (`brand.json`, then `npm run docs`)

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

The working rhythm, in the integrity engineer's words: `/monday-integrity` every week, `/after-inspection` when the inspector's report lands, `/plan-shutdown` before each outage, `/cert-renewals` and `/draft-booking` to keep certificates current, `/weekly-review` for the plant manager.

| Command | What it does |
|---|---|
| `/add` | Add a site, an item of equipment, a thickness monitoring point or a relief valve |
| `/after-inspection` | Record an inspector's visit in one go: the inspection, the readings, the valve tests, the anomalies and the new certificate |
| `/anomalies` | Every anomaly from an inspection, open and closed, with due date and close-out reference |
| `/anomaly` | Raise an anomaly from an inspection finding, with severity and due date |
| `/attention` | What needs chasing in the coming weeks: certificates expiring, inspections and valve tests due, anomalies due, short remaining life and failed inspections not yet followed up |
| `/bad-actors` | The items that cause the most trouble: worst corrosion rate, shortest life, failed inspections, anomalies and relief valve findings over three years |
| `/cert-renewals` | Certificates expired or expiring in the next 90 days, with the inspection due and the body to book |
| `/certificates` | Every certificate of inspection with its expiry date and conditions, soonest first |
| `/certify` | Record a new certificate of inspection from the inspection body |
| `/close` | Close an anomaly against the work order or report that fixed it |
| `/compliance` | Check the records against the rules this industry lives under (the ones listed in docs/compliance.md) and report what is missing, late, or about to breach, with the rule cited. |
| `/corrosion` | Wall loss at every monitoring point: long and short term rates, which governs, margin and remaining life |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/draft-anomaly` | Draft a notice to the plant manager about an open anomaly: the finding, the due date and who owns the fix |
| `/draft-booking` | Draft the request to the inspection body to book an inspection, with the due dates, certificate, valves and open items |
| `/due` | When each item next needs an internal and an external inspection, and what set the date (written scheme, half remaining life or the ten year ceiling) |
| `/equipment` | One item in full: register details, certificate, due dates, corrosion at each point, relief valves, inspections, anomalies, findings and notes |
| `/export` | Export every record to JSON files |
| `/import` | Bring the equipment register, inspection history, thickness readings and relief valves across from Cenosco IMS PEI sheets saved as CSV |
| `/inspect` | Record an inspection done: kind, result, inspector, report number and findings |
| `/inspections` | Every inspection on record, most recent first, with result, inspector, report and findings |
| `/interval` | Change an item's internal or external inspection interval to match the written scheme |
| `/log` | Add a note to an item: an isolation, a conversation with the inspector, a repair plan |
| `/monday-integrity` | The integrity engineer's Monday check: findings, what falls due in the next month, and what to book |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |
| `/open-anomalies` | Open anomalies by severity and due date |
| `/overdue` | In-service items past their internal or external inspection date |
| `/plan-shutdown` | Build the outage work list: internals, relief valve tests and open anomalies due before the next shutdown |
| `/reading` | Record a wall thickness reading at a monitoring point and show the new corrosion rate and remaining life |
| `/readings` | Every thickness reading by item and monitoring point, oldest to newest |
| `/register` | The pressure equipment register: every item with its hazard level, certificate, next inspections, relief valves and open anomalies |
| `/remaining-life` | Remaining life of each item at its governing monitoring point, against the next internal the scheme and half-life rule allow |
| `/setting` | Change a setting every check uses: interval ceilings, the half-life factor, relief valve defaults, certificate levels or warning windows |
| `/settings` | The numbers every check uses: interval ceilings, the half-life factor, relief valve defaults, certificate levels and warning windows |
| `/shutdown-plan` | Internal inspections due in the next twelve months by site, with the relief valves and open anomalies to take into the outage |
| `/site-summary` | Each site in one line: items in service, overdue, certificates expired, compliance findings and open anomalies |
| `/sites` | Sites, their country and the inspection body that certifies each one |
| `/status` | Mark an item in service, out of service or retired, or a relief valve removed |
| `/test-valve` | Record a relief valve bench test: pop pressure and result |
| `/valves-due` | Relief valves overdue, due in the next 90 days, or failed at their last test |
| `/valves` | Every relief valve: set pressure against design pressure, test interval, last test, result and next due |
| `/weekly-review` | The weekly review written from the findings, the due list, corrosion and the anomalies |

Every command runs `npm run integrity -- <command>`; add `--json` for machine output. Tags and names match without case; a prefix works when it is unique. An ambiguous name lists the candidates and exits with status 1. Inspections, thickness readings, valve tests and certificates cannot be deleted: a mistake is corrected with a new record.

## Instead of Cenosco IMS PEI

Save your IMS PEI asset register, inspection history, thickness readings and relief valve list as CSV files in one folder, then:

```bash
npm run integrity -- import ims ./ims-export --dry-run
npm run integrity -- import ims ./ims-export
```

The test run writes nothing. A bad row stops the whole import with the file and row named, and nothing is kept. Different headings map with `--map=file.json`. What maps and what does not carry over (RBI models, damage mechanism libraries, 3D models): [docs/replace-cenosco.md](docs/replace-cenosco.md). The rules every check follows, with sources: [docs/compliance.md](docs/compliance.md).

## Architecture

```
pressure-equipment-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Pressure Equipment for Claude Code for your business, migrates your Cenosco IMS PEI data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=cenosco)
- Read more: [enterprisedna.co/omni/instead-of/cenosco](https://enterprisedna.co/omni/instead-of/cenosco?utm_source=github&utm_medium=readme&utm_campaign=cenosco)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
