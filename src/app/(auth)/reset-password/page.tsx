'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { authClient, authError } from '@/lib/auth-client';
import { Button, Field, Input, Notice } from '@/components/ui';

// The emailed link goes through /api/auth/reset-password/<token>, which sends
// the user here with ?token=... (or ?error=INVALID_TOKEN).
function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const [error, setError] = useState(params.get('error') ? 'This link has expired or was already used.' : '');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    const { error } = await authClient.resetPassword({ newPassword: String(new FormData(e.currentTarget).get('password')), token });
    setBusy(false);
    if (error) return setError(authError(error));
    router.push('/sign-in?reset=1');
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="text-xl font-bold">Choose a new password</h1>
      {error ? <Notice tone="bad">{error} <Link href="/forgot-password" className="underline">Send a new link</Link></Notice> : null}
      {token ? (
        <>
          <Field label="New password" htmlFor="password" hint="At least 8 characters.">
            <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Saving…' : 'Save password'}</Button>
        </>
      ) : null}
    </form>
  );
}

export default function ResetPassword() {
  return <Suspense><ResetForm /></Suspense>;
}
