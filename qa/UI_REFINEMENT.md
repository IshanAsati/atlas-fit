# UI and wording refinement

Verified 12 October 2026. Preserves the current stone/lilac reference-inspired UI,
workout data model, offline behavior, original bodygraph, and exercise media.
These checks ran locally before GitHub publication.

## Changes

- Clearer Today, Plan, Library, Progress, Settings, and workout wording.
- Consistent “Save offline images” actions and readable movement/equipment names.
- Routine guidance explains how to build and repeat workouts; the builder no
  longer shows a conflicting empty-state message.
- Today offers a working retry after a load failure and does not invent a
  duration for active custom workouts.
- Dark-purple links and focus rings, stronger supporting-text contrast, readable
  selected controls, wrapping exercise names, and opaque sticky headers.
- iPhone-friendly field sizes and matching PWA theme colors.
- `DESIGN.md` documents the light/dark system instead of forest/chalk.
- Device-following theme with System/Dark/Light override, a stable Today header,
  readable navigation hover states, onboarding Back, and “Sultan pai”.
- Muscle focus, equipment avoidance, searchable exercise exclusions, and searchable
  location-specific inventories; details are in `qa/GENERATOR_REVIEW.md`.

## Checks

- Automated tests cover load retry, custom-workout guidance, search recovery,
  stable movement filter ids, both themes' contrast, and training preferences.
  See the latest `npm run test` output for the expanded suite's count.
- Production build and TypeScript compilation passed.
- Lint exited successfully with existing React lifecycle/purity and Fast Refresh
  warnings; it is not warning-free.
- `git diff --check` passed.
- Two bounded production Chromium checks passed: mobile and desktop screenshots,
  overflow checks at 320/375/390/768/1440px, offline reload and workout completion,
  routine editing, session protection, progress, bodygraph, and backup restore.
- No browser runtime errors. ExerciseDB uses a contract fixture in this flow,
  not a live-service availability check.
- Latest rendered check: **1,567 text checks, 429 hover checks, zero contrast
  failures**. Theme/Back/header/equipment guards also passed.
- Targeted preference controls passed stored-data browser assertions at
  320/390/1440px with zero runtime errors.
- Mechanical detector on the initial preference controls: one advisory font-size
  finding in existing onboarding content, no non-advisory findings.
  This is not a claim of zero visual defects or whole-interface accessibility.

Screenshots and browser results:
`C:\Users\Ishan\AppData\Local\Temp\opencode\atlas-training-review`.
Reproduction command is in `qa/TRAINING_REVIEW.md`.

## Remaining limits

Actual iPhone Safari, installation, VoiceOver, background timers, and storage
eviction still need device testing. The production build retains its existing
catalogue-heavy JavaScript bundle warning (approximately 2.29MB, 616KB gzip).
