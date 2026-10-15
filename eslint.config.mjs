// ESLint: `npm run lint` (also the `lint` step of `npm run check`).
// Lean on purpose: JavaScript and TypeScript basics, React's hook rules and
// Next's own rules. TypeScript (`npm run typecheck`) does the type checking.
import { registerHooks } from 'node:module';
import { defineConfig } from 'eslint/config';

// typescript-eslint parses with TypeScript's JavaScript API. TypeScript 7 (the
// native compiler `tsc` uses) doesn't ship that API yet, so in this process its
// `typescript` imports load TypeScript 6 (`typescript-for-lint` in
// package.json), which reads the same syntax. Remove this, and the package,
// once typescript-eslint supports TypeScript 7.
registerHooks({
  resolve: (specifier, context, next) => next(specifier === 'typescript' ? 'typescript-for-lint' : specifier, context),
});
const { default: js } = await import('@eslint/js');
const { default: tseslint } = await import('typescript-eslint');
const { default: reactHooks } = await import('eslint-plugin-react-hooks');
const { default: nextPlugin } = await import('@next/eslint-plugin-next');

export default defineConfig(
  { ignores: ['.next/', '.data/', 'node_modules/', 'shots/', 'drizzle/', 'next-env.d.ts'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  nextPlugin.configs['core-web-vitals'],
  {
    rules: {
      // Undefined names are TypeScript's job (typescript-eslint's advice), and
      // the .mjs scripts run in Node, whose globals ESLint doesn't know.
      'no-undef': 'off',
      // `_name` marks an argument or variable that's unused on purpose.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
);
