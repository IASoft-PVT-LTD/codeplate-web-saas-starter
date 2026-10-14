import { notFound } from 'next/navigation';
import { desc } from 'drizzle-orm';
import { getDb } from '@/db';
import { outbox } from '@/db/schema';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

// DEVELOPMENT ONLY: emails "sent" while EMAIL_PROVIDER=console. Click the
// verification or reset links here instead of checking a real inbox.
export default async function Outbox() {
  if (!env.devTools) notFound();
  const mails = await (await getDb()).select().from(outbox).orderBy(desc(outbox.id)).limit(50);
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Dev outbox</h1>
      <p className="mt-1 text-ink-soft">Emails the app sent (newest first). Only in development.</p>
      <div className="mt-8 space-y-4">
        {mails.length === 0 ? <p className="text-ink-soft">No emails yet.</p> : mails.map((m) => (
          <article key={m.id} className="rounded-xl border border-line bg-paper p-5">
            <p className="text-sm text-ink-soft">To {m.to} · {m.sentAt.toISOString().replace('T', ' ').slice(0, 19)}</p>
            <h2 className="mt-1 font-semibold">{m.subject}</h2>
            <p className="mt-3 whitespace-pre-wrap break-all text-sm">
              {m.text.split(/(https?:\/\/\S+)/).map((part, i) => part.startsWith('http') ? <a key={i} href={part} className="text-brand underline">{part}</a> : part)}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}
