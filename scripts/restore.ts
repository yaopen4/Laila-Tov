/**
 * Restore a Firestore export made by `npm run backup`.
 *
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project FIREBASE_CLIENT_EMAIL=... \
 *   FIREBASE_PRIVATE_KEY=... npm run restore -- backups/firestore-<...>.json
 *
 * Refuses to write into a project that already has data unless --force is passed:
 * restoring over live data overwrites every document with the same id, which is
 * rarely what anyone means at 2am. Documents that exist only in the live project
 * are left alone either way.
 *
 * Auth accounts are restored separately: `firebase auth:import backups/auth.json`.
 */
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, GeoPoint, Timestamp, type Firestore } from 'firebase-admin/firestore';

import { readServiceAccount } from '../src/lib/serviceAccount';

type Dump = Record<string, { data: unknown; subcollections?: Record<string, Dump> }>;

const args = process.argv.slice(2);
const force = args.includes('--force');
const file = args.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('Usage: npm run restore -- <backup.json> [--force]');
  process.exit(1);
}

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

/** Inverse of backup.ts's encode(). */
function decode(value: unknown, firestore: Firestore): unknown {
  if (Array.isArray(value)) return value.map((v) => decode(v, firestore));
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 1 && typeof obj.__timestamp === 'string') {
      return Timestamp.fromDate(new Date(obj.__timestamp));
    }
    if (keys.length === 1 && Array.isArray(obj.__geopoint)) {
      const [lat, lng] = obj.__geopoint as [number, number];
      return new GeoPoint(lat, lng);
    }
    if (keys.length === 1 && typeof obj.__ref === 'string') {
      return firestore.doc(obj.__ref);
    }
    return Object.fromEntries(keys.map((k) => [k, decode(obj[k], firestore)]));
  }
  return value;
}

async function main() {
  const backup = JSON.parse(readFileSync(file!, 'utf8')) as {
    projectId: string;
    collections: Record<string, Dump>;
  };

  if (!force) {
    const existing = await db.listCollections();
    if (existing.length > 0) {
      console.error(
        `Refusing to restore: project ${projectId} already contains ` +
          `${existing.map((c) => c.id).join(', ')}. Pass --force to overwrite matching documents.`
      );
      process.exit(1);
    }
  }

  if (backup.projectId !== projectId) {
    console.warn(`Note: backup was taken from ${backup.projectId}, restoring into ${projectId}.`);
  }

  // BulkWriter batches, retries and throttles for us; plain batches cap at 500 writes.
  const writer = db.bulkWriter();
  let count = 0;

  const restore = (path: string, dump: Dump) => {
    for (const [id, { data, subcollections }] of Object.entries(dump)) {
      writer.set(db.doc(`${path}/${id}`), decode(data, db) as Record<string, unknown>);
      count++;
      for (const [sub, subDump] of Object.entries(subcollections ?? {})) {
        restore(`${path}/${id}/${sub}`, subDump);
      }
    }
  };

  for (const [collection, dump] of Object.entries(backup.collections)) {
    restore(collection, dump);
  }

  await writer.close();
  console.log(`Restored ${count} documents into ${projectId} from ${file}`);
}

main().catch((error) => {
  console.error('Restore failed:', error);
  process.exit(1);
});
