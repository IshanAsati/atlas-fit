# Appwrite backend: public exercise-GIF index

Read-only REST for demos, no login. Writes stay key-gated.

## What lives server-side

- Database `atlas-fit`, collection `exercises`: `{ exId, name, bodyPart,
  equipment, target, gifUrl }`. Reads are `read("any")` — the app fetches with
  only the endpoint + project ID, no secret.
- Storage bucket `media` (`read("any")`) for future custom uploads.
- GIF bytes are NOT uploaded: documents point at the jsDelivr CDN mirror, so
  the APK stays small. The app caches chosen demos at runtime into
  `OFFLINE_MEDIA_CACHE` on explicit save — that is what makes them work
  offline inside the Android WebView.

## One-time setup (needs a valid key for THIS project)

The key must belong to project `6acd1fed003d66ca7fb5` with scopes:
`databases/collections/attributes/indexes/documents` read+write and
`buckets/files` read+write. A key from another project returns
`api_key_invalid` — create the key inside this project instead.

```powershell
$env:APPWRITE_API_KEY='<secret>'   # env only: never commit, never VITE_-prefix
node scripts/provision-appwrite.mjs
node scripts/seed-exercise-catalog.mjs
```

Verify public reads (no key):

```powershell
Invoke-RestMethod 'https://cloud.appwrite.io/v1/databases/atlas-fit/collections/exercises/documents/0001' `
  -Headers @{ 'X-Appwrite-Project'='6acd1fed003d66ca7fb5' }
```

## Import with the current TablesDB API

`scripts/seed-exercise-catalog.mjs` writes through
`/tablesdb/atlas-fit/tables/exercises/rows` and requires `rows.write`.
The existing `atlas-fit/exercises` collection is the same underlying resource
as the TablesDB table; there is no need to create another database or duplicate
the catalogue. The older provisioning script above still uses the legacy
collection/attribute API.

The public client can continue reading the existing document endpoint.
Search requests must send separate `queries[]` parameters containing JSON
query objects, rather than one `queries` parameter containing an array.

## Rules

- Secrets never enter git, chat logs aside — rotate any key pasted anywhere.
- Client code (`src/data/exerciseGifs.ts`) sends no key. Vercel env keys are
  for build/server use only; a `VITE_`-prefixed key ships to browsers.
- Mirror GIF rights are unverified (see ATTRIBUTION.md): online enhancement
  only, RepDB stays the offline default. Do not bulk-bundle mirror GIFs into
  the APK.
- Personal workout/profile sync would need auth — out of scope on purpose:
  public write access would let anyone overwrite records.
