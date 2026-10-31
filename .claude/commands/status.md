---
description: Mark an item in service, out of service or retired, or a relief valve removed
---

Run `npm run integrity -- status <equipment> in_service|out_of_service|retired`, or `valve-status <valve> in_service|removed`. Out of service items drop out of the due and compliance checks: say so, and ask for the isolation reference to log with `/log`.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
