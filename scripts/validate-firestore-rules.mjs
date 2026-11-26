import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rulesPath = path.join(root, 'firestore.rules');
const blueprintPath = path.join(root, 'firebase-blueprint.json');

const rules = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

const errors = [];

// Verify top-level collections from blueprint exist in firestore.rules
for (const colName of Object.keys(blueprint.collections)) {
  if (!rules.includes(`match /${colName}/`)) {
    errors.push(`Collection '${colName}' declared in firebase-blueprint.json is missing from firestore.rules`);
  }
}

// Verify subcollections exist in firestore.rules
for (const [colName, colDef] of Object.entries(blueprint.collections)) {
  if (colDef.subcollections) {
    for (const subName of Object.keys(colDef.subcollections)) {
      if (!rules.includes(`match /${subName}/`)) {
        errors.push(`Subcollection '${colName}/${subName}' from firebase-blueprint.json is missing from firestore.rules`);
      }
    }
  }
}

// Verify critical security invariants
const invariants = [
  { name: 'rules_version v2', ok: /rules_version\s*=\s*'2'/.test(rules) },
  { name: 'default deny fallback', ok: /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/.test(rules) },
  { name: 'saved_recordings monotonic updatedAt check', ok: /request\.resource\.data\.updatedAt\s*>\s*resource\.data\.updatedAt/.test(rules) },
  { name: 'atomic lastReplyId !exists check', ok: /!exists\(\/databases\/\$\(database\)\/documents\/forum_posts\/\$\(postId\)\/replies\/\$\(request\.resource\.data\.lastReplyId\)\)/.test(rules) },
  { name: 'atomic lastReplyId existsAfter check', ok: /existsAfter\(\/databases\/\$\(database\)\/documents\/forum_posts\/\$\(postId\)\/replies\/\$\(request\.resource\.data\.lastReplyId\)\)/.test(rules) },
  { name: 'atomic lastReplyId getAfter authorUid check', ok: /getAfter\(\/databases\/\$\(database\)\/documents\/forum_posts\/\$\(postId\)\/replies\/\$\(request\.resource\.data\.lastReplyId\)\)\.data\.authorUid\s*==\s*request\.auth\.uid/.test(rules) },
  { name: 'no wildcard allow if true', ok: !/allow\s+[^;]*:\s*if\s+true\s*;/.test(rules) },
];

for (const inv of invariants) {
  if (!inv.ok) {
    errors.push(`Security invariant failed: ${inv.name}`);
  }
}

if (errors.length > 0) {
  console.error('Firestore rules validation FAILED:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log(`Firestore rules validated cleanly against firebase-blueprint.json (${Object.keys(blueprint.collections).length} root collections verified).`);
