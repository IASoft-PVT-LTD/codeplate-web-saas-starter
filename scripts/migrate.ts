// Applies the migrations in drizzle/ to DATABASE_URL. Run it when deploying
// (before the new version starts). The embedded database migrates itself.
//   DATABASE_URL=postgres://... npm run db:migrate
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { closeDb, createDb, MIGRATIONS } from '@/db';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url || url.startsWith('pglite:')) {
    await closeDb(await createDb()); // createDb migrates the embedded database
    console.log('embedded database migrated');
    return;
  }
  const client = postgres(url, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS });
  await client.end();
  console.log('migrated');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
