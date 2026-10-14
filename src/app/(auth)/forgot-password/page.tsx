'use client';
import Link from 'next/link';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button, Field, Input, Notice } from '@/components/ui';

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    // The answer is the same whether or not the email has an account,
    // so this page can't be used to find out who's signed up.
    await authClient.requestPasswordReset({ email: String(new FormData(e.currentTarget).get('email')), redirectTo: '/reset-password' });
    setBusy(false);
    setSent(true);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="text-xl font-bold">Reset your password</h1>
      {sent ? <Notice>If that email has an account, we've sent a link to reset the password.</Notice> : (
        <>
          <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Sending…' : 'Send reset link'}</Button>
        </>
      )}
      <p className="text-center text-sm"><Link href="/sign-in" className="text-brand">Back to sign in</Link></p>
    </form>
  );
}
