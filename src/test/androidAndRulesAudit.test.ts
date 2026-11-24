import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function readText(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'test' || entry.name === 'rules') continue;
      results.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe('Architecture, Zero-LLM, Android Dual-Flavor & Firestore Rules Audit', () => {
  it('uses ZERO LLM, Gemini API, or chatbot libraries in application source code', () => {
    const pkg = JSON.parse(readText('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDeps = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    for (const dep of allDeps) {
      expect(dep.toLowerCase()).not.toMatch(/gemini|openai|anthropic|langchain|generative-ai/);
    }

    const srcFiles = collectSourceFiles(path.join(ROOT, 'src'));
    for (const file of srcFiles) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text).not.toMatch(/generativelanguage\.googleapis\.com|@google\/genai|@google\/generative-ai/i);
    }
  });

  it('configures Android Application ID, version 1.0.0 (code 1), Bazaar Poolakey 2.2.0, Myket 2.2, and Release Security Locks', () => {
    const appGradle = readText('android/app/build.gradle');
    expect(appGradle).toContain('applicationId "ir.navanegar.radif"');
    expect(appGradle).toContain('versionCode 1');
    expect(appGradle).toContain('versionName "1.0.0"');
    expect(appGradle).toContain("bazaarImplementation 'com.github.cafebazaar.Poolakey:poolakey:2.2.0'");
    expect(appGradle).toContain("myketImplementation 'ir.myket:billing:2.2'");
    expect(appGradle).toContain('marketApplicationId: "ir.mservices.market"');
    expect(appGradle).toContain('marketBindAddress  : "ir.mservices.market.InAppBillingService.BIND"');
    expect(appGradle).toContain('marketPermission   : "ir.mservices.market.BILLING"');
    expect(appGradle).toContain('verifyBazaarReleaseSecurity');
    expect(appGradle).toContain('verifyMyketReleaseSecurity');
    expect(appGradle).toContain('NAVANEGAR_BAZAAR_RSA_KEY');
    expect(appGradle).toContain('NAVANEGAR_MYKET_RSA_KEY');
    expect(appGradle).toContain('navanegar-release');

    const varsGradle = readText('android/variables.gradle');
    expect(varsGradle).toContain('rgcfaIncludeGoogle = true');
  });

  it('enforces Just-In-Time RECORD_AUDIO permission (never requested inside MainActivity.onCreate)', () => {
    const mainActivity = readText('android/app/src/main/java/ir/navanegar/radif/MainActivity.java');
    const onCreateMatch = mainActivity.match(/void onCreate\([\s\S]*?\n {4}\}/);
    expect(onCreateMatch).not.toBeNull();
    // Must NEVER request permissions proactively in onCreate
    expect(onCreateMatch?.[0]).not.toContain('requestPermissions');
    // Must handle WebView permission request Just-In-Time
    expect(mainActivity).toContain('onPermissionRequest');
    expect(mainActivity).toContain('RESOURCE_AUDIO_CAPTURE');
    expect(mainActivity).toContain('registerPlugin(NavanegarBillingPlugin.class)');
  });

  it('forbids Poolakey SecurityCheck.Disable in non-debug builds and checks Myket subscriptionsSupported()', () => {
    const bazaarBridge = readText(
      'android/app/src/bazaar/java/ir/navanegar/radif/billing/MarketBillingBridge.kt'
    );
    expect(bazaarBridge).toContain('if (!BuildConfig.DEBUG)');
    expect(bazaarBridge).toContain('SecurityCheck.Enable(rsaPublicKey = rsaKey)');
    expect(bazaarBridge).toContain('SecurityCheck.Disable is forbidden');

    const myketBridge = readText(
      'android/app/src/myket/java/ir/navanegar/radif/billing/MarketBillingBridge.kt'
    );
    expect(myketBridge).toContain('subscriptionsSupported()');
    expect(myketBridge).toContain('IabHelper.ITEM_TYPE_SUBS');
    expect(myketBridge).toContain('queryInventoryAsync');
  });

  it('keeps firestore.rules aligned with firebase-blueprint.json and protects secrets in .gitignore', () => {
    const rules = readText('firestore.rules');
    const blueprint = JSON.parse(readText('firebase-blueprint.json')) as {
      firestore: { databaseId: string; longPolling: boolean };
      collections: Record<string, unknown>;
    };

    expect(blueprint.firestore.databaseId).toBe('navanegar-db');
    expect(blueprint.firestore.longPolling).toBe(true);
    for (const col of Object.keys(blueprint.collections)) {
      expect(rules).toContain(`match /${col}/`);
    }
    expect(rules).toContain('request.resource.data.updatedAt > resource.data.updatedAt');
    expect(rules).toContain('!exists(/databases/$(database)/documents/forum_posts/$(postId)/replies/$(request.resource.data.lastReplyId))');
    expect(rules).toContain('existsAfter(/databases/$(database)/documents/forum_posts/$(postId)/replies/$(request.resource.data.lastReplyId))');
    expect(rules).toContain('getAfter(/databases/$(database)/documents/forum_posts/$(postId)/replies/$(request.resource.data.lastReplyId)).data.authorUid == request.auth.uid');

    const gitignore = readText('.gitignore');
    expect(gitignore).toContain('android/keystore.properties');
    expect(gitignore).toContain('*.jks');
    expect(gitignore).toContain('android/app/google-services.json');
  });
});
