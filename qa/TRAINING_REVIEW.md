# Training-first redesign verification

Verified 12 October 2026 against the production build, not historical `qa/mobile`
captures. Work is local and uncommitted; no deployment or push was performed.

## Automated checks

- **143 tests passed, 0 failed.** Covers planning, logging, bodygraph/activity,
  progress, catalogue/source adapters, media, routines, migrations, and backup data.
- `npm run build` passes TypeScript compilation and generates the PWA shell.
- `npm run lint` exits successfully with React lifecycle/purity and Fast Refresh
  warnings; it is not a warning-free lint result.
- `git diff --check` passes.
- Impeccable's mechanical detector returned no findings for the checked UI.

## Production browser flow

`qa/training_flow.py` uses an isolated, headless Chromium profile and exercises
mobile 390×844 and desktop 1440×1000. Settings overflow checks also cover 320,
375, 768, and 1440px widths.

Passed:

1. Onboarding saves a profile and plan without silently creating a workout.
2. Explicit Start; load/reps, warm-up type, effort, and canonical kg storage with
   lb display survive pause/reload. One exercise-detail dialog opens at a time.
3. An incomplete set's fields appear above the toolbar at 390×844 after two
   completed sets. Demonstrations and secondary options expand on request.
4. Production app reloads, reads start/end exercise images and its local heading
   font, logs, finishes, and saves a routine with networking disabled.
5. Completion clears the active record; History excludes unfinished sessions and
   warm-ups from working-set counts. Strength respects the saved display unit.
6. Original front/back muscle artwork opens a selectable muscle inspector;
   Escape closes it. Text selection alternatives remain available.
7. Plan changes preview without writes; routines edit and start with empty sets.
   Starting another workout resumes rather than replaces the unfinished session.
8. Optional ExerciseDB details save and reopen offline. The browser test uses a
   documented-response fixture; live API/CORS and sample GIFs were checked
   separately. This is not a guarantee of upstream availability or GIF caching.
9. Backup exports routines and active workouts. Malformed restore is rejected
   without replacing existing records; a valid backup restores successfully.
10. No browser runtime errors or observed horizontal document overflow.

Reproduce on this Windows development environment:

```powershell
npm run build
python "C:\Users\Ishan\.agents\skills\webapp-testing\scripts\with_server.py" --server "npm run preview -- --host 127.0.0.1 --port 5190 --strictPort" --port 5190 -- python qa/training_flow.py
```

Requires Python Playwright with Chromium installed. Screenshots and JSON results
are written to `C:\Users\Ishan\AppData\Local\Temp\opencode\atlas-training-review`.

## Design review

A fresh reviewer inspected all 23 initial captures and requested eight material
fixes. The second bounded review scored all eight **resolved**, with disposition
**ship at the scored-fix scope**: shared Progress/Bodygraph theme, above-fold
logging, accurate direction/product records, local heading typography, removal
of Today's decorative pre-title, SVG completion icons, and non-overlapping
notifications. This is not a new whole-surface or actual-device approval.

The built system is recorded in `DESIGN.md` and `.impeccable/design.json`.
New app icons embed programmatic provenance; existing licensed exercise artwork
was not restyled. Font and catalogue/source attribution are in `ATTRIBUTION.md`.

## Remaining limits

- Actual iPhone Safari, installation, VoiceOver, background timer/audio behavior,
  and browser storage eviction need device testing.
- Final artwork acceptance is the user's decision.
- Build warns about the catalogue-heavy ~2.25MB JavaScript entry (~606KB gzip).
- ExerciseDB Free is personal/non-commercial, rate-limited, and browse-only.
  Its saved entries/media are not included in training backups; upstream GIFs
  may be missing. No account or paid API is required for core training.
