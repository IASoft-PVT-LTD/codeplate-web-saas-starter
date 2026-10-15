// Shared test setup: a fresh in-memory Postgres (PGlite, migrated) per test
// file, the app's auth on top of it, and helpers to make users and read mail.
import { desc, eq } from 'drizzle-orm';
import { createDb, type Db } from '@/db';
import { outbox, user } from '@/db/schema';
import { createAuth, type Auth } from '@/lib/auth';

export type Ctx = { db: Db; auth: Auth };

export async function setup(): Promise<Ctx> {
  const db = await createDb('pglite:memory');
  return { db, auth: createAuth(db) };
}

let n = 0;

/** Signs up a new user and returns their id and email. */
export async function makeUser(ctx: Ctx, opts: { email?: string; password?: string; name?: string } = {}) {
  n += 1;
  const email = opts.email ?? `user${n}-${Date.now()}@example.com`;
  const password = opts.password ?? 'correct horse battery';
  await ctx.auth.api.signUpEmail({ body: { email, password, name: opts.name ?? `User ${n}` } });
  const [row] = await ctx.db.select().from(user).where(eq(user.email, email));
  return { id: row.id, email, password };
}

/** The newest email sent to `to`. */
export async function lastMail(ctx: Ctx, to: string) {
  const [m] = await ctx.db.select().from(outbox).where(eq(outbox.to, to)).orderBy(desc(outbox.id)).limit(1);
  return m;
}

/** The first URL in a text. */
export function firstUrl(text: string): string {
  const m = text.match(/https?:\/\/\S+/);
  if (!m) throw new Error(`no URL in: ${text}`);
  return m[0];
}
