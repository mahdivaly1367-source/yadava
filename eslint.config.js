import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Lightweight ESLint v9 custom language plugin for Firestore Security Rules (`*.rules`)
 * so `eslint firestore.rules` parses and audits security invariants cleanly.
 */
const firestoreRulesLanguage = {
  fileType: 'text',
  lineStart: 1,
  columnStart: 0,
  nodeTypeKey: 'type',
  validateLanguageOptions() {},
  parse(file) {
    const text = file.body;
    const lines = text.split(/\r?\n/);
    return {
      ok: true,
      ast: {
        type: 'FirestoreRulesDocument',
        body: text,
        lines,
        loc: {
          start: { line: 1, column: 0 },
          end: { line: lines.length, column: (lines[lines.length - 1] ?? '').length },
        },
        range: [0, text.length],
      },
    };
  },
  createSourceCode(file, parseResult) {
    return {
      ast: parseResult.ast,
      text: file.body,
      lines: parseResult.ast.lines,
      getLoc(node) {
        return node.loc;
      },
      getRange(node) {
        return node.range;
      },
      traverse() {
        return [
          { kind: 1, phase: 1, target: parseResult.ast },
          { kind: 1, phase: 2, target: parseResult.ast },
        ];
      },
    };
  },
};

const firestoreRulesPlugin = {
  languages: {
    rules: firestoreRulesLanguage,
  },
  rules: {
    'valid-firestore-rules': {
      meta: {
        type: 'problem',
        docs: { description: 'Validate Firestore rules syntax structure and Navanegar security invariants.' },
      },
      create(context) {
        return {
          FirestoreRulesDocument(node) {
            const text = node.body;
            const lines = node.lines;

            if (!/rules_version\s*=\s*'2'\s*;/.test(text)) {
              context.report({
                loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
                message: "Firestore rules must declare `rules_version = '2';`.",
              });
            }

            if (!/service\s+cloud\.firestore\s*\{/.test(text)) {
              context.report({
                loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
                message: 'Firestore rules must define `service cloud.firestore { ... }`.',
              });
            }

            // Verify balanced braces and parentheses ignoring comments and string literals
            let depthBrace = 0;
            let depthParen = 0;
            lines.forEach((rawLine, idx) => {
              const stripped = rawLine
                .replace(/\/\/.*$/, '')
                .replace(/'[^']*'/g, "''")
                .replace(/"[^"]*"/g, '""');
              for (const ch of stripped) {
                if (ch === '{') depthBrace += 1;
                if (ch === '}') depthBrace -= 1;
                if (ch === '(') depthParen += 1;
                if (ch === ')') depthParen -= 1;
                if (depthBrace < 0 || depthParen < 0) {
                  context.report({
                    loc: { start: { line: idx + 1, column: 0 }, end: { line: idx + 1, column: rawLine.length } },
                    message: 'Unbalanced closing brace or parenthesis in firestore.rules.',
                  });
                  depthBrace = Math.max(0, depthBrace);
                  depthParen = Math.max(0, depthParen);
                }
              }

              if (/allow\s+(read|write|update|create|delete|list|get)[^;]*:\s*if\s+true\s*;/.test(stripped)) {
                context.report({
                  loc: { start: { line: idx + 1, column: 0 }, end: { line: idx + 1, column: rawLine.length } },
                  message: 'Wildcard `if true` permission is forbidden in production Firestore rules.',
                });
              }
            });

            if (depthBrace !== 0 || depthParen !== 0) {
              context.report({
                loc: { start: { line: lines.length, column: 0 }, end: { line: lines.length, column: 1 } },
                message: `Unbalanced delimiters in firestore.rules (braces=${depthBrace}, parens=${depthParen}).`,
              });
            }

            // Navanegar-specific strict security invariants
            const requiredPatterns = [
              { pattern: /saved_recordings/, msg: 'Missing `saved_recordings` match block.' },
              { pattern: /updatedAt/, msg: 'Missing `updatedAt` validation on `saved_recordings` update.' },
              { pattern: /lastReplyId/, msg: 'Missing atomic `lastReplyId` check on `forum_posts`.' },
              { pattern: /!exists\(/, msg: 'Missing `!exists(...)` anti-spoofing guard for `lastReplyId`.' },
              { pattern: /existsAfter\(/, msg: 'Missing `existsAfter(...)` atomic batch guard for `lastReplyId`.' },
              { pattern: /getAfter\(/, msg: 'Missing `getAfter(...)` author verification guard for `lastReplyId`.' },
            ];

            for (const req of requiredPatterns) {
              if (!req.pattern.test(text)) {
                context.report({
                  loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
                  message: req.msg,
                });
              }
            }
          },
        };
      },
    },
  },
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'android/**',
      'node_modules/**',
      'coverage/**',
      'scripts/**',
      'public/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['firestore.rules', '**/*.rules'],
    plugins: {
      firestore: firestoreRulesPlugin,
    },
    language: 'firestore/rules',
    rules: {
      'firestore/valid-firestore-rules': 'error',
    },
  }
);
