/** One-time Appwrite setup for the public exercise-GIF index.
 *
 * Run locally with the secret in the environment (never commit it, never put
 * it in a VITE_ variable — those ship to browsers):
 *
 *   $env:APPWRITE_API_KEY='<secret>'; node scripts/provision-appwrite.mjs
 *
 * Creates, idempotently where the API allows it:
 * - database `atlas-fit`
 * - collection `exercises` with read("any") so GIF lookups need no auth
 * - string attributes: exId, name, bodyPart, equipment, target, gifUrl
 * - unique index on exId, fulltext index on name
 * - storage bucket `media` with read("any") for future custom uploads
 */
const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? 'https://cloud.appwrite.io/v1';
const PROJECT = process.env.APPWRITE_PROJECT_ID ?? '6acd1fed003d66ca7fb5';
const KEY = process.env.APPWRITE_API_KEY;
if (!KEY) {
  console.error('Set APPWRITE_API_KEY in the environment. The key is never read from files.');
  process.exit(1);
}
const DB = 'atlas-fit';
const COLLECTION = 'exercises';
const BUCKET = 'media';
const headers = { 'Content-Type': 'application/json', 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': KEY };

async function call(method, path, body) {
  const response = await fetch(`${ENDPOINT}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* Appwrite errors are still JSON; be lenient. */ }
  if (!response.ok && response.status !== 409) {
    throw new Error(`${method} ${path} → ${response.status}: ${text.slice(0, 300)}`);
  }
  return { status: response.status, json };
}

async function waitFor(getter, label) {
  for (let i = 0; i < 60; i++) {
    const { json } = await getter();
    if (json?.status === 'available') return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`${label} never became available`);
}

const db = await call('POST', '/databases', { databaseId: DB, name: 'Atlas Fit' });
console.log('database:', db.status === 409 ? 'exists' : 'created');

const collection = await call('POST', `/databases/${DB}/collections`, {
  collectionId: COLLECTION, name: 'Exercise GIF index',
  permissions: ['read("any")'], documentSecurity: false,
});
console.log('collection:', collection.status === 409 ? 'exists' : 'created');

const attributes = [
  ['exId', 8], ['name', 128], ['bodyPart', 64],
  ['equipment', 64], ['target', 64], ['gifUrl', 512],
];
for (const [key, size] of attributes) {
  const created = await call('POST', `/databases/${DB}/collections/${COLLECTION}/attributes/string`,
    { key, size, required: key === 'exId' || key === 'name' || key === 'gifUrl' });
  if (created.status !== 409) {
    await waitFor(() => call('GET', `/databases/${DB}/collections/${COLLECTION}/attributes/${key}`), key);
  }
  console.log(`attribute ${key}:`, created.status === 409 ? 'exists' : 'ready');
}

for (const [key, type, fields] of [['by-exid', 'unique', ['exId']], ['by-name', 'fulltext', ['name']]]) {
  const index = await call('POST', `/databases/${DB}/collections/${COLLECTION}/indexes`,
    { key, type, attributes: fields });
  console.log(`index ${key}:`, index.status === 409 ? 'exists' : 'accepted');
}

const bucket = await call('POST', '/storage/buckets', {
  bucketId: BUCKET, name: 'App media', permissions: ['read("any")'], fileSecurity: false,
});
console.log('bucket:', bucket.status === 409 ? 'exists' : 'created');
console.log('Done. Reads need no key; writes stay key-gated.');
