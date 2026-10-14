// Sending email. With EMAIL_PROVIDER=console (the default) mails are printed
// and stored in the `outbox` table, which /dev/outbox shows in development:
// sign-up and password reset work locally with no email account.
// docs/recipes/add-email-provider.md covers Resend and others.
import type { Db } from '@/db';
import { outbox } from '@/db/schema';
import { env } from './env';

export type Mail = { to: string; subject: string; text: string };

export async function sendMail(db: Db, mail: Mail): Promise<void> {
  if (env.email.provider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.email.resendApiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.email.from, to: mail.to, subject: mail.subject, text: mail.text }),
    });
    if (!res.ok) throw new Error(`Resend refused the email (${res.status}): ${await res.text()}`);
    return;
  }
  await db.insert(outbox).values(mail);
  if (process.env.CODEPLATE_QUIET !== '1') {
    console.log(`\n[mail] to ${mail.to}: ${mail.subject}\n${mail.text}\n`);
  }
}
