---
description: Record an inspection done: kind, result, inspector, report number and findings
---

Run `npm run integrity -- inspect <equipment> --kind=internal|external|thickness|on-stream --result=pass|"pass with conditions"|fail [--date=YYYY-MM-DD] [--by=..] [--body=..] [--report=..] [--findings=".."]`. Read the details back before running it: inspection records cannot be deleted. If the result is a fail or has conditions, offer to raise each finding with `/anomaly`.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
