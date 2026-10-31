---
description: Draft the request to the inspection body to book an inspection, with the due dates, certificate, valves and open items
---

Run `npm run integrity -- draft-booking <equipment>`. Show the draft. It goes to `drafts/` and nothing is sent: a person reviews it and sends it.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
