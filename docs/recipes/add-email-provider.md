# Send real email

Use when the app must send real emails (password resets, email confirmation, invites) instead of printing them, or when the user wants a provider other than Resend. Optionally (part C), make people confirm their email before they can sign in.

The default, `EMAIL_PROVIDER=console`, keeps every mail in the `outbox` table, which `/dev/outbox` shows. The checks depend on this: the screen tests click links in the outbox. So a real provider is switched on only by environment variables, in `.env.local` or on the host, and the console mailer stays the default. In production, `/dev/outbox` is off, so with `console` nobody receives anything. A live site needs a real provider.

## A. Resend (built in)

`src/lib/mailer.ts` already sends through Resend's API when `EMAIL_PROVIDER=resend`. No code changes are needed.

1. **The user sets up Resend.** Ask them to do this; never invent keys.
   - **Verify the sending domain:** **Domains** → **Add Domain**. Resend suggests a subdomain such as `mail.example.com`, which keeps the main domain's reputation separate. Pick the region nearest most users. Add the records from the domain's **Records** tab at their DNS host: an **MX** and an **SPF** TXT record on `send.<domain>`, and a **DKIM** TXT record on `resend._domainkey.<domain>`. Then click **Verify**. Resend offers one-click setup for some DNS hosts, such as Cloudflare. Mail from an unverified domain is refused. The shared test sender `onboarding@resend.dev` can only send to the account owner's own address.
   - **Add DMARC** once the domain verifies. A TXT record on `_dmarc.<domain>` such as `v=DMARC1; p=none;` is a safe start. Gmail and Yahoo expect it from bulk senders, and it improves delivery for everyone.
   - **Create a key:** **API Keys** → **Create API Key**, with permission **Sending access**, limited to that domain. The key starts with `re_` and is shown only once.
2. **Set the variables** in `.env.local` for local testing, and on the host for production (see `deploy.md`). The names are already in `.env.example`:
   ```bash
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_...            # from the user
   EMAIL_FROM="Acme <hello@mail.example.com>"   # an address on the verified domain
   ```
   Also update the default `from` in `src/lib/env.ts` (`'Launchpad <hello@example.com>'`) and the `EMAIL_FROM` line in `.env.example` to the product's name, so new environments start right.
3. **The checks stay on the console mailer.** `next start` loads `.env.local`, so `scripts/e2e-server.mjs` (and `scripts/shots.mjs`) set `EMAIL_PROVIDER: 'console'` for the servers they start; variables already set in the environment win over `.env.local`. Keep those lines: without them `npm run check` would send its test emails through the real provider and the outbox tests would fail.

## B. Another provider (Postmark, SMTP, …)

Add a branch to `sendMail()` in `src/lib/mailer.ts`, before the outbox lines, in the same shape as the Resend one: build a request from `env.email`, send it, and throw on failure, so a mail that didn't go out never looks like success. Leave the `console` path last and unchanged.

4. **Read the provider's settings** in `src/lib/env.ts`. Widen the `provider` type and add the keys:
   ```ts
       /** "console" (default: print and keep in the dev outbox), "resend", "postmark" or "smtp". */
       provider: (process.env.EMAIL_PROVIDER ?? 'console') as 'console' | 'resend' | 'postmark' | 'smtp',
       resendApiKey: process.env.RESEND_API_KEY ?? '',
       postmarkToken: process.env.POSTMARK_SERVER_TOKEN ?? '',
       smtpUrl: process.env.SMTP_URL ?? '',
   ```
   Add only the ones you use. Document them in `.env.example` under `--- Email`, and update the `EMAIL_PROVIDER` comment there:
   ```bash
   # "console" prints emails and keeps them at /dev/outbox. "resend", "postmark" or "smtp" send them for real.
   EMAIL_PROVIDER=console
   RESEND_API_KEY=
   # Postmark → your server → API Tokens. Secret.
   POSTMARK_SERVER_TOKEN=
   # SMTP server, e.g. smtps://user:pass@smtp.example.com:465 (password URL-encoded). Secret.
   SMTP_URL=
   ```
5. **Postmark** needs no package; it's one `fetch`. In `src/lib/mailer.ts`, before `await db.insert(outbox).values(mail);`, add:
   ```ts
     if (env.email.provider === 'postmark') {
       const res = await fetch('https://api.postmarkapp.com/email', {
         method: 'POST',
         headers: { 'x-postmark-server-token': env.email.postmarkToken, accept: 'application/json', 'content-type': 'application/json' },
         body: JSON.stringify({ From: env.email.from, To: mail.to, Subject: mail.subject, TextBody: mail.text, MessageStream: 'outbound' }),
       });
       if (!res.ok) throw new Error(`Postmark refused the email (${res.status}): ${await res.text()}`);
       return;
     }
   ```
   `outbound` is Postmark's default transactional stream. The user gets the server token from their Postmark server's **API Tokens** tab, and must verify the sender domain (DKIM and Return-Path) in Postmark first. Other HTTP providers (SendGrid, Mailgun, Amazon SES…) follow the same pattern, using their own documented endpoint and fields.
6. **SMTP** (any mail host, or Amazon SES over SMTP) uses Nodemailer (license MIT-0, which is permissive):
   ```bash
   npm install --save-exact nodemailer
   npm install --save-exact --save-dev @types/nodemailer
   ```
   Then add this to `src/lib/mailer.ts`, also before the outbox lines:
   ```ts
     if (env.email.provider === 'smtp') {
       const { createTransport } = await import('nodemailer'); // loaded only when SMTP is on
       await createTransport(env.email.smtpUrl).sendMail({ from: env.email.from, to: mail.to, subject: mail.subject, text: mail.text });
       return;
     }
   ```
   Nodemailer needs Node's TCP sockets. It works on Vercel and on a Node server, not on Cloudflare Workers; use an HTTP provider there.
7. **Keep the checks offline:** `scripts/e2e-server.mjs` already forces `EMAIL_PROVIDER: 'console'` (step 3), so a new provider needs nothing there.
8. **Test it offline:** create `tests/integration/mailer.test.ts`. It fakes `fetch`, so nothing is sent:
   ```ts
   // The mailer: console keeps mail in the outbox; a real provider gets the
   // right request. fetch is faked, so nothing leaves the machine.
   import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
   import { env } from '@/lib/env';
   import { sendMail } from '@/lib/mailer';
   import { lastMail, setup, type Ctx } from '../helpers';

   let ctx: Ctx;
   beforeAll(async () => {
     ctx = await setup();
   });
   afterEach(() => {
     env.email.provider = 'console';
     vi.unstubAllGlobals();
   });

   const mail = { to: 'pat@example.com', subject: 'Hello', text: 'Hi there' };

   describe('mailer', () => {
     it('keeps mail in the outbox by default', async () => {
       await sendMail(ctx.db, mail);
       expect((await lastMail(ctx, mail.to))?.subject).toBe('Hello');
     });

     it('sends through Postmark', async () => {
       const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
       vi.stubGlobal('fetch', fetch);
       env.email.provider = 'postmark';
       env.email.postmarkToken = 'test-token';
       await sendMail(ctx.db, { ...mail, to: 'sam@example.com' });
       const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
       expect(url).toBe('https://api.postmarkapp.com/email');
       expect((init.headers as Record<string, string>)['x-postmark-server-token']).toBe('test-token');
       expect(JSON.parse(String(init.body))).toMatchObject({ To: 'sam@example.com', Subject: 'Hello', TextBody: 'Hi there' });
       expect(await lastMail(ctx, 'sam@example.com')).toBeUndefined(); // not in the outbox
     });

     it('fails loudly when the provider refuses', async () => {
       vi.stubGlobal('fetch', vi.fn(async () => new Response('bad token', { status: 401 })));
       env.email.provider = 'postmark';
       await expect(sendMail(ctx.db, mail)).rejects.toThrow(/401/);
     });
   });
   ```
   For another HTTP provider, change the expected URL, header and fields. Don't unit-test SMTP; check it by hand (Verify, step 3).

## C. Require a confirmed email before sign-in (optional)

Turn this on only once real email works (A or B). Otherwise nobody can finish signing up on the live site.

9. **Turn it on:** in `src/config/site.ts`, set `requireEmailVerification: true`. The sign-up page then shows "Check your inbox" instead of going to the dashboard. The link in the email confirms the address and signs the user in, because `autoSignInAfterVerification` is already on in `src/lib/auth.ts`.
10. **Resend the link, and handle taken emails,** in `src/lib/auth.ts`:
    - In `emailVerification`, after `sendOnSignUp: true,`, add:
      ```ts
            // Signing in before confirming sends a fresh link.
            sendOnSignIn: true,
      ```
    - With verification on, Better Auth stops saying "this email is taken" on sign-up, so nobody can find out who has an account. It answers as if sign-up worked and calls `onExistingUserSignUp` instead. In `emailAndPassword`, after `minPasswordLength: 8,`, add:
      ```ts
            // Signing up again with a taken email looks like success (no account
            // probing); the owner gets this email instead.
            onExistingUserSignUp: async ({ user }) => {
              await sendMail(db, {
                to: user.email,
                subject: `You already have a ${site.name} account`,
                text: `Someone (hopefully you) tried to sign up with ${user.email}, but you already have an account.\n\nSign in: ${env.appUrl}/sign-in\nForgot your password? ${env.appUrl}/forgot-password`,
              });
            },
      ```
11. **Update the tests to the new rule.** This is a deliberate change of behavior (AGENTS.md rule 11), so say so to the user.
    - `tests/helpers.ts`: add a helper above `firstUrl`:
      ```ts
      /** Confirms a user's email with the link from their newest email. */
      export async function verifyEmail(ctx: Ctx, email: string) {
        const token = new URL(firstUrl((await lastMail(ctx, email)).text)).searchParams.get('token')!;
        await ctx.auth.api.verifyEmail({ query: { token } });
      }
      ```
    - `tests/integration/auth.test.ts`: import `verifyEmail` from `'../helpers'`. In `'signs in with the right password only'` and `'resets a password from the emailed link'`, call `await verifyEmail(ctx, u.email);` right after `makeUser`. Add a test for the new rule:
      ```ts
        it('refuses sign-in until the email is confirmed', async () => {
          const u = await makeUser(ctx);
          await expect(ctx.auth.api.signInEmail({ body: { email: u.email, password: u.password } })).rejects.toThrow(/not verified/i);
        });
      ```
      Replace the body of `'refuses a second account with the same email'`:
      ```ts
          const u = await makeUser(ctx);
          // With verification on, Better Auth answers as if it worked (so nobody can
          // probe which emails have accounts) and emails the owner instead.
          await ctx.auth.api.signUpEmail({ body: { email: u.email, password: 'another password', name: 'Someone else' } });
          expect(await ctx.db.select().from(user).where(eq(user.email, u.email))).toHaveLength(1);
          expect((await lastMail(ctx, u.email)).subject).toMatch(/already have/i);
      ```
    - `tests/e2e/helpers.ts`, in `signUp()`: after the click on **Create account**, and in place of the `toHaveURL(/\/dashboard$/)` line that follows it, confirm through the dev outbox:
      ```ts
        // Email verification is on: open the link from the dev outbox, which signs you in.
        await expect(page.getByText('Check your inbox')).toBeVisible();
        await page.goto('/dev/outbox');
        await page.locator('article', { hasText: `To ${email}` }).first().getByRole('link').first().click();
        await expect(page).toHaveURL(/\/dashboard$/);
      ```
    The demo users from `scripts/seed.ts` are already marked verified, so `npm run shots -- … --as=…` keeps working.

12. **Record it** in `docs/project.md`: the provider, the sending domain, and whether email confirmation is required. Never record the keys.

## Verify

1. `npm run check` must end with `CODEPLATE CHECKS: PASS`. Run it with the real provider's settings in `.env.local` too. Thanks to step 3, the checks still use the outbox and send nothing.
2. Without any provider settings, run `npm run dev`, sign up, and check that the mail shows at http://localhost:3000/dev/outbox and in the terminal.
3. With the user's settings in `.env.local` (`EMAIL_PROVIDER` and its key), restart `npm run dev`. Use **Forgot password?** with the user's own address: the email must arrive, come from `EMAIL_FROM`, and its link must open `/reset-password`. If it fails, the server log shows the provider's error (`… refused the email (401) …` means a wrong key; 403 or 422 usually means the sender domain isn't verified).
4. Check the received email's headers ("Show original" in Gmail): SPF, DKIM and DMARC should all say `PASS`.
5. If you did part C: sign up with a new address. You see "Check your inbox", and signing in fails until you click the link. The link signs you in on `/dashboard`.
