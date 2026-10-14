// The database connection.
//
//   DATABASE_URL unset or "pglite:<dir>"  -> PGlite (Postgres in WASM, on disk), migrated on first use.
//   DATABASE_URL "pglite:memory"           -> PGlite in memory (tests).
//   DATABASE_URL "postgres://..."         -> a real Postgres; run `npm run db:migrate` when deploying.
//
// Use `getDb()` everywhere. Tests make their own with `createDb()`.
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

/** Either driver: both are Postgres to Drizzle. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS = path.join(process.cwd(), 'drizzle');
const DEFAULT_URL = 'pglite:.data/pglite';

/** A new connection (migrated, for PGlite). Close it with `closeDb(db)` in scripts. */
export async function createDb(url = process.env.DATABASE_URL || DEFAULT_URL): Promise<Db> {
  if (url.startsWith('pglite:') && process.env.NODE_ENV === 'production' && process.env.CODEPLATE_CHECKS !== '1') {
    // The embedded database lives in a local folder: on a real host it would
    // silently lose data (or never be shared between servers).
    throw new Error('DATABASE_URL must be a postgres:// URL in production. See .env.example and docs/recipes/deploy.md.');
  }
  if (url.startsWith('pglite:')) {
    const where = url.slice('pglite:'.length);
    if (where !== 'memory') mkdirSync(path.dirname(path.resolve(where)), { recursive: true });
    const client = where === 'memory' ? new PGlite() : new PGlite(path.resolve(where));
    const db = drizzlePglite(client, { schema });
    await migratePglite(db, { migrationsFolder: MIGRATIONS });
    return db as unknown as Db;
  }
  return drizzlePostgres(postgres(url, { max: 10 }), { schema }) as unknown as Db;
}

// One connection per server process (kept on globalThis so dev reloads reuse it).
const g = globalThis as unknown as { __db?: Promise<Db> };

export function getDb(): Promise<Db> {
  g.__db ??= createDb();
  return g.__db;
}

/** Closes a connection made with createDb (scripts; the app keeps its connection open). */
export async function closeDb(db: Db): Promise<void> {
  const client = (db as unknown as { $client: { close?: () => Promise<void>; end?: () => Promise<void> } }).$client;
  await (client.close?.() ?? client.end?.());
}

export { schema };
