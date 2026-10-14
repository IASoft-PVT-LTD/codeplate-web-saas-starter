// The checks: one command that tells you whether the app still works.
//   npm run check
// Runs, in order:
//   env         every process.env variable the code reads is documented in .env.example
//   migrations  src/db/schema.ts has no changes missing a migration in drizzle/
//   typecheck   route types + tsc (strict)
//   lint        eslint (eslint.config.mjs)
//   test        vitest: unit + integration tests on an in-memory Postgres
//   build       next build (production)
//   e2e         Playwright screen tests against `next start` on a fresh database
//               (finds a browser, or installs Playwright's Chromium once: scripts/lib/browser.mjs)
// A failing step doesn't stop the later ones (except build → e2e), so one run
// shows every problem. The last line is CODEPLATE CHECKS: PASS or FAIL (<n> failed).
//   --skip=e2e,build   skip steps (for a quick loop; always finish with a full run)
import { spawnSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ensureBrowser } from '../scripts/lib/browser.mjs';

const skip = new Set((process.argv.find((a) => a.startsWith('--skip='))?.slice(7) ?? '').split(',').filter(Boolean));
const baseEnv = { ...process.env, CODEPLATE_QUIET: '1' };
const results = [];
// One command line for the shell (npx needs a shell on Windows).
const line = (cmd, args) => [cmd, ...args].map((a) => (/[\s"]/.test(a) ? `"${a}"` : a)).join(' ');

function sh(cmd, args, env = baseEnv) {
  const r = spawnSync(line(cmd, args), { env, stdio: 'inherit', shell: true });
  return r.status === 0;
}

function capture(cmd, args, env = baseEnv) {
  const r = spawnSync(line(cmd, args), { env, encoding: 'utf8', shell: true });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

async function step(name, fn) {
  if (skip.has(name)) {
    console.log(`\n--- ${name}: skipped`);
    results.push({ name, ok: true, skipped: true });
    return true;
  }
  console.log(`\n--- ${name}`);
  const start = Date.now();
  let ok = false;
  try {
    ok = await fn();
  } catch (e) {
    console.error(e);
  }
  console.log(`--- ${name}: ${ok ? 'pass' : 'FAIL'} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
  results.push({ name, ok });
  return ok;
}

function sourceFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

// Variables set by Node, Next or the test tools, not by the app's owner.
const PLATFORM_VARS = new Set(['NODE_ENV', 'CODEPLATE_CHECKS', 'CODEPLATE_QUIET', 'PW_CHANNEL', 'CI', 'NEXT_RUNTIME']);

await step('env', () => {
  const documented = new Set([...readFileSync('.env.example', 'utf8').matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]));
  const missing = new Map();
  for (const f of [...sourceFiles('src'), ...sourceFiles('scripts')]) {
    for (const m of readFileSync(f, 'utf8').matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      if (!documented.has(m[1]) && !PLATFORM_VARS.has(m[1])) missing.set(m[1], f);
    }
  }
  for (const [v, f] of missing) console.log(`${v} (read in ${f}) is not in .env.example: add it there with a comment.`);
  if (!missing.size) console.log(`${documented.size} variables documented in .env.example`);
  return missing.size === 0;
});

await step('migrations', () => {
  // Generate into a copy of drizzle/: if drizzle-kit writes a new migration,
  // the schema changed without one.
  // (drizzle-kit wants a relative --out, and exits 0 on some errors.)
  const tmp = '.data/migrations-check';
  rmSync(tmp, { recursive: true, force: true });
  try {
    cpSync('drizzle', tmp, { recursive: true });
    const before = readdirSync(tmp).length;
    const r = capture('npx', ['drizzle-kit', 'generate', '--dialect', 'postgresql', '--schema', 'src/db/schema.ts', '--out', tmp]);
    if (!r.ok || /error/i.test(r.out)) {
      console.log(r.out);
      return false;
    }
    const added = readdirSync(tmp).filter((f) => f.endsWith('.sql')).length - readdirSync('drizzle').filter((f) => f.endsWith('.sql')).length;
    if (added > 0 || readdirSync(tmp).length !== before) {
      console.log('src/db/schema.ts has changes with no migration. Run `npm run db:generate` and commit the new file in drizzle/.');
      return false;
    }
    console.log('schema and migrations agree');
    return true;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await step('typecheck', () => sh('npx', ['next', 'typegen']) && sh('npx', ['tsc', '--noEmit']));

await step('lint', () => sh('npx', ['eslint', '.']));

await step('test', () => sh('npx', ['vitest', 'run']));

const built = await step('build', () => {
  rmSync('.next', { recursive: true, force: true });
  return sh('npx', ['next', 'build'], { ...baseEnv, CODEPLATE_CHECKS: '1' });
});

if (!built && !skip.has('build')) {
  console.log('\n--- e2e: skipped (the build failed)');
  results.push({ name: 'e2e', ok: false });
} else {
  await step('e2e', async () => {
    await ensureBrowser();
    const ok = sh('npx', ['playwright', 'test'], { ...baseEnv, PW_CHANNEL: process.env.PW_CHANNEL ?? '' });
    if (!ok) console.log('Screenshots and traces of failures are in .data/test-results/.');
    return ok;
  });
}

const failed = results.filter((r) => !r.ok);
console.log('\n' + results.map((r) => `${r.ok ? (r.skipped ? 'skip' : 'pass') : 'FAIL'}  ${r.name}`).join('\n'));
console.log(failed.length ? `CODEPLATE CHECKS: FAIL (${failed.length} failed)` : 'CODEPLATE CHECKS: PASS');
process.exitCode = failed.length ? 1 : 0;
