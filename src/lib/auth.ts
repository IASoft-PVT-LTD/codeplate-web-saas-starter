// Authentication with Better Auth: email + password, email verification and
// password reset. Sessions live in our database (session table).
// docs/recipes/add-oauth-login.md adds Google/GitHub sign-in.
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { getDb, type Db } from '@/db';
import * as schema from '@/db/schema';
import { site } from '@/config/site';
import { authSecret, env } from './env';
import { sendMail } from './mailer';

export function createAuth(db: Db) {
  return betterAuth({
    appName: site.name,
    baseURL: env.appUrl,
    secret: authSecret(),
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: site.requireEmailVerification,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => {
        await sendMail(db, {
          to: user.email,
          subject: `Reset your ${site.name} password`,
          text: `Someone asked to reset the password for ${user.email}.\n\nReset it here (the link works for an hour):\n${url}\n\nIf it wasn't you, ignore this email.`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail(db, {
          to: user.email,
          subject: `Confirm your email for ${site.name}`,
          text: `Welcome to ${site.name}!\n\nConfirm your email address:\n${url}`,
        });
      },
    },
    // Users can delete their own account from Settings (rows they own cascade).
    user: { deleteUser: { enabled: true } },
    // Slows down password guessing: a few sign-in attempts per IP every 10
    // seconds, in production. Off in checks mode, where the screen tests sign in
    // many times a second. The counters live in memory, per server process.
    rateLimit: { enabled: env.isProd && !env.checksMode },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const g = globalThis as unknown as { __auth?: Promise<Auth> };

/** The app's auth instance (one per server process). */
export function getAuth(): Promise<Auth> {
  g.__auth ??= getDb().then(createAuth);
  return g.__auth;
}
