// For uptime monitors: 200 when the app can reach its database.
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    await (await getDb()).execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'database error' }, { status: 503 });
  }
}
