---
description: Build the outage work list: internals, relief valve tests and open anomalies due before the next shutdown
---

Ask the shutdown dates if they are not given. Run `shutdown-plan`, `valves-due`, `open-anomalies` and `remaining-life` with `--json`. List per site every internal due within a year of the shutdown, every valve due before the following one, the anomalies to close, and the monitoring points to measure. Write it to `drafts/shutdown-plan-YYYY-MM-DD.md` and run `npm run view -- shutdown`.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
