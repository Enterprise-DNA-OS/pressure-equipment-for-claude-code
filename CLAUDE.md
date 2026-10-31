# Pressure Equipment for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| The week's findings and what to book | `/monday-integrity` |
| What falls due in the coming weeks | `/attention` |
| What breaks a rule, and which rule | `/compliance` |
| One item in full | `/equipment` |
| The register | `/register` |
| What is overdue | `/overdue` |
| When each inspection is due and why | `/due` |
| Corrosion rates and remaining life | `/corrosion`, `/remaining-life` |
| Certificates expiring, and the booking to send | `/cert-renewals`, `/draft-booking` |
| Relief valves due or failed | `/valves-due` |
| Open findings from inspections | `/open-anomalies` |
| The outage work list | `/plan-shutdown` |
| The inspector's report has arrived | `/after-inspection` |
| Record one inspection, reading, valve test or certificate | `/inspect`, `/reading`, `/test-valve`, `/certify` |
| Raise or close a finding | `/anomaly`, `/close`, `/draft-anomaly` |
| A new item, monitoring point or valve | `/add` |
| Change an interval or a setting | `/interval`, `/setting` |
| The worst items | `/bad-actors` |
| Each site in one line | `/site-summary` |
| The weekly review for the plant manager | `/weekly-review` |
| Bring data across from IMS PEI | `/import` |
| A copy of everything | `/export` |
| A new field, rule or name | `/customise` |
| A new read-only page | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run integrity -- help`) and then propose a new command for it.

## Hard rules

- Never mark an item fit for service, extend an interval or close a finding on your own judgement. Intervals come from the written scheme and the inspection body; a close needs the work order or report.
- Read every inspection, reading, valve test and certificate back before recording it: they cannot be deleted.
- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Cenosco IMS PEI.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/cenosco
