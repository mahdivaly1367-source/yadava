#!/usr/bin/env node
/**
 * Release Signing Preflight Checker for CafeBazaar & Myket Signed Release APK/AAB.
 * Verifies local signing artifacts or prints exact keytool + GitHub Secrets commands.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidDir = path.join(root, 'android');

const checks = [
  {
    name: 'android/keystore.properties',
    ok: fs.existsSync(path.join(androidDir, 'keystore.properties')),
    hint: 'Copy android/keystore.properties.example to android/keystore.properties (or set GitHub Secrets for CI).',
  },
  {
    name: 'android/navanegar-release.jks',
    ok: fs.existsSync(path.join(androidDir, 'navanegar-release.jks')),
    hint: 'Generate with: keytool -genkey -v -keystore android/navanegar-release.jks -alias navanegar-release -keyalg RSA -keysize 2048 -validity 10000',
  },
  {
    name: 'android/app/google-services.json',
    ok: fs.existsSync(path.join(androidDir, 'app/google-services.json')),
    hint: 'Download from Firebase Console for package ir.navanegar.radif (or set NAVANEGAR_GOOGLE_SERVICES_JSON secret in GitHub Actions).',
  },
  {
    name: 'NAVANEGAR_BAZAAR_RSA_KEY env',
    ok: (process.env.NAVANEGAR_BAZAAR_RSA_KEY ?? '').trim().length >= 32,
    hint: 'Copy RSA Public Key from CafeBazaar Developer Panel -> In-App Billing.',
  },
  {
    name: 'NAVANEGAR_MYKET_RSA_KEY env',
    ok: (process.env.NAVANEGAR_MYKET_RSA_KEY ?? '').trim().length >= 32,
    hint: 'Copy RSA Public Key from Myket Developer Panel -> App Settings -> In-App Billing.',
  },
];

console.log('\n=== Navanegar CafeBazaar & Myket Signed Release Preflight ===\n');
let readyCount = 0;
for (const c of checks) {
  if (c.ok) {
    readyCount++;
    console.log(`  [OK]      ${c.name}`);
  } else {
    console.log(`  [MISSING] ${c.name}`);
    console.log(`            -> ${c.hint}`);
  }
}

console.log(`\nStatus: ${readyCount}/${checks.length} local release credentials detected.`);
console.log('GitHub Actions Signed Release Secrets required (Settings -> Secrets -> Actions):');
console.log('  1. NAVANEGAR_KEYSTORE_BASE64        (base64 -w0 android/navanegar-release.jks)');
console.log('  2. NAVANEGAR_KEYSTORE_STORE_PASSWORD');
console.log('  3. NAVANEGAR_KEYSTORE_KEY_PASSWORD');
console.log('  4. NAVANEGAR_GOOGLE_SERVICES_JSON   (base64 -w0 android/app/google-services.json)');
console.log('  5. NAVANEGAR_BAZAAR_RSA_KEY');
console.log('  6. NAVANEGAR_MYKET_RSA_KEY\n');
