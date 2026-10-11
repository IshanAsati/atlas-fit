# Atlas Fit

Offline-first personal strength-training PWA (iPhone-first, installed via Safari → Add to Home Screen).
Built per `ATLAS_FIT_SPEC.md` (v1.0): React + TypeScript + Vite, Dexie/IndexedDB storage,
rule-based plan generator (no AI API, no backend, ₹0 recurring cost).

## Six screens

| Route | Screen |
| --- | --- |
| `/onboarding` | Preferences (10 essential questions → proposed week → Start) |
| `/home` | Dashboard: greeting, next-workout hero, 7-day strip, recent session, mini Bodygraph |
| `/plan` | Plan generator: config, day cards, "Why this plan?", swap/pin/start |
| `/workout/:id` | Active workout: set logging, rest timer, targets, substitute, autosave |
| `/exercises` · `/exercises/:id` | Library + detail with linked mini Bodygraph |
| `/bodygraph` | Bodygraph & progress: exercise targets / training activity + charts |

## Develop

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # tsc, strict
npm run test       # vitest (planner determinism, equipment filters, sessions, backup)
npm run build      # production PWA into dist/
npm run icons      # regenerate PWA icon assets
```

## Exercise catalogue & rights evidence (§6, §14)

- **56 curated Atlas Fit entries** (`src/data/catalog.ts`): original instructions/cues with
  manually reviewed primary/secondary muscle assignments.
- **RepDB Free, 609 entries** (`@repdb/exercises`, local package, no runtime API):
  normalised by `src/data/repdb.ts` into the canonical muscle/equipment taxonomy.
  **571/609** entries map confidently and are eligible for planning; **38** stay
  browse-only pending human review (conditioning pieces, static skill holds, specialist
  machines, `supraspinatus` involvement). Review the bundled `LICENSE.md` before shipping.
- **Visible attribution** (RepDB Free licence requirement) is rendered in-app on Home,
  Library and Bodygraph screens: `Exercise data by RepDB (repdb.co)`.
- RepDB illustrations are hotlinked from the package CDN and cached on demand by the
  service worker (CacheFirst, 300 entries / 90 days) — never used as generative-AI input.
- **Bodygraph artwork** (`src/features/bodygraph/geometry.tsx`) is original hand-authored
  vector geometry: faceless segmented cartoon, stable per-muscle IDs. Not traced from any app.
- **App icon** (`public/icons/`, `scripts/gen-icons.mjs`) is original programmatic artwork.

## Privacy & storage

Local-first: profile, plans, sessions and feedback live in IndexedDB (Dexie) on the device
only. JSON export/import lives under Home → ⚙. iOS may evict website storage — export
occasionally. No accounts, no analytics, no uploads.
