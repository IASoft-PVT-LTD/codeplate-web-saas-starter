// The server the screen tests run against (started by playwright.config.ts):
// a fresh embedded database, the demo users, then `next start` on the given
// port. Builds first if there's no production build yet.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const port = process.argv[2] ?? '3198';
const env = {
  ...process.env,
  DATABASE_URL: 'pglite:.data/e2e',
  APP_URL: `http://localhost:${port}`,
  ADMIN_EMAILS: 'admin@example.com',
  // Turns on the dev outbox and billing simulator in this production build.
  // NEVER set it on a real deployment.
  CODEPLATE_CHECKS: '1',
  CODEPLATE_QUIET: '1',
  // The checks never talk to Paddle: the billing simulator stands in.
  PADDLE_API_KEY: '',
  PADDLE_WEBHOOK_SECRET: '',
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: '',
  // The checks read emails from the dev outbox, never a real inbox
  // (`next start` would otherwise pick up EMAIL_PROVIDER from .env.local).
  EMAIL_PROVIDER: 'console',
};
// One command line for the shell (npx needs a shell on Windows).
const line = (cmd, args) => [cmd, ...args].map((a) => (/[\s"]/.test(a) ? `"${a}"` : a)).join(' ');

function run(cmd, args) {
  const r = spawnSync(line(cmd, args), { env, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync('.next/BUILD_ID')) run('npx', ['next', 'build']);
rmSync('.data/e2e', { recursive: true, force: true });
run('npx', ['tsx', 'scripts/seed.ts']);
const server = spawn(line('npx', ['next', 'start', '--port', port]), { env, stdio: 'inherit', shell: true });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));
server.on('exit', (code) => process.exit(code ?? 0));
