# Atlas Fit

Atlas Fit is an iPhone-first, offline-first strength-training PWA. It keeps
profiles, plans, workouts, routines, feedback, and backups on the device—no
account, backend, analytics, or paid API is required.

## Product flow

- **Today** — see the next workout, preview real exercise illustrations, and
  explicitly start or resume a session.
- **Plan** — adapt time, location, weekdays, and exercises with a preview;
  create, edit, repeat, and download reusable routines.
- **Library** — search the curated local catalogue, inspect instructions and
  muscle targets, and optionally browse ExerciseDB Free through an explicit
  online search. ExerciseDB entries are browse-only and never enter planning
  automatically.
- **Progress** — review completed history, recorded strength, and primary /
  secondary muscle involvement through original selectable front/back artwork.
- **Workout** — focused set logging with warm-up distinction, previous-set
  comparison, kg/lb display, effort, discomfort feedback, rest timer, swaps,
  autosave, pause/resume, and completion summaries.

## Develop

```bash
npm install
npm run dev        # local Vite server
npm run typecheck  # strict TypeScript check
npm run test       # Vitest suite
npm run build      # production PWA into dist/
npm run icons      # regenerate PWA icon assets
```

The production browser flow can be run with Playwright using:

```powershell
python "C:\Users\Ishan\.agents\skills\webapp-testing\scripts\with_server.py" --server "npm run preview -- --host 127.0.0.1 --port 5190 --strictPort" --port 5190 -- python qa/training_flow.py
```

## Catalogue and attribution

The local catalogue combines curated Atlas Fit entries with the RepDB Free
dataset, normalized into the canonical muscle and equipment taxonomy. Review
the bundled dataset license before redistribution. RepDB attribution is shown
in the app and recorded in [`ATTRIBUTION.md`](ATTRIBUTION.md).

ExerciseDB Free V1 is an optional personal/non-commercial browse source by
AscendAPI. It is rate-limited, uses 180p GIF media, requires attribution, and
does not receive profile or workout-log data. See [`ATTRIBUTION.md`](ATTRIBUTION.md)
and [`PRODUCT.md`](PRODUCT.md).

The bodygraph is original hand-authored vector geometry with stable per-muscle
IDs. The app icon is original programmatic artwork. Source Sans 3 is locally
hosted under the SIL Open Font License; its license is in `public/fonts/`.

## Storage and privacy

IndexedDB stores the local profile, plans, sessions, routines, feedback, and
optional saved ExerciseDB browsing records. Training backups export only Atlas
Fit training data—not the ExerciseDB catalogue. Export backups regularly;
browsers may reclaim local website storage.

## Verification

The current production browser flow passes at mobile and desktop widths,
including offline reload/logging/completion, kg/lb canonical storage,
equipment-aware routines, backup validation, media caching, and the interactive
muscle map. Actual iPhone Safari, installation, VoiceOver, and storage-eviction
testing remain device-level follow-ups. See [`qa/TRAINING_REVIEW.md`](qa/TRAINING_REVIEW.md).
