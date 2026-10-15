'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient, authError } from '@/lib/auth-client';
import { Button, Field, Input, Notice, Toast } from './ui';

// `at` keys the toast, so the next success shows it again.
type Status = { tone: 'ok' | 'bad'; text: string; at: number } | null;

/** Success as a toast, a problem as a notice that stays next to the form. */
function StatusMessage({ status }: { status: Status }) {
  if (!status) return null;
  return status.tone === 'ok' ? <Toast key={status.at}>{status.text}</Toast> : <Notice tone="bad">{status.text}</Notice>;
}

function useSubmit() {
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<{ error: { message?: string } | null }>, ok: string) {
    setBusy(true);
    setStatus(null);
    const { error } = await fn();
    setBusy(false);
    setStatus(error ? { tone: 'bad', text: authError(error), at: Date.now() } : { tone: 'ok', text: ok, at: Date.now() });
    return !error;
  }
  return { status, busy, run };
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const { status, busy, run } = useSubmit();
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const newName = String(new FormData(e.currentTarget).get('name'));
      if (await run(() => authClient.updateUser({ name: newName }), 'Saved.')) router.refresh();
    }}>
      <StatusMessage status={status} />
      <Field label="Name" htmlFor="name"><Input id="name" name="name" defaultValue={name} required maxLength={80} /></Field>
      <Field label="Email" htmlFor="email" hint="Contact support to change your email."><Input id="email" value={email} disabled /></Field>
      <Button type="submit" disabled={busy}>Save</Button>
    </form>
  );
}

export function PasswordForm() {
  const { status, busy, run } = useSubmit();
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = new FormData(form);
      const ok = await run(() => authClient.changePassword({
        currentPassword: String(f.get('current')), newPassword: String(f.get('next')), revokeOtherSessions: true,
      }), 'Password changed. Other devices were signed out.');
      if (ok) form.reset();
    }}>
      <StatusMessage status={status} />
      <Field label="Current password" htmlFor="current"><Input id="current" name="current" type="password" required autoComplete="current-password" /></Field>
      <Field label="New password" htmlFor="next" hint="At least 8 characters."><Input id="next" name="next" type="password" required minLength={8} autoComplete="new-password" /></Field>
      <Button type="submit" disabled={busy}>Change password</Button>
    </form>
  );
}

export function DeleteAccountForm() {
  const router = useRouter();
  const { status, busy, run } = useSubmit();
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const password = String(new FormData(e.currentTarget).get('password'));
      if (await run(() => authClient.deleteUser({ password }), 'Account deleted.')) {
        router.push('/');
        router.refresh();
      }
    }}>
      <p className="text-sm text-ink-soft">Deletes your account and everything in it. Cancel any paid plan in Billing first.</p>
      <StatusMessage status={status} />
      <Field label="Confirm with your password" htmlFor="delete-password"><Input id="delete-password" name="password" type="password" required autoComplete="current-password" /></Field>
      <Button type="submit" variant="danger" disabled={busy}>Delete my account</Button>
    </form>
  );
}
