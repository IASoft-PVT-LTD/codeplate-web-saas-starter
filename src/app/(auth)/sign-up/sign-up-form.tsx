'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient, authError } from '@/lib/auth-client';
import { Button, Field, Input, Notice } from '@/components/ui';
import { site } from '@/config/site';
import { afterAuthPath, plans, type PlanId } from '@/config/plans';

/** The sign-up form. `plan`: the paid plan picked on the pricing page; after sign-up, its checkout. */
export function SignUpForm({ plan }: { plan: PlanId | null }) {
  const next = afterAuthPath(plan);
  const router = useRouter();
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    const { error } = await authClient.signUp.email({
      name: String(f.get('name')),
      email: String(f.get('email')),
      password: String(f.get('password')),
      callbackURL: next,
    });
    setBusy(false);
    if (error) return setError(authError(error));
    if (site.requireEmailVerification) setSent(true);
    else router.push(next);
  }

  if (sent) {
    return <Notice>Check your inbox: we sent a link to confirm your email.</Notice>;
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="text-xl font-bold">Create your account</h1>
      {plan ? <Notice>You picked the <strong>{plans[plan].name}</strong> plan. Create your account, then finish checkout.</Notice> : null}
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Field label="Name" htmlFor="name"><Input id="name" name="name" required autoComplete="name" /></Field>
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters.">
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Creating…' : 'Create account'}</Button>
      <p className="text-center text-sm text-ink-soft">Already have an account? <Link href={plan ? `/sign-in?plan=${plan}` : '/sign-in'} className="text-brand">Sign in</Link></p>
    </form>
  );
}
