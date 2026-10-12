# Generator and training preferences

Verified locally on 12 October 2026, before GitHub publication.

## Behaviour

- Onboarding's existing Movement Comfort step and Settings share muscle-focus,
  equipment-avoidance, and searchable individual-exercise controls.
- Abs/core and Legs presets supplement the individual muscle selections.
- Availability and comfort are separate: avoided gear remains in inventory.
  Equipment avoidance and exercise restrictions are hard constraints, including
  for pins and when the eligible pool is empty.
- Muscle focus biases selection and repairs uncovered requested primary targets
  where a replacement fits. The rest of the body is not excluded. Unavailable
  focus is explained, not satisfied by violating boundaries.
- Weekly rotation, recent completed sessions, push/pull balance and primary-muscle
  concentration influence selection. Repeats remain possible with small pools.
- Main lifts precede assistance/core work. Duration estimates include work,
  between-set rest and setup. Static holds receive seconds rather than reps.
- Controlled, reviewed movements are preferred for strength; mobility goals
  prioritise mobility movements. These are deterministic heuristics, not clinical
  advice or a guarantee of measured training outcomes.
- Existing pinned prescriptions remain intact. Saved history is not rewritten.
- Optional preferences persist in IndexedDB and backups; older backups still
  import. Malformed preference arrays are rejected before storage is replaced.
- New gear and curated exercises expand abs/core and leg choices. Imported gear
  must match the real requirement rather than imply equipment equivalence.

## Regression entry points

```powershell
npm run test
npm run typecheck
npm run build
npm run lint
```

Focused tests: `src/tests/planQuality.test.ts`,
`src/tests/plannerPreferences.test.ts`, `src/data/backupPreferences.test.ts`,
`src/data/equipmentExpansion.test.ts`, and
`src/features/planner/TrainingPreferences.test.tsx`.

Final automated check: **25 test files / 272 tests passed**. TypeScript and
production build passed; lint passed with the existing React warnings. The
production offline training/backup smoke check and the ten stored-data preference
browser checks passed with zero page errors. No physical iPhone was tested.

Browser checks: `qa/preferences_check.py` (isolated development port 5192) and
`qa/training_flow.py` (production preview port 5190), using the webapp-testing
`with_server.py` helper. Pass Vite `--host 127.0.0.1 --strictPort` so an occupied
port cannot silently move the server and leave the check on an older build.
The preference check asserts saved plan/profile data,
not just visible chip state, and covers 320/390/1440px widths.

The offline smoke test retains strict image-decoding assertions but waits for
the asynchronous cached-image decode after switching the pose. Visibility alone
is not treated as a successful offline image. Pack results may truthfully report
unavailable licensed images; written instructions remain available. Both poses
of the logged smoke-test exercise must still decode offline.

## Limits

The extension's finish reviewer scored its three type-size/category-label fixes
resolved. This is not a whole-app design or accessibility approval.

Time estimates are approximations, not promises to occupy every minute.
Per-muscle primary sets overlap and should not be summed as actual working sets.
Settings changes require an explicit weekly-plan update; historical workouts and
existing saved routines are not silently regenerated. Actual iPhone Safari,
VoiceOver, installation and storage eviction require device checks. The build
still has the pre-existing catalogue-heavy bundle warning.
