# Why there is no front end

Cenosco IMS PEI is a database with a subscription. Underneath it are ordinary records: an equipment register, inspections, thickness readings at monitoring points, relief valves, certificates and the findings that come out of each visit. What you pay for is the layer on top that lets people who do not write queries get at them: screens, filters, dashboards, forms.

That layer used to be the whole product, because talking to a database was hard. It is not hard any more. Open this folder in Claude Code, describe what you want ("which vessels go past half their remaining life before the next shutdown?"), and it runs the query and explains the answer.

## What you gain

- **Better answers.** The vendor's dashboard shows what the vendor charted. Here you ask your own question, in your own words.
- **No seats and no per-site fee.** The engineer, the plant manager and the inspector can all look. The bill does not grow with sites.
- **Your data in your Postgres.** Plain records. Back them up, query them from anything, leave any time.
- **The method in the open.** Every rate, remaining life and due date is a view you can read in `supabase/migrations/`, with the rule it follows.

## What you give up

- **A risk engine.** IMS PEI runs RBI to API 580 and 581. This schedules from your written scheme, half the remaining life and the ten-year ceiling. If your inspection body works from an RBI model, keep that model, or have Enterprise DNA build the risk ranking you use.
- **A tablet app for the inspector in the field.** Readings and results are entered after the visit, from the report. Enterprise DNA builds a mobile form if you want one.
- **3D models and drawings on screen.** Keep drawing numbers in notes.
- **A vendor help desk.** This is open source. Enterprise DNA supports the installed version for businesses that want someone to call.

## Who this fits

Plants with tens to a few hundred items of pressure equipment, a written scheme, and an outside inspection body: dairy, food and beverage, timber, chemicals, mining, hospitals and campuses. If your integrity programme runs on a full RBI model across a refinery, keep IMS PEI. If you need the register, the due dates and the corrosion picture more than the screens, this is cheaper and yours.

Installed and run for you: https://enterprisedna.co/omni/instead-of/cenosco
