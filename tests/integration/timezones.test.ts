// Times are stored as instants, whatever the machine's time zone. PGlite (and
// any Postgres) fills `defaultNow()` in its session time zone, so a column
// without a time zone mixes local times (database defaults) with UTC ones
// (dates the app writes). This file runs in Tokyo time to catch that.
process.env.TZ = 'Asia/Tokyo';

import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { MIGRATIONS } from '@/db';
import { createProject, listProjects, updateProject } from '@/lib/projects';
import { projectInput } from '@/lib/schemas';
import { outbox, session, user } from '@/db/schema';
import { makeUser, setup, type Ctx } from '../helpers';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await setup();
});

/** Within a minute of now (a wrong time zone is off by hours). */
const recent = (d: Date) => expect(Math.abs(d.getTime() - Date.now())).toBeLessThan(60_000);

describe('time zones', () => {
  it('runs in a time zone that is not UTC', () => {
    expect(new Date().getTimezoneOffset()).toBe(-540);
  });

  it('stores database defaults and app-written dates as the same instants', async () => {
    const u = await makeUser(ctx);
    const [row] = await ctx.db.select().from(user).where(eq(user.id, u.id));
    recent(row.createdAt);
    const [s] = await ctx.db.select().from(session).where(eq(session.userId, u.id));
    if (s) recent(s.createdAt);
    const r = await createProject(ctx.db, u.id, projectInput.parse({ name: 'Website' }));
    if (!r.ok) throw new Error(r.reason);
    recent(r.project.createdAt);
    recent(r.project.updatedAt);
    await ctx.db.insert(outbox).values({ to: u.email, subject: 'Hi', text: 'Hello' });
    const [m] = await ctx.db.select().from(outbox).where(eq(outbox.to, u.email));
    recent(m.sentAt);
  });

  it('lists the most recently changed project first', async () => {
    const u = await makeUser(ctx);
    // A new project (updatedAt from the database), then another one edited after it (updatedAt from the app).
    await createProject(ctx.db, u.id, projectInput.parse({ name: 'Untouched' }));
    const b = await createProject(ctx.db, u.id, projectInput.parse({ name: 'Draft' }));
    if (!b.ok) throw new Error(b.reason);
    await new Promise((r) => setTimeout(r, 5));
    await updateProject(ctx.db, u.id, b.project.id, projectInput.parse({ name: 'Edited' }));
    expect((await listProjects(ctx.db, u.id)).map((p) => p.name)).toEqual(['Edited', 'Untouched']);
  });

  it('0001_timestamptz turns an older database\'s times into the right instants', async () => {
    const pg = new PGlite();
    const run = async (file: string) => {
      for (const sql of readFileSync(path.join(MIGRATIONS, file), 'utf8').split('--> statement-breakpoint')) await pg.exec(sql);
    };
    await run('0000_init.sql');
    // Written the way 1.2.0 wrote them: the app's Dates as UTC, now() in the database's zone.
    const at = '2026-01-02 03:04:05';
    await pg.exec(`
      INSERT INTO "user" (id, name, email, created_at, updated_at) VALUES ('u', 'U', 'u@example.com', '${at}', '${at}');
      INSERT INTO project (id, owner_id, name) VALUES ('fresh', 'u', 'Fresh');
      INSERT INTO project (id, owner_id, name, updated_at) VALUES ('edited', 'u', 'Edited', '${at}');
      INSERT INTO outbox ("to", subject, text) VALUES ('u@example.com', 'Hi', 'Hello');`);
    await run('0001_timestamptz.sql');
    const one = async <T,>(sql: string) => (await pg.query<T>(sql)).rows[0];
    const iso = `${at.replace(' ', 'T')}.000Z`;
    expect((await one<{ t: Date }>(`SELECT created_at AS t FROM "user"`)).t.toISOString()).toBe(iso);
    expect((await one<{ t: Date }>(`SELECT updated_at AS t FROM project WHERE id = 'edited'`)).t.toISOString()).toBe(iso);
    const fresh = await one<{ c: Date; u: Date }>(`SELECT created_at AS c, updated_at AS u FROM project WHERE id = 'fresh'`);
    recent(fresh.c);
    expect(fresh.u).toEqual(fresh.c);
    recent((await one<{ t: Date }>('SELECT sent_at AS t FROM outbox')).t);
    await pg.close();
  });
});
