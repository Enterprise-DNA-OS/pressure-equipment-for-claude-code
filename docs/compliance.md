# Record checks for owners of pressure equipment

Sources checked 31 October 2026. This system checks your own records against the rules and settings below and lists what is missing, late or out of line. It does not inspect anything, issue a certificate, replace your written scheme of examination, your inspection body or your engineer, and it does not decide whether an item is fit for service.

Every check is one row type in `npm run integrity -- compliance`. The numbers they use are in the `settings` table (`/settings`, changed with `/setting`): set them from your written scheme and what your inspection body has agreed. The seeded values are demo values.

## The rules behind the checks

**New Zealand.** The [Health and Safety in Employment (Pressure Equipment, Cranes, and Passenger Ropeways) Regulations 1999](https://legislation.govt.nz/secondary-legislation/pco-drafted/1999/128/en/latest/) (SR 1999/128) put the duties on the equipment's controller (the owner, lessee or bailee): take all practicable steps so equipment is not operated without a current certificate of inspection, issued by an inspection body on the recommendation of the equipment inspector, and keep every current certificate of inspection and certificate of design verification at the workplace where the equipment is. WorkSafe's [overview of the regulations](https://worksafe.govt.nz/dmsdocument/419-health-and-safety-in-employment-pressure-equipment-cranes-and-passenger-ropeways-regulations-1999) and the Approved Codes of Practice for pressure equipment and for boilers set the detail your inspection body works to.

**Australia.** Under the model WHS Regulations, Schedule 5 Part 1 requires the design of pressure equipment (other than pressure piping) of hazard level A, B, C or D under AS 4343 to be registered, and Schedule 5 Part 2 requires boilers and pressure vessels of hazard level A, B or C to be registered as items of plant (gas cylinders and LP Gas fuel vessels for automotive use are excepted). See [WorkSafe Queensland: what type of plant requires registration](https://worksafe.qld.gov.au/licensing-and-registrations/plant-registration/what-type-of-plant-requires-registration) and [WorkSafe WA: what kinds of plant require registration](https://www.worksafe.wa.gov.au/what-kinds-plant-require-registration). Western Australia numbers this Schedule 5 Division 2, and WA mines register with the mines regulator. Some regulators still cite AS 4343:2005, others AS 4343:2014.

**In-service inspection.** AS/NZS 3788 (Pressure equipment: in-service inspection) sets inspection intervals by equipment type and condition. It is a paid standard, so this system does not copy its tables: each item carries the internal and external intervals from your written scheme (`/interval`), and the checks hold you to them.

**Corrosion and remaining life.** API 510 (Pressure Vessel Inspection Code) gives the method used in `v_cml_rates` and `v_due`: the long-term rate runs from the first reading to the latest, the short-term rate from the one before latest, and the higher governs (7.1.1); remaining life is the margin over the required thickness divided by that rate; and the internal interval is no more than half the remaining life or ten years, whichever is less (6.5.1.1). Relief valve test intervals are at most five years in typical process service and ten years in clean, nonfouling and noncorrosive service (6.6.3.2). Where your scheme or inspection body sets a shorter interval for a valve (boiler safety valves are usually annual), record it on the valve.

## Implemented checks

| Rule | What it finds | Setting or field | Basis |
|---|---|---|---|
| CERT-NONE | An in-service item with no certificate of inspection on record | `cert_levels_through` (4 means hazard levels A to D) | NZ SR 1999/128. Confirm which hazard levels need a certificate with your inspection body |
| CERT-EXPIRED | An in-service item whose latest certificate has expired | The expiry printed on the certificate | NZ SR 1999/128: not operated without a current certificate |
| INTERNAL-OVERDUE | The next internal inspection date has passed | `internal_interval_months` on the item, `half_life_factor`, `max_internal_years` | Your written scheme under AS/NZS 3788; API 510 6.5.1.1 |
| EXTERNAL-OVERDUE | The next external inspection date has passed | `external_interval_months` on the item | Your written scheme under AS/NZS 3788 |
| HALF-LIFE | The written scheme puts the next internal later than half the remaining life at the worst monitoring point | `half_life_factor` | API 510 6.5.1.1 |
| BELOW-REQUIRED | The latest reading at a monitoring point is under its required thickness | `required_mm` on the point, from the design calculation | API 510 7.1.1 and the design code; an engineering assessment or repair is needed |
| NO-RELIEF | An in-service vessel, boiler or receiver with no relief device recorded | Relief valves in the register | Overpressure protection under the design code (AS 1210, AS/NZS 1200) |
| RELIEF-SET-HIGH | A relief valve set above the design pressure of the item it protects | `set_pressure_kpa` against `design_pressure_kpa` | The design code's overpressure limits; check any accumulation allowance with your engineer |
| RELIEF-OVERDUE | A relief valve past its test date, or never tested within its interval | The valve's own interval, else `prv_months_typical` or `prv_months_clean` | API 510 6.6.3.2; your scheme |
| RELIEF-FAILED | A relief valve whose latest test failed, with no pass since | Valve tests | Your scheme |
| ANOMALY-OVERDUE | An open anomaly past its due date | `due_on` on the anomaly | Your inspection body's conditions |
| AU-ITEM-REGISTRATION | A boiler or vessel of hazard level A, B or C at an Australian site with no item registration number | `item_registration` | WHS Regulations Schedule 5 Part 2 |
| AU-DESIGN-REGISTRATION | Pressure equipment of hazard level A to D at an Australian site with no design registration number | `design_registration` | WHS Regulations Schedule 5 Part 1 |

`/attention` warns before these become findings, using the `warn_days_*` and `warn_remaining_life_yrs` settings: certificates expiring, internals, externals and valve tests coming due, anomalies coming due, monitoring points with short remaining life, and failed inspections with no later pass.

Inspection records, thickness readings, valve tests and certificates cannot be deleted: a mistake is corrected with a new record, so the history an inspector signs against stays whole.

If a rule here is out of date, say so and stop. The operator confirms the rule with their inspection body or the regulator, then the doc and the check change together through `/customise`.
