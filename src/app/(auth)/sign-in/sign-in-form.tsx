'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient, authError } from '@/lib/auth-client';
import { Button, Field, Input, Notice } from '@/components/ui';
import { afterAuthPath, plans, type PlanId } from '@/config/plans';

/** The sign-in form. `plan`: a paid plan picked on the pricing page; after sign-in, its checkout. */
export function SignInForm({ plan }: { plan: PlanId | null }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    const { error } = await authClient.signIn.email({ email: String(f.get('email')), password: String(f.get('password')) });
    setBusy(false);
    if (error) return setError(authError(error, 'Wrong email or password.'));
    router.push(afterAuthPath(plan));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="text-xl font-bold">Sign in</h1>
      {plan ? <Notice>Sign in to finish upgrading to <strong>{plans[plan].name}</strong>.</Notice> : null}
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
      <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" required autoComplete="current-password" /></Field>
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-ink-soft hover:text-ink">Forgot password?</Link>
        <Link href={plan ? `/sign-up?plan=${plan}` : '/sign-up'} className="text-brand">Create account</Link>
      </div>
    </form>
  );
}
