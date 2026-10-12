# Atlas Fit

Atlas Fit is an offline-first training and nutrition PWA and Android app. It keeps
profiles, plans, strength/cardio workouts, routines, diet preferences, and backups on the device—no
account, backend, analytics, or paid API is required.

## Android app

The `android/` project wraps the same UI with Capacitor 8. The APK bundles the
catalogue, exercise images and fonts; it does not load a remote website. Requires
Android 8.0+ with a current Android System WebView. Health Connect requires
Android 9+ and a supported device/provider; Android 14+ includes it in Settings.

Build with Node 22+, Java 21 and Android SDK Platform 36 / Build Tools 35.0.0:

```powershell
# Set this to your installed SDK directory (or configure Android Studio).
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npm ci
npm run android:apk
```

The sideloadable debug APK is written to **`artifacts/atlas-fit-debug.apk`**.
Transfer it to your phone, open it and allow installation from that source.
For Android Studio: `npm run android:sync`, then `npm run android:open`.
Repeat `android:apk` after web changes; native assets update with the APK, not
the PWA service worker. `node scripts/android-icons.mjs` refreshes native icons
from the existing Atlas logo after changing that logo.

**Data stays on-device:** the Android app has separate storage from the website.
Export a JSON backup from the website, transfer it and use Settings → Choose
backup in Android to restore. Native export opens Android's share sheet so you
can save/send the JSON. Android automatic cloud backup is disabled. Uninstalling
or clearing app data erases local records—keep your own backup outside the app.

This debug build is for personal testing, not Play Store submission. Distribution
requires a private release signing key and a signed release APK/AAB; never commit
keys. Updates must use the same package ID and signing key to retain app data.
Optional online exercise browsing still needs internet and its existing
attribution/license restrictions apply. No broad storage permissions are used.

Checks: `npm run test` includes mocked native backup/theme tests;
`python qa/android_bundle.py` loads the actual APK's web assets in offline
Chromium, simulating the Android platform flag. This checks bundled onboarding,
saved-profile reload, workout logging/pause/resume, decoded exercise imagery
and disabled native service-worker registration, **not**
Android hardware. Check Back gestures, keyboard, share/restore, system bars and
workout pause/resume on your phone before relying on it for training.

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
- **Cardio** — its own screen from Today, with activity, duration, optional
  km/mi distance, effort, date, and separate history. Never counted as strength sets.
- **Diet & Nutrition** — its own screen from Today, with offline Indian
  vegetarian, eggetarian, and non-vegetarian meal weeks. Includes food exclusions
  and adult BMR/TDEE, calorie, macro, and BMI estimates. Portions and food totals
  are approximate; this is not a medical diet or certified allergy-safety tool.

### Training tools and Android health

- Suggested targets use completed working sets and effort, ignoring warm-ups,
  skipped/painful work and reduced deload history. Applying a suggestion fills
  only empty working rows; it never marks a set complete or rewrites user input.
- Lighter warm-ups are added explicitly before the first completed set. The
  kg/lb plate calculator uses equal pairs and labels the closest lower load.
- Optional 4/6/8-week blocks preserve history and unfinished workouts. The final
  deload week reduces new-session working sets and suggests lighter loads.
- Rest alerts and weekly workout reminders use local Android notifications.
  Permission is requested only from explicit controls. Android battery/Doze and
  exact-alarm access may affect timing; the browser has foreground alerts only.
- Today can read steps, distance and active energy through **Health Connect**.
  Connect explicitly, grant read access and ensure your health app syncs data
  into Health Connect. Atlas Fit does not collect sensors, write health records,
  upload readings, or save Health Connect values in its database/backups.
  Missing access/data is shown honestly, rather than inventing measurements.

The built-in catalogue includes backpack movements for home and travel:
front squat, Romanian deadlift, bent-over row, floor press, and overhead press.
The planner treats a loaded backpack as exact equipment, not as a generic
bodyweight substitute.

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

IndexedDB stores the local profile, plans, strength/cardio sessions, routines, feedback, and
optional saved ExerciseDB browsing records. Training backups export only Atlas
Fit training data and diet preferences—not Health Connect readings or the ExerciseDB catalogue. Export backups regularly;
browsers may reclaim local website storage.

## Verification

The current production browser flow passes at mobile and desktop widths,
including offline reload/logging/completion, kg/lb canonical storage,
equipment-aware routines, backup validation, media caching, and the interactive
muscle map. Actual iPhone Safari, installation, VoiceOver, and storage-eviction
testing remain device-level follow-ups. See [`qa/TRAINING_REVIEW.md`](qa/TRAINING_REVIEW.md).
