# Moving off Cenosco IMS PEI

Cenosco IMS PEI holds your asset hierarchy, inspection history, thickness data and inspection schedule. Its Import Wizard works from Excel templates, and Cenosco offers data migration and integration services. To move across, get the same records out as spreadsheets, save each one as CSV, and run one import.

## 1. Get the records out

Ask your IMS administrator or Cenosco for an export of each of these, or run the reports you already use and save each sheet as CSV (UTF-8). One file per kind, all in one folder:

| File | One row per | Columns read (first match wins) |
|---|---|---|
| `Equipment.csv` | item | Tag / Equipment / Asset ID / Functional location, Description / Name, Site / Plant / Location / Unit, Equipment type / Type / Class, Hazard level, Fluid / Service, Design pressure (kPa) / MAWP, Design temperature (C), Manufacturer, Serial number, Year built, Internal interval (months), External interval (months), In service date |
| `Inspections.csv` | inspection done | Tag, Inspection date / Date / Completed, Inspection type / Type / Task, Result / Outcome / Condition, Inspector, Inspection body / Company, Report / Report number, Findings / Comments / Remarks |
| `Thickness.csv` | reading | Tag, CML / TML / Point, Location, Nominal thickness, Required thickness / Minimum required / t-min / Retirement thickness, Date, Thickness / Measured thickness / Reading |
| `ReliefValves.csv` | relief valve | Valve / Valve tag / PSV, Tag (the item it protects), Set pressure (kPa), Size, Test interval, Last test date, Result, Tested by |

Dates can be `YYYY-MM-DD` or `DD/MM/YYYY`. Pressures are kPa gauge. Thickness is mm.

If your headings differ, write a map file and pass it with `--map`: `{ "equipment": { "Tag": "Equipment Number", "Description": "Equipment Name" }, "thickness": { "Required thickness": "t-req" } }`. The left side is the heading above, the right side is the heading in your file.

## 2. Do a test run

```bash
npm run integrity -- import ims ./ims-export --dry-run --country=NZ
```

Nothing is written. If a row names an item that is not in the file or the database, a date is not a real date, or a number is missing, the whole import stops with the file and row, and nothing is kept. `--country` sets the country of any new site (NZ or AU), which decides whether the Australian registration checks apply.

## 3. Import

```bash
npm run integrity -- import ims ./ims-export
npm run integrity -- compliance
npm run integrity -- due
```

Running it again is safe: items update by tag, inspections match on item, date and kind, readings on point and date.

## What maps

- Equipment type words become a kind: boiler, air receiver, heat exchanger (exchanger, calandria, condenser, cooler), refrigeration vessel (refrigeration, ammonia), autoclave, piping, otherwise pressure vessel.
- Inspection type words become internal, external (external or visual), thickness (thickness, UT, ultrasonic) or on-stream. Results with fail, reject or unfit become fail; condition, recommend or monitor become pass with conditions; the rest pass.
- Each new site name becomes a site with a short code.

## What does not carry over

- RBI models: probability and consequence of failure, damage factors and risk targets. This system schedules from your written scheme, half the remaining life and the ten-year ceiling. Enterprise DNA can add a risk ranking that fits your method.
- Corrosion loops, damage mechanism libraries, 3D models and drawings. Attach drawing numbers as notes with `/log`.
- Certificates of inspection: record the current one for each item with `/certify` (the import does not guess expiry dates).
- Anomalies: raise open ones with `/anomaly`, using the inspector's words.
- User accounts and approval workflows.

Want this done for you, mapping included? https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=docs&utm_campaign=cenosco
