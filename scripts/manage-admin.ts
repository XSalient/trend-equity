/**
 * Admin Role Management CLI
 *
 * Usage:
 *   npm run admin:list                        — List all admin users
 *   npm run admin:grant user@example.com      — Grant admin role
 *   npm run admin:revoke user@example.com     — Revoke admin role
 *   npm run admin:info user@example.com       — Show a user's current tier and role
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH in .env
 */

import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

config(); // load .env

// ── Init Firebase Admin ────────────────────────────────────────────────────────

function initAdmin() {
  if (getApps().length > 0) return;
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

  if (key) {
    initializeApp({ credential: cert(JSON.parse(key)), projectId });
  } else if (path) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(path, 'utf8'))), projectId });
  } else {
    throw new Error(
      'Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH in .env'
    );
  }
}

initAdmin();
const db = getFirestore();
const auth = getAuth();

// ── Helpers ───────────────────────────────────────────────────────────────────

function row(label: string, value: string) {
  console.log(`  ${label.padEnd(12)} ${value}`);
}

async function resolveUid(email: string): Promise<string> {
  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch {
    console.error(`❌  No Firebase Auth user found for: ${email}`);
    process.exit(1);
  }
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function listAdmins() {
  console.log('\n📋  Admin users (role = "admin" in Firestore)\n');
  const snap = await db.collection('users').where('role', '==', 'admin').get();
  if (snap.empty) {
    console.log('  No admin users found.');
  } else {
    for (const doc of snap.docs) {
      const data = doc.data();
      let email = '(unknown)';
      try {
        const fbUser = await auth.getUser(doc.id);
        email = fbUser.email ?? '(no email)';
      } catch {
        /* user may have been deleted from auth */
      }
      console.log(`  UID: ${doc.id}`);
      row('Email:', email);
      row('Tier:', data.tier ?? 'free');
      row('Role:', data.role ?? '—');
      console.log();
    }
  }
  console.log(`  Total: ${snap.size} admin(s)\n`);
}

async function grantAdmin(email: string) {
  const uid = await resolveUid(email);
  await db.collection('users').doc(uid).set({ role: 'admin' }, { merge: true });
  console.log(`\n✅  Granted admin role to: ${email} (uid: ${uid})\n`);
}

async function revokeAdmin(email: string) {
  const uid = await resolveUid(email);
  await db.collection('users').doc(uid).update({ role: '' }); // empty string = no role, not admin
  console.log(`\n✅  Revoked admin role from: ${email} (uid: ${uid})\n`);
}

async function showInfo(email: string) {
  const uid = await resolveUid(email);
  const doc = await db.collection('users').doc(uid).get();
  const data = doc.exists ? doc.data()! : {};
  console.log(`\n👤  User info for: ${email}\n`);
  row('UID:', uid);
  row('Tier:', data.tier ?? 'free');
  row('Role:', data.role === 'admin' ? '🔐 admin' : data.role || '(none)');
  console.log();
}

// ── Entry point ───────────────────────────────────────────────────────────────

const [, , command, argument] = process.argv;

const commands: Record<string, () => Promise<void>> = {
  list: listAdmins,
  grant: () => {
    if (!argument) {
      console.error('Usage: npm run admin:grant <email>');
      process.exit(1);
    }
    return grantAdmin(argument);
  },
  revoke: () => {
    if (!argument) {
      console.error('Usage: npm run admin:revoke <email>');
      process.exit(1);
    }
    return revokeAdmin(argument);
  },
  info: () => {
    if (!argument) {
      console.error('Usage: npm run admin:info <email>');
      process.exit(1);
    }
    return showInfo(argument);
  },
};

if (!command || !commands[command]) {
  console.log(`
Admin Role Manager

Commands:
  npm run admin:list                       List all admin users
  npm run admin:grant user@example.com     Grant admin role to a user
  npm run admin:revoke user@example.com    Revoke admin role from a user
  npm run admin:info user@example.com      Show a user's current tier and role
`);
  process.exit(0);
}

commands[command]()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
