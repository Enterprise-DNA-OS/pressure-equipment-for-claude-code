---
description: Bring the equipment register, inspection history, thickness readings and relief valves across from Cenosco IMS PEI sheets saved as CSV
---

Read docs/replace-cenosco.md. Run `npm run integrity -- import ims <folder> --dry-run` first and show the counts. Map different headings with `--map=file.json`. Only run without `--dry-run` once the operator says yes. Compare counts afterwards and run `/compliance` and `/due`.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
