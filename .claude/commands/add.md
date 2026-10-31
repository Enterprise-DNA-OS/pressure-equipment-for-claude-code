---
description: Add a site, an item of equipment, a thickness monitoring point or a relief valve
---

Run one of `npm run integrity -- add site <code> <name> --country=NZ|AU [--body=..]`, `add equipment <tag> <name> --site=.. --kind=.. [--hazard=A-E] [--pressure=kPa] [--internal=months] [--external=months] [--in-service=YYYY-MM-DD] [--design-reg=..] [--item-reg=..]`, `add cml <equipment> <code> --location=.. --nominal=mm --required=mm`, or `add valve <code> --on=<equipment> --set=kPa [--service=typical|clean] [--interval=months]`. The intervals come from the written scheme and the inspection body, never a guess: ask if they are not given. Read the record back afterwards.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
