# Add Google and GitHub sign-in

Use when the user wants "Continue with Google" or "Continue with GitHub" next to email and password. Better Auth has both providers built in (`socialProviders`). A provider stays off, with no button, until its keys are set, so the app and `npm run check` keep working offline with no keys at all.

Do only the providers the user asked for. The steps show both; for one, leave the other out of every snippet.

1. **Get the keys from the user.** You can't create OAuth apps; the user does it in each provider's console, then puts the values in `.env.local`. Never invent keys or put real ones in code. Send them these steps:
   - **Google:** in Google Cloud Console, open **Google Auth Platform**. Fill in **Branding** and **Audience** if asked (while the app is in testing, add yourself as a test user under **Audience**). Then **Clients** → **Create client** → application type **Web application**. Under **Authorized redirect URIs** add `http://localhost:3000/api/auth/callback/google`, and later the live one, `https://<your-domain>/api/auth/callback/google`. Click **Create** and copy the client ID and the client secret. The secret is shown in full only once.
   - **GitHub:** **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**. Use **Homepage URL** `http://localhost:3000` and **Authorization callback URL** `http://localhost:3000/api/auth/callback/github`. Click **Register application**, then **Generate a new client secret**. Make a second OAuth app for the live site (its callback URL is `https://<your-domain>/api/auth/callback/github`), so production keys never sit on a laptop. Use an OAuth App, not a GitHub App: a GitHub App also needs the **Email addresses** (read-only) permission, or sign-in fails with `email_not_found`.

   The callback path is always `<APP_URL>/api/auth/callback/<provider>`. Better Auth builds it from `APP_URL`, so `APP_URL` must match the address in the browser exactly, including the port.

2. **Document the variables** in `.env.example`, in a new section after `--- App` (the `env` check fails on any variable the code reads that isn't listed):
   ```bash
   # --- Sign in with Google / GitHub (docs/recipes/add-oauth-login.md) ----------------------------
   # A provider's button shows only when both its id and its secret are set.
   # Google Cloud → Google Auth Platform → Clients. Redirect URI: <APP_URL>/api/auth/callback/google
   GOOGLE_CLIENT_ID=
   # Secret.
   GOOGLE_CLIENT_SECRET=
   # GitHub → Settings → Developer settings → OAuth Apps. Callback URL: <APP_URL>/api/auth/callback/github
   GITHUB_CLIENT_ID=
   # Secret.
   GITHUB_CLIENT_SECRET=
   ```

3. **Read them in one place** (`src/lib/env.ts`). Add an `oauth` block to `env`, just before `email:`:
   ```ts
     oauth: {
       google: { clientId: process.env.GOOGLE_CLIENT_ID ?? '', clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '' },
       github: { clientId: process.env.GITHUB_CLIENT_ID ?? '', clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '' },
     },
   ```
   At the end of the file, add:
   ```ts
   export type OAuthProvider = keyof typeof env.oauth;

   /** Sign-in providers with both an id and a secret set. Only these get a button. */
   export function oauthProviders(): OAuthProvider[] {
     return (Object.keys(env.oauth) as OAuthProvider[]).filter((p) => env.oauth[p].clientId !== '' && env.oauth[p].clientSecret !== '');
   }
   ```

4. **Turn the providers on** in `src/lib/auth.ts`. Import `oauthProviders` (`import { authSecret, env, oauthProviders } from './env';`), and add `socialProviders` to the `betterAuth({...})` options, just before `user: { deleteUser: ... }`:
   ```ts
       // Google / GitHub sign-in. A provider without keys is off (no button, no route).
       socialProviders: {
         google: { ...env.oauth.google, enabled: oauthProviders().includes('google') },
         github: { ...env.oauth.github, enabled: oauthProviders().includes('github') },
       },
   ```
   With `enabled: false`, Better Auth skips the provider entirely, so missing keys never crash startup. Better Auth requests the default scopes (`openid email profile` for Google, `read:user user:email` for GitHub), which is all sign-in needs.

5. **Add the buttons:** create `src/components/social-buttons.tsx`:
   ```tsx
   'use client';
   // "Continue with Google / GitHub". The page passes the providers that have
   // keys (oauthProviders() in lib/env.ts), so nothing shows until they're set.
   import { useState } from 'react';
   import { authClient, authError } from '@/lib/auth-client';
   import type { OAuthProvider } from '@/lib/env';
   import { Button, Notice } from './ui';

   const names: Record<OAuthProvider, string> = { google: 'Google', github: 'GitHub' };

   /** `next`: where to land after signing in (the page passes afterAuthPath(plan), so a picked plan reaches checkout). */
   export function SocialButtons({ providers, next }: { providers: OAuthProvider[]; next: string }) {
     const [error, setError] = useState('');
     if (providers.length === 0) return null;
     return (
       <div className="mt-6 space-y-3 border-t border-line pt-6">
         {error ? <Notice tone="bad">{error}</Notice> : null}
         {providers.map((p) => (
           <Button key={p} type="button" variant="secondary" className="w-full" onClick={async () => {
             setError('');
             // Redirects to the provider; it comes back to /api/auth/callback/<provider>.
             const { error } = await authClient.signIn.social({ provider: p, callbackURL: next, errorCallbackURL: '/sign-in' });
             if (error) setError(authError(error));
           }}>Continue with {names[p]}</Button>
         ))}
       </div>
     );
   }
   ```
   Keep the "Continue with …" labels. The screen tests click buttons named "Sign in" and "Create account", and Playwright matches names by substring, so a "Sign in with Google" button would break them.

6. **Put the buttons on the sign-in page.** `src/app/(auth)/sign-in/page.tsx` is a server component (only the server can read the keys) that renders the client form in `sign-in-form.tsx` and passes on `?plan=` (a plan picked on the pricing page). Replace it with:
   ```tsx
   import type { Metadata } from 'next';
   import { afterAuthPath, paidPlanId } from '@/config/plans';
   import { oauthProviders } from '@/lib/env';
   import { Notice } from '@/components/ui';
   import { SocialButtons } from '@/components/social-buttons';
   import { SignInForm } from './sign-in-form';

   export const metadata: Metadata = { title: 'Sign in' };

   // Better Auth sends failed Google/GitHub sign-ins back here with ?error=<code>.
   const oauthErrors: Record<string, string> = {
     account_not_linked: 'That email already has an account. Sign in with your password (and confirm your email) first.',
   };

   // /sign-in?plan=pro (from sign-up, for people who already have an account) carries the plan on to checkout.
   export default async function SignIn({ searchParams }: { searchParams: Promise<{ error?: string; plan?: string }> }) {
     const { error, plan } = await searchParams;
     const picked = paidPlanId(plan);
     return (
       <>
         {error ? <div className="mb-5"><Notice tone="bad">{oauthErrors[error] ?? "That didn't work. Try again."}</Notice></div> : null}
         <SignInForm plan={picked} />
         <SocialButtons providers={oauthProviders()} next={afterAuthPath(picked)} />
       </>
     );
   }
   ```
   Reading `searchParams` also makes the page render per request, so it reads the keys at run time, not once at build time.

7. **Same for the sign-up page.** Replace `src/app/(auth)/sign-up/page.tsx` with:
   ```tsx
   import type { Metadata } from 'next';
   import { afterAuthPath, paidPlanId } from '@/config/plans';
   import { oauthProviders } from '@/lib/env';
   import { SocialButtons } from '@/components/social-buttons';
   import { SignUpForm } from './sign-up-form';

   export const metadata: Metadata = { title: 'Create your account' };

   // /sign-up?plan=pro (from the pricing page) carries the plan on to checkout.
   export default async function SignUp({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
     const picked = paidPlanId((await searchParams).plan);
     return (
       <>
         <SignUpForm plan={picked} />
         <SocialButtons providers={oauthProviders()} next={afterAuthPath(picked)} />
       </>
     );
   }
   ```
   Signing in with Google or GitHub creates the account on first use, so the sign-up page needs nothing else.

8. **Settings for people without a password** (`src/app/(app)/settings/page.tsx`, `src/components/settings-forms.tsx`). Someone who only ever used Google or GitHub has no password, so hide the Password card and don't ask for a password to delete the account:
   - In `settings/page.tsx`, add the imports `import { and, eq } from 'drizzle-orm';`, `import { getDb } from '@/db';` and `import { account } from '@/db/schema';`. After `const user = await requireUser();`, add:
     ```ts
       // People who only ever used Google/GitHub have no password to change.
       const [password] = await (await getDb()).select({ id: account.id }).from(account)
         .where(and(eq(account.userId, user.id), eq(account.providerId, 'credential'))).limit(1);
     ```
     Wrap the Password card as `{password ? <Card>…<PasswordForm /></Card> : null}`, and render `<DeleteAccountForm hasPassword={!!password} />`.
   - In `settings-forms.tsx`, change `DeleteAccountForm` to take `{ hasPassword = true }: { hasPassword?: boolean }`. Read the password with `String(new FormData(e.currentTarget).get('password') ?? '')`, call `authClient.deleteUser(hasPassword ? { password } : {})`, and render the password `Field` only when `hasPassword`. Without a password, Better Auth accepts the delete if the user signed in less than a day ago.

9. **Account linking: keep Better Auth's defaults.** When someone signs in with Google or GitHub and an account with that email already exists, Better Auth links the two only if the provider says the email is verified and the existing user has confirmed their email (`emailVerified`). Otherwise it sends them to `/sign-in?error=account_not_linked`, and step 6 shows a message. This stops someone from pre-registering a victim's email with a password and taking over their Google sign-in later. Don't set `account.accountLinking.requireLocalEmailVerified` to `false` or add `trustedProviders` unless the user understands that risk. If they want sign-ups confirmed first, `add-email-provider.md` turns on `requireEmailVerification`; Google and GitHub accounts arrive already verified.

10. **Add a test:** create `tests/integration/oauth.test.ts`. It runs offline with dummy keys:
    ```ts
    // Google / GitHub sign-in: buttons only for configured providers, and the
    // redirect to the provider carries our callback URL. Runs offline (dummy keys).
    import { describe, expect, it } from 'vitest';
    import { env, oauthProviders } from '@/lib/env';
    import { setup } from '../helpers';

    describe('oauth sign-in', () => {
      it('offers only providers with both an id and a secret', () => {
        env.oauth.google = { clientId: 'test-id', clientSecret: '' };
        env.oauth.github = { clientId: '', clientSecret: '' };
        expect(oauthProviders()).toEqual([]);
      });

      it('sends people to the provider with our callback URL', async () => {
        env.oauth.github = { clientId: 'test-id', clientSecret: 'test-secret' };
        expect(oauthProviders()).toEqual(['github']);
        const { auth } = await setup(); // createAuth reads the keys, so set them first
        const res = await auth.api.signInSocial({ body: { provider: 'github', callbackURL: '/dashboard' } });
        const url = new URL(res.url!);
        expect(url.host).toBe('github.com');
        expect(url.searchParams.get('redirect_uri')).toBe(`${env.appUrl}/api/auth/callback/github`);
      });
    });
    ```
    If you only added Google, use `google` and expect the host `accounts.google.com`. No screen test covers the provider round trip, because it needs real accounts on Google or GitHub. The existing screen tests check that sign-in and sign-up still work with no keys set.

11. **Record it** in `docs/project.md`, under Sign-in: which providers, and that their keys live in `.env.local` (never the values). Tell the user which variables to set in `.env.local` and on the host (`deploy.md`), and that each live domain needs its own redirect URI in the provider's console.

## Verify

1. `npm run check`, with no OAuth keys set. It must end with `CODEPLATE CHECKS: PASS`. The new test runs in `test`, and the sign-in and sign-up pages render with no buttons.
2. Screenshots: `npm run shots -- /sign-in /sign-up`. With no keys, the pages look exactly as before.
3. With the user's keys in `.env.local`: restart `npm run dev`, open http://localhost:3000/sign-in, and check that each configured provider's button shows. Click it, approve, and you land on `/dashboard`. Your name and email come from the provider. Sign out, then sign in again with the same button.
4. Linking: sign up with a password using the same email as your Google account, but don't confirm it. Then try "Continue with Google". You should see the "already has an account" message. Confirm the email from `/dev/outbox`, try again, and the accounts link.
5. A `redirect_uri_mismatch` (Google) or "redirect_uri is not associated" (GitHub) error means the URI in the provider's console doesn't exactly match `<APP_URL>/api/auth/callback/<provider>`.
