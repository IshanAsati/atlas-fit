# Attribution

## Exercise data

Exercise data by RepDB (repdb.co) — https://repdb.co/npm-exercise-dataset/

RepDB Free dataset licence: https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md
(review the bundled LICENSE before shipping). Attribution template:
https://github.com/RepDB/exercise-dataset/blob/main/ATTRIBUTION.md

Notes:
- Raw dataset redistribution is prohibited; only the user's own workout data
  (profile, plans, logs) is exported by the backup feature — never the dataset.
- RepDB illustrations must not be used to condition or restyle generative-AI output.
- The in-app mapping of RepDB muscle/equipment vocabulary to the Atlas Fit canonical
   taxonomy lives in `src/data/catalog.ts` and is manually reviewable per entry.

## Optional ExerciseDB OSS source

ExerciseDB Free V1 data and media by AscendAPI — https://ascendapi.com.

Documentation and usage restrictions: https://oss.exercisedb.dev/docs
(OpenAPI: https://oss.exercisedb.dev/swagger), checked during this implementation.

- Free usage is for personal, educational, community and non-commercial projects; monetised/commercial usage requires a paid plan.
- Requests are rate-limited. The app uses explicit user-triggered searches, not bulk mirroring.
- Media is 180p GIF; upstream files are not guaranteed available.
- Selected exercise details and successfully loaded demonstrations may be cached on the user's device. Raw ExerciseDB records are not exported in training backups.
- ExerciseDB entries are browse-only: missing difficulty, unreviewed taxonomy, and coarse equipment descriptions are not treated as safe planner eligibility.
- No profile, workout history, or session data is sent to the API. Search terms and normal network request metadata reach the service when the user searches or loads its media.

## Optional third-party GIF mirror (online only, explicit use)

A public Appwrite index (`atlas-fit/exercises`, read-only without login) can map
exercise names to mirror GIFs hosted on a CDN. Setup and key rules:
[`qa/APPWRITE.md`](qa/APPWRITE.md).

- Redistribution rights for these GIFs are UNVERIFIED: the mirror repo
  disclaims content ownership and its upstream source is gone. Treat every
  mirror demo as an unreviewed suggestion, never as Atlas Fit media.
- Mirror demos load only on an explicit tap and cache only on an explicit
  save, into the same offline media store as bundled illustrations.
- RepDB stays the offline default and the planner's only catalogue. Mirror
  GIFs are never bulk-bundled into the APK and never enter backups.

## Open-source libraries

Body typography: Nunito by Vernon Adams, self-hosted Latin variable WOFF2 from
Google Fonts. SIL Open Font License 1.1: `public/fonts/LICENSE-Nunito.txt`.
Heading typography: Baloo 2 by Ek Type, self-hosted Latin variable WOFF2 from
Google Fonts. SIL Open Font License 1.1: `public/fonts/LICENSE-Baloo2.txt`.
Source Sans 3 by Adobe remains bundled as a fallback. SIL Open Font License 1.1:
`public/fonts/LICENSE-SourceSans3.txt`. Fonts are precached for offline use; no hosted
font requests are made by the app.

Dexie.js · dexie-react-hooks · Vite + vite-plugin-pwa (Workbox) · React + React Router ·
Recharts · Motion · Vitest + Testing Library. See `package.json` for versions.
