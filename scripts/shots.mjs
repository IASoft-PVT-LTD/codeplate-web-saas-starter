// Screenshots of the running app, so an agent can see what it changed.
//
//   npm run shots -- /dashboard /billing --as=pro
//   npm run shots -- dashboard billing --as=pro     (same; easier in Git Bash, which rewrites /paths)
//   npm run shots -- / /pricing                     (signed out)
//   npm run shots -- /projects --as=free --size=390x844   (phone)
//
// --as=free|pro|admin   sign in as a seeded demo user (scripts/seed.ts)
// --size=WxH            viewport (default 1280x800)
// --dark                dark color scheme
// --crop                only what fits in the viewport (default: the full page)
//
// Starts its own server (`next dev` on port 3199) with a throwaway embedded
// database, seeds it, and stops it afterwards. PNGs go to shots/.
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { ensureBrowser } from './lib/browser.mjs';

const args = process.argv.slice(2);
// Pages: every argument that isn't a --flag. Git Bash on Windows turns
// "/pricing" into "C:/Program Files/Git/pricing"; undo that.
const paths = args.filter((a) => !a.startsWith('--')).map((a) => {
  const msys = a.match(/^[A-Za-z]:[\\/].*?[\\/]Git([\\/].*)$/);
  const p = (msys ? msys[1] : a).replace(/\\/g, '/');
  return p.startsWith('/') ? p : `/${p}`;
});
const as = args.find((a) => a.startsWith('--as='))?.slice(5);
const [w, h] = (args.find((a) => a.startsWith('--size='))?.slice(7) ?? '1280x800').split('x').map(Number);
const dark = args.includes('--dark');
const crop = args.includes('--crop');
if (paths.length === 0) paths.push('/');

const PORT = 3199;
const BASE = `http://localhost:${PORT}`;
const env = { ...process.env, DATABASE_URL: 'pglite:.data/shots', ADMIN_EMAILS: 'admin@example.com', APP_URL: BASE, CODEPLATE_QUIET: '1', EMAIL_PROVIDER: 'console' };
// One command line for the shell (npx needs a shell on Windows).
const line = (cmd, args) => [cmd, ...args].map((a) => (/[\s"]/.test(a) ? `"${a}"` : a)).join(' ');

function run(cmd, cmdArgs) {
  return new Promise((resolve, reject) => {
    const p = spawn(line(cmd, cmdArgs), { env, stdio: 'inherit', shell: true });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${cmdArgs.join(' ')} exited ${code}`))));
  });
}

async function waitFor(url, seconds = 120) {
  for (let i = 0; i < seconds * 2; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server didn't start at ${url}`);
}

rmSync('.data/shots', { recursive: true, force: true });
await run('npx', ['tsx', 'scripts/seed.ts']);
mkdirSync('.data', { recursive: true });
const log = openSync('.data/shots-server.log', 'w');
const server = spawn(line('npx', ['next', 'dev', '--port', String(PORT)]), { env, stdio: ['ignore', log, log], shell: true });
try {
  try {
    await waitFor(`${BASE}/api/health`);
  } catch (e) {
    console.error(readFileSync('.data/shots-server.log', 'utf8').slice(-3000));
    console.error('The server did not start. Is `npm run dev` already running in this folder? Next allows one dev server per project: stop it and retry.');
    throw e;
  }
  const channel = await ensureBrowser();
  const browser = await chromium.launch(channel ? { channel } : {});
  const context = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: dark ? 'dark' : 'light' });
  if (as) {
    const res = await context.request.post(`${BASE}/api/auth/sign-in/email`, { data: { email: `${as}@example.com`, password: 'password123' } });
    if (!res.ok()) throw new Error(`sign-in as ${as} failed: ${res.status()} ${await res.text()}`);
  }
  const page = await context.newPage();
  // Browser errors and warnings, printed per page. They're what the dev
  // overlay's red "Issue" badge in a screenshot refers to: fix them.
  let problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`uncaught: ${e.message}`));
  mkdirSync('shots', { recursive: true });
  let total = 0;
  for (const path of paths) {
    problems = [];
    // 'load', not 'networkidle': the dev server's hot-reload connection never goes quiet.
    await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
    await page.waitForTimeout(500); // let React hydrate, so hydration errors show up
    const file = `shots/${(path === '/' ? 'home' : path.slice(1).replace(/[/?=&]+/g, '-'))}${as ? `-${as}` : ''}${dark ? '-dark' : ''}.png`;
    await page.screenshot({ path: file, fullPage: !crop });
    console.log(`saved ${file}`);
    for (const p of problems) console.log(`  ${p.slice(0, 800)}`);
    total += problems.length;
  }
  if (total) console.log(`${total} browser error(s)/warning(s) above. Fix them before moving on (the screen tests fail on console errors).`);
  await browser.close();
} finally {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
  else server.kill('SIGTERM');
}
