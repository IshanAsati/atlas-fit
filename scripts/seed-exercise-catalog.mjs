/** Bulk-import the third-party exercise-GIF index into Appwrite.
 *
 * Run locally AFTER scripts/provision-appwrite.mjs, with the secret in the
 * environment (never commit it):
 *
 *   $env:APPWRITE_API_KEY='<secret>'; node scripts/seed-exercise-catalog.mjs
 *
 * Source is the public mirror CSV; GIF bytes are NOT uploaded — documents
 * store jsDelivr CDN URLs so the APK stays small and the app caches chosen
 * demos at runtime on explicit save. Re-running updates changed rows.
 * Uses TablesDB and the current rows.write API-key scope.
 */
const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? 'https://cloud.appwrite.io/v1';
const PROJECT = process.env.APPWRITE_PROJECT_ID ?? '6acd1fed003d66ca7fb5';
const KEY = process.env.APPWRITE_API_KEY;
if (!KEY) {
  console.error('Set APPWRITE_API_KEY in the environment. The key is never read from files.');
  process.exit(1);
}
const DB = 'atlas-fit';
const TABLE = 'exercises';
const CSV_URL = 'https://raw.githubusercontent.com/omercotkd/exercises-gifs/main/exercises.csv';
const gifUrl = (id) => `https://cdn.jsdelivr.net/gh/omercotkd/exercises-gifs@main/assets/${id}.gif`;
const headers = { 'Content-Type': 'application/json', 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': KEY };

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function putRow(id, data) {
  const path = `/tablesdb/${DB}/tables/${TABLE}/rows`;
  for (let attempt = 0; attempt < 5; attempt++) {
    let response = await fetch(`${ENDPOINT}${path}`, {
      method: 'POST', headers, body: JSON.stringify({ rowId: id, data }),
    });
    if (response.ok) return 'created';
    if (response.status === 409) {
      response = await fetch(`${ENDPOINT}${path}/${id}`, {
        method: 'PATCH', headers, body: JSON.stringify({ data }),
      });
      if (response.ok) return 'updated';
    }
    if (response.status === 429 || response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      continue;
    }
    throw new Error(`PUT ${id} → ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  throw new Error(`PUT ${id}: rate-limited after retries`);
}

const source = await fetch(CSV_URL);
if (!source.ok) throw new Error(`Catalogue download failed: HTTP ${source.status}`);
const csv = await source.text();
const rows = parseCsv(csv);
const header = rows.shift() ?? [];
const at = (row, name) => row[header.indexOf(name)] ?? '';
let created = 0, updated = 0, skipped = 0;
for (const field of ['id', 'name', 'bodyPart', 'equipment', 'target']) {
  if (!header.includes(field)) throw new Error(`Catalogue is missing the ${field} column`);
}
let next = 0, failure;
// Four bounded workers keep a full import practical; deterministic row IDs make
// interrupted imports safe to resume without creating duplicate exercises.
async function worker() {
  while (!failure && next < rows.length) {
    const row = rows[next++];
    const id = at(row, 'id').trim();
    const name = at(row, 'name').trim().toLowerCase();
    if (!/^[0-9]{1,8}$/.test(id) || !name) { skipped++; continue; }
    try {
      const outcome = await putRow(id, {
        exId: id, name, bodyPart: at(row, 'bodyPart').trim().slice(0, 64),
        equipment: at(row, 'equipment').trim().slice(0, 64),
        target: at(row, 'target').trim().slice(0, 64), gifUrl: gifUrl(id),
      });
      if (outcome === 'created') created++; else updated++;
      if ((created + updated) % 50 === 0) console.log(`…${created + updated} stored (${created} new, ${updated} updated)`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (error) {
      failure = error;
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
if (failure) throw failure;
console.log(`Done: ${created} created, ${updated} updated, ${skipped} skipped.`);
