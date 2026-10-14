// Finds a browser for the screen tests and screenshots, so `npm ci && npm run
// check` works on a clean machine. In order:
//   1. PW_CHANNEL, if set (chrome, msedge…): that installed browser
//   2. Playwright's own Chromium, if `npm run setup` (or an earlier run) installed it
//   3. an installed Chrome, then Edge
//   4. otherwise it installs Playwright's Chromium once (cached for later runs)
// It sets PW_CHANNEL for the processes started after it (playwright.config.ts
// reads it) and returns the channel (undefined = Playwright's Chromium).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

export async function ensureBrowser({ log = console.log } = {}) {
  if (process.env.PW_CHANNEL) {
    log(`browser: ${process.env.PW_CHANNEL} (from PW_CHANNEL)`);
    return process.env.PW_CHANNEL;
  }
  if (existsSync(chromium.executablePath())) {
    log("browser: Playwright's Chromium");
    return undefined;
  }
  for (const channel of ['chrome', 'msedge']) {
    try {
      const b = await chromium.launch({ channel });
      await b.close();
      log(`browser: the installed ${channel === 'chrome' ? 'Chrome' : 'Edge'} (set PW_CHANNEL to choose another, or run \`npm run setup\` for Playwright's Chromium)`);
      process.env.PW_CHANNEL = channel;
      return channel;
    } catch {
      // not installed; try the next one
    }
  }
  log("browser: none found, so installing Playwright's Chromium once (about 150 MB; later runs reuse it)…");
  const r = spawnSync('npx playwright install chromium', { stdio: 'inherit', shell: true });
  if (r.status !== 0 || !existsSync(chromium.executablePath())) {
    throw new Error(
      "Couldn't install a browser for the screen tests. Run `npm run setup` and read its error, install Chrome or Edge, " +
        'or set PW_CHANNEL to an installed browser (chrome, msedge). On Linux, `npx playwright install --with-deps chromium` also installs the system libraries.',
    );
  }
  return undefined;
}
