import type { Metadata } from 'next';
import { paidPlanId } from '@/config/plans';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in' };

// /sign-in?plan=pro (from sign-up, for people who already have an account) carries the plan on to checkout.
export default async function SignIn({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return <SignInForm plan={paidPlanId(plan)} />;
}
