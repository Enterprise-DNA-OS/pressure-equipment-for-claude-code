---
description: Raise an anomaly from an inspection finding, with severity and due date
---

Run `npm run integrity -- anomaly <equipment> <description> [--severity=low|medium|high] [--due=YYYY-MM-DD] [--inspection=code]`. Use the inspector's words. For high severity, offer `/draft-anomaly` to tell the plant manager.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
