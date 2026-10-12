# Android package verification

Built locally on 12 October 2026. Native project uses Capacitor 8, package
`com.ishanasati.atlasfit`, version 1.0 (code 1), min SDK 24 and target SDK 36.

- Output: `artifacts/atlas-fit-debug.apk`, 22.18 MiB, debug-signed for sideloading.
- `assembleDebug` passed; `apksigner verify --verbose` passed (APK v2 signature).
- Android metadata verified with `aapt dump badging`: Atlas Fit launcher,
  min/target SDKs and no broad storage permissions.
- **27 test files / 280 tests passed**, including native JSON cache-file sharing,
  failed share/write handling and system-bar theme matching.
- TypeScript and Vite build passed. Lint has existing React warnings.
- `qa/android_bundle.py` passed using the actual APK, not a development server:
  bundled onboarding, profile reload, workout logging/pause/resume, decoded
  exercise image, zero service-worker registrations, no external requests,
  no horizontal overflow at 320/390/1440 and zero page errors.
- APK asset smoke checks use offline Chromium with a simulated Android flag;
  **no real Android device or emulator was tested**. Native share/restore file
  picker, keyboard, system bars, Back gestures, installation and OS process death
  still require device checks.

The UI, catalogue, images and fonts are bundled. Native service-worker
registration is skipped because updates arrive through APK replacement. IndexedDB
is separate from browser data; transfer an exported JSON backup explicitly.
Automatic Android cloud backup is disabled. Native export uses the OS share
sheet; keep a copy outside the app before uninstalling or clearing data.

Runtime npm audit is clean (`npm audit --omit=dev`). The CLI's development-only
Xcode/uuid dependency chain reports three moderate upstream audit findings; these
are not bundled into the Android APK. Existing Vite large-bundle and Android
template flatDir warnings remain. This is not a Play Store release or full device
compatibility approval. Signing keys and APK/build output are git-ignored.
