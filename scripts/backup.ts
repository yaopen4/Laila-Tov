/**
 * Export every Firestore document to a local JSON file.
 *
 * Firebase's managed backups need the paid Blaze plan; this app runs on the free
 * Spark plan, so this script is the backup. Run it on a schedule from a trusted
 * machine and keep the output somewhere private: it contains family data.
 *
 *   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}' \
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project npm run backup
 *
 * (or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY). Writes
 * backups/firestore-<project>-<timestamp>.json. Against the emulator it needs only
 * FIRESTORE_EMULATOR_HOST.
 *
 * Timestamps are written as {"__timestamp": "<ISO>"} so a restore can rebuild them.
 * Auth accounts are not included: export them with `firebase auth:export`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import {
  getFirestore,
  GeoPoint,
  Timestamp,
  DocumentReference,
  type CollectionReference,
} from 'firebase-admin/firestore';

import { readServiceAccount } from '../src/lib/serviceAccount';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error('Set NEXT_PUBLIC_FIREBASE_PROJECT_ID (or FIREBASE_PROJECT_ID).');
  process.exit(1);
}

const serviceAccount = process.env.FIRESTORE_EMULATOR_HOST ? null : readServiceAccount(process.env);
if (getApps().length === 0) {
  initializeApp(
    serviceAccount
      ? { projectId, credential: cert({ projectId, ...serviceAccount }) }
      : { projectId }
  );
}
const db = getFirestore();

function encode(value: unknown): unknown {
  if (value instanceof Timestamp) return { __timestamp: value.toDate().toISOString() };
  if (value instanceof GeoPoint) return { __geopoint: [value.latitude, value.longitude] };
  if (value instanceof DocumentReference) return { __ref: value.path };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  }
  return value;
}

type Dump = Record<string, { data: unknown; subcollections?: Record<string, Dump> }>;

async function dumpCollection(ref: CollectionReference): Promise<Dump> {
  const out: Dump = {};
  for (const snap of (await ref.get()).docs) {
    const subs = await snap.ref.listCollections();
    out[snap.id] = { data: encode(snap.data()) };
    if (subs.length > 0) {
      out[snap.id].subcollections = {};
      for (const sub of subs) out[snap.id].subcollections![sub.id] = await dumpCollection(sub);
    }
  }
  return out;
}

async function main() {
  const result: Record<string, Dump> = {};
  let count = 0;
  for (const collection of await db.listCollections()) {
    result[collection.id] = await dumpCollection(collection);
    count += Object.keys(result[collection.id]).length;
  }

  mkdirSync('backups', { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join('backups', `firestore-${projectId}-${stamp}.json`);
  writeFileSync(file, JSON.stringify({ projectId, exportedAt: new Date().toISOString(), collections: result }, null, 2), { mode: 0o600 });
  console.log(`Exported ${count} top-level documents from ${Object.keys(result).length} collections to ${file}`);
}

main().catch((error) => {
  console.error('Backup failed:', error);
  process.exit(1);
});
