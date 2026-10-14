# Retheme

Use when the product gets its real name, logo, colors, fonts or words: usually right after the interview, using the **Brand** answers in `docs/project.md`. The example turns "Launchpad" (indigo) into **Ledgerly** (teal). Every color in the app comes from the tokens in `src/app/globals.css`, so a retheme touches few files.

1. **Name and words** in `src/config/site.ts`: `name`, `tagline` (the landing page headline), `description` (the landing page intro, and the `<meta name="description">` through `src/app/layout.tsx`), `supportEmail` (footer, legal pages). The browser title (`%s · Ledgerly`), the auth emails' subjects and Better Auth's `appName` all read `site.name`.

2. **Email sender.** The "from" name and address come from `EMAIL_FROM`. Change the example in `.env.example` (`EMAIL_FROM="Ledgerly <hello@ledgerly.example>"`) and the fallback in `src/lib/env.ts` (`email.from`). The real address must be on a domain the email provider has verified (`add-email-provider.md`); tell the user to set it in `.env.local` and on the host.

3. **Logo** in `src/components/logo.tsx`. Replace the `<svg>` mark, keeping its size and token classes so it follows light and dark mode:
   ```tsx
   <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
     <rect width="32" height="32" rx="8" className="fill-brand" />
     <path d="M10 8h4v12h8v4H10z" className="fill-on-brand" />
   </svg>
   ```
   Draw simple marks yourself as SVG paths. If the user has a logo file, they must own it (rule 10): put an SVG's paths here, or save an image in `public/` and render it with `next/image`. The name next to the mark is `site.name`; remove the `<span>` if the logo already contains the name.

4. **Favicon.** Replace `src/app/icon.svg` (the template's indigo mark). Next turns `icon.*` in the `app` folder into the `<link rel="icon">` tag by itself (see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`). The file is served as-is, so use real colors, not classes:
   ```svg
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0f766e"/><path d="M10 8h4v12h8v4H10z" fill="#ffffff"/></svg>
   ```
   An SVG icon covers current browsers. If the user supplies a `favicon.ico` or a 180×180 `apple-icon.png`, put them in `src/app/` too (the same docs page lists the rules). Don't delete it without a replacement: without any icon, browsers request `/favicon.ico`, get a 404, and the screen tests' console-error check fails.

5. **Fonts.** The default is the system font stack in `--font-sans` (`src/app/globals.css`): fast, nothing to download. For a brand font, use `next/font`, which self-hosts it: with `next/font/google` the files are downloaded when the app builds and served from this site, so visitors' browsers never contact Google (`node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`). In `src/app/layout.tsx`:
   ```tsx
   import { Inter } from 'next/font/google';

   // Downloaded at build time and served from this site: browsers never contact Google.
   const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
   ```
   and `<html lang="en" className={inter.variable}>`. Then put the variable first in the stack in `src/app/globals.css`: `--font-sans: var(--font-inter), ui-sans-serif, system-ui, …;`. Notes:
   - `next build` (and so `npm run check`) needs internet access to fetch a Google font. For offline builds, or a font file the user provides, use `next/font/local` with the file in `src/app/fonts/` (same `variable` option).
   - Most Google Fonts are under the SIL Open Font License, which isn't in rule 10's list. Tell the user the font and its license, and record their OK in `docs/project.md` before adding it.
   - Use one family (two at most) and the weights the UI uses (400, 500, 600, 700); a variable font like Inter covers them all.

6. **Colors** in `src/app/globals.css`. Set every token twice: light in `@theme`, dark in the `@media (prefers-color-scheme: dark)` block (the app follows the system setting). What each token is for:
   | Token | Used for |
   |---|---|
   | `brand` | primary buttons, links, active nav, focus rings |
   | `brand-strong` | primary button hover |
   | `brand-soft` | active nav background, brand badges, focus ring glow |
   | `on-brand` | text and icons on `brand` |
   | `ink`, `ink-soft` | main text, secondary text |
   | `paper`, `canvas` | cards and inputs, page background |
   | `line` | borders and dividers |
   | `ok`, `warn`, `bad` | success, warning, error text; their badges and notices use a 10% tint of the same color |
   | `on-bad` | text on the red danger button |

   In dark mode the brand color must be light to read on dark backgrounds, so `on-brand` (and `on-bad`) become a very dark shade of the color instead of white. The Ledgerly values:
   ```css
   @theme {
     --color-brand: #0f766e;
     --color-brand-strong: #115e59;
     --color-brand-soft: #d5f5ef;
     --color-on-brand: #ffffff;
     --color-ink: #17201f;
     --color-ink-soft: #52605e;
     --color-line: #dde5e3;
     --color-paper: #ffffff;
     --color-canvas: #f4f7f6;
     --color-ok: #15803d;
     --color-warn: #a16207;
     --color-bad: #b91c1c;
     --color-on-bad: #ffffff;
     /* keep --font-sans and --radius-card */
   }

   @media (prefers-color-scheme: dark) {
     :root {
       --color-brand: #2dd4bf;
       --color-brand-strong: #5eead4;
       --color-brand-soft: #113a36;
       --color-on-brand: #042f2e;
       --color-ink: #e7efed;
       --color-ink-soft: #9fb0ad;
       --color-line: #26302f;
       --color-paper: #141a19;
       --color-canvas: #0d1211;
       --color-ok: #4ade80;
       --color-warn: #fbbf24;
       --color-bad: #f87171;
       --color-on-bad: #2a0707;
     }
   }
   ```
   Use 6-digit hex values (the contrast check below reads them). `--radius-card` sets how round cards are. Never put raw colors in components (rule 8); add a token instead.

7. **Check the contrast.** Every text color needs a ratio of at least 4.5 against its background (WCAG AA). Save this as `.data/contrast.mjs` (`.data/` is git-ignored) and run `node .data/contrast.mjs`:
   ```js
   // WCAG contrast of the theme tokens in src/app/globals.css, light and dark.
   import { readFileSync } from 'node:fs';
   const css = readFileSync('src/app/globals.css', 'utf8');
   const read = (block) => Object.fromEntries([...block.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
   const light = read(css.match(/@theme\s*{([^}]*)}/)[1]);
   const darkBlock = css.match(/prefers-color-scheme:\s*dark\)\s*{\s*:root\s*{([^}]*)}/);
   const dark = { ...light, ...(darkBlock ? read(darkBlock[1]) : {}) };
   const lum = (hex) => {
     const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
     return 0.2126 * r + 0.7152 * g + 0.0722 * b;
   };
   const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
   const pairs = [['ink', 'paper'], ['ink', 'canvas'], ['ink-soft', 'paper'], ['ink-soft', 'canvas'], ['brand', 'paper'], ['brand', 'canvas'],
     ['brand', 'brand-soft'], ['on-brand', 'brand'], ['on-brand', 'brand-strong'], ['ok', 'paper'], ['warn', 'paper'], ['bad', 'paper'], ['on-bad', 'bad']];
   for (const [name, t] of [['light', light], ['dark', dark]]) {
     for (const [fg, bg] of pairs) {
       const f = t[fg] ?? (fg.startsWith('on-') ? '#ffffff' : undefined);
       if (!f || !t[bg]) continue;
       const r = ratio(f, t[bg]);
       console.log(`${name.padEnd(5)} ${fg.padEnd(9)} on ${bg.padEnd(12)} ${r.toFixed(2)}${r < 4.5 ? '  <-- below 4.5' : ''}`);
     }
   }
   ```
   Fix every line marked `below 4.5` by darkening the text color (light mode) or lightening it (dark mode), and rerun. Leave a little margin on `ok`, `warn` and `bad` (aim for 4.7 or more): their badges sit on a tint, which lowers the ratio slightly. Run it even if you only change the brand color.

8. **Landing page and copy.** The landing page's words are in `src/config/landing.ts` (the headline and intro come from `site.ts`):
   - `hero`: the eyebrow line over the headline, the two buttons and the note under them.
   - `features`: six short items, each with an icon from `src/components/feature-icon.tsx` (add a path there for a new one). Only list what the app really does.
   - `proof`: the quotes ship as **placeholders**, labelled on the page. Replace them with real quotes the user has permission to publish and set `placeholder: false`, or set `quotes: []` to hide the section. Never invent customers, numbers or logos.
   - `pricing` and `closing`: the pricing teaser (it reads the plans from `plans.ts`) and the last call to action.

   The illustration is `src/components/hero-art.tsx`: a drawing of the dashboard in theme tokens, so it follows the new colors. Keep it, redraw it for the product (simple shapes, token classes), or replace it with a real screenshot in `public/` rendered with `next/image`. Check the words in `src/config/plans.ts` (`blurb`, `features`) and the line under the plans in `src/app/(marketing)/pricing/page.tsx`. The 404 pages are `src/app/not-found.tsx` and `src/app/(app)/not-found.tsx`; the error page is `src/components/error-panel.tsx`.

   **Link previews.** `src/app/opengraph-image.tsx` draws the image chat apps and social sites show for a link, from `site.name`, `tagline` and `description`. It can't read CSS variables, so set `site.shareImage` (`background`, `text`) to the new brand colors, and replace the mark in it with the new logo's paths. `src/app/sitemap.ts` lists the public pages; add new ones there. Both use `APP_URL` for absolute links, so it must be set on the host.

9. **Legal pages.** `src/app/(marketing)/legal/terms/page.tsx` and `src/app/(marketing)/legal/privacy/page.tsx` already use `site.name` and `site.supportEmail`. Don't write legal terms yourself: keep the placeholder warning until the user provides real text (Paddle asks for terms, privacy and refund policies before it approves live payments), and list it in `docs/project.md` under open questions.

10. **Docs.** Replace "Launchpad" in `README.md` (rewrite it for the product, as `AGENTS.md` says) and record the brand decisions (name, colors, font and its license, logo source) in `docs/project.md`. Search for leftovers: `grep -rn "Launchpad" src scripts tests .env.example` should find nothing.

## Verify

1. `npm run check`. It must end with `CODEPLATE CHECKS: PASS`. A new font needs internet access during `build`.
2. `node .data/contrast.mjs` prints nothing marked `below 4.5`.
3. Screenshots, in light and dark, desktop and phone:
   ```
   npm run shots -- / /pricing /sign-in /opengraph-image
   npm run shots -- / /pricing --dark
   npm run shots -- /dashboard /projects/new /billing --as=pro
   npm run shots -- /dashboard /projects/new /billing --as=pro --dark
   npm run shots -- / /dashboard --as=pro --size=390x844
   ```
   Look for: the new name and logo in the header, sidebar and sign-in card; primary buttons readable in both modes (dark mode: dark text on the light brand color); badges, notices and the active nav item readable; the font is the new one (compare letter shapes with an old screenshot); on the phone the marketing header (logo, Pricing, Sign in, Start free) fits on one line without touching: with a long name, hide the Pricing link below `sm` (`className="hidden … sm:inline"`) in `src/app/(marketing)/layout.tsx`.
4. Open `http://localhost:3000` with `npm run dev` and check the browser tab shows the new icon, or ask the user to.
