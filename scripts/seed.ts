// Demo data for local development and screenshots:
//   npm run seed            (uses DATABASE_URL, default the embedded database)
// Users (password "password123"):
//   free@example.com  (Free plan, 2 projects)
//   pro@example.com   (Pro plan, 6 projects)
//   admin@example.com (Free plan; add it to ADMIN_EMAILS to open /admin)
// Demo projects get fixed ids (demo-free-1, demo-pro-1 … demo-pro-6), so
// detail pages can be screenshotted: npm run shots -- /projects/demo-pro-1 --as=pro
// Refuses to run against a production database.
import { eq } from 'drizzle-orm';
import { closeDb, createDb } from '@/db';
import { project, subscription, user } from '@/db/schema';
import { createAuth } from '@/lib/auth';
import { devPriceId } from '@/config/plans';

const PASSWORD = 'password123';

const sample = [
  { name: 'Website relaunch', description: 'New homepage, pricing page and blog.', status: 'active', dueDate: '2026-11-20' },
  { name: 'Customer interviews', description: 'Talk to ten customers about onboarding.', status: 'planned', dueDate: '2026-11-05' },
  { name: 'Q4 newsletter', description: 'Product updates and a customer story.', status: 'done', dueDate: null },
  { name: 'Mobile app spike', description: 'Find out what a mobile app would take.', status: 'planned', dueDate: '2026-12-15' },
  { name: 'Support macros', description: 'Saved replies for the top 20 questions.', status: 'active', dueDate: null },
  { name: 'Annual pricing', description: 'Offer yearly plans with two months free.', status: 'planned', dueDate: '2027-01-10' },
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.CODEPLATE_CHECKS !== '1') throw new Error('Refusing to seed in production.');
  const db = await createDb();
  const auth = createAuth(db);
  for (const [email, name, n, plan] of [
    ['free@example.com', 'Frida Free', 2, null],
    ['pro@example.com', 'Paolo Pro', 6, 'pro'],
    ['admin@example.com', 'Ada Admin', 1, null],
  ] as const) {
    const [existing] = await db.select().from(user).where(eq(user.email, email));
    if (existing) continue;
    await auth.api.signUpEmail({ body: { email, password: PASSWORD, name } });
    const [u] = await db.select().from(user).where(eq(user.email, email));
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, u.id));
    for (const [i, p] of sample.slice(0, n).entries()) {
      await db.insert(project).values({ id: `demo-${email.split('@')[0]}-${i + 1}`, ownerId: u.id, ...p });
    }
    if (plan) {
      await db.insert(subscription).values({
        id: `sub_dev_${u.id}`, userId: u.id, paddleCustomerId: 'ctm_dev', priceId: devPriceId(plan), plan, status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
      });
    }
    console.log(`seeded ${email}`);
  }
  await closeDb(db);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
