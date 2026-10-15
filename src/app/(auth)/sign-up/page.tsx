import type { Metadata } from 'next';
import { paidPlanId } from '@/config/plans';
import { SignUpForm } from './sign-up-form';

export const metadata: Metadata = { title: 'Create your account' };

// /sign-up?plan=pro (from the pricing page) carries the plan on to checkout.
export default async function SignUp({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return <SignUpForm plan={paidPlanId(plan)} />;
}
