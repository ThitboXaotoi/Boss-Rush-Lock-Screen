# tools

- `atlas/` — art import (a Gemini picture in, a game-ready sprite out), atlas packer and palette lint. Spec: `design/art.md`. Owner: brief E. The import function in `atlas/src/index.ts` has no Node or DOM imports, because the web art bench uses it too.
  - `bun run --filter @boss-rush/tools art:import` — rebuild `art/export/` from `art/src/`.
- `livephoto/` — optional motion experiments (brief J, needs phone test S3).
