# Atlas Fit UI review and verification

The functional core and this interface pass are verified. The full project specification is not yet signed off.

## Changes in this pass

- Made the Bodygraph visible on the first mobile viewport, with a compact exercise selector and accessible primary/secondary target labels.
- Collapsed library filters and workout demonstrations so results and set logging are easier to reach.
- Fixed preference editing, preserved the existing profile, added save errors, and made profile updates wait for durable storage.
- Added modal keyboard wrapping, focus restoration, dismiss controls, and native inert-background behavior.
- Selected the newest saved plan consistently.
- Fixed the workout reload hook-order crash and added an asynchronous-history regression test.
- Made set changes and workout completion transactional so rapid edits cannot replace newer stored values.

UI/UX Pro Max informed touch sizing, disclosure, safe-area and focus checks. Frontend Design informed hierarchy and plain-language copy, while the specification's aubergine/blue/lilac palette remains authoritative. Framer Code Components was inspected; its Framer-only import and property-control rules were not applied to this React/Vite app.

## Evidence

- Production build: passed; PWA service worker generated.
- Vitest: 42 tests passed in 4 files.
- Chromium mobile: all six screens reviewed at 390 × 844, plus exercise detail.
- Bodygraph layout also checked at widths 375, 393 and 768.
- Verified onboarding, saved first plan, edit/cancel preferences, modal focus/return, mark/undo sets, workout reload, library filters/detail, exercise selection, front/back views, muscle drawer, horizontal overflow and reduced motion.
- Production offline check: app-shell reload, library/detail, workout resume, finish/save and history reload passed after initial caching.
- No JavaScript page errors occurred in the final browser flow.
- Screenshots are in [mobile](./mobile/), including [Bodygraph](./mobile/06-bodygraph.png) and [workout](./mobile/04-workout.png).

Repeat the browser check after building and starting a production preview:
```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4192 --strictPort
# In another terminal:
python scripts/verify-mobile.py http://127.0.0.1:4192
```

## Remaining specification work

- Six editable Figma layouts and reusable design components have not been delivered.
- The original SVG is implemented, but final artwork approval against the PDF reference and the specification's artist-authored vector requirement remains open.
- Actual iPhone Safari installation, standalone safe areas, VoiceOver and service-worker update behavior require device verification.
- A complete acceptance audit is still needed for scheduling/move-day actions, all-location inventory editing, exact-equipment and secondary-muscle library filters, and reviewed exercise mappings. The passing flow does not establish completion of those requirements.
- Asset rights and dataset mapping require the specified human review before release.
- Vite still reports large JavaScript chunks (exercise metadata and the main application). Device performance has not been measured.

This report covers observed checks, not a claim of full release readiness.
