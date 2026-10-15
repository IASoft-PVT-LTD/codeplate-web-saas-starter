import type { Metadata } from 'next';
import { site } from '@/config/site';

export const metadata: Metadata = { title: 'Privacy policy' };

// PLACEHOLDER. Replace with a policy that matches what you actually collect.
export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-6 py-20">
      <h1 className="text-3xl font-bold">Privacy policy</h1>
      <p className="rounded-lg bg-warn/10 px-4 py-3 text-sm text-warn">This is placeholder text from the template. Replace it before launching.</p>
      <p>{site.name} stores your name, email address, a hash of your password, and the {site.resource.many} you create. Payments are processed by Paddle; we never see your card details.</p>
      <p>You can delete your account and everything in it from Settings at any time.</p>
      <p>Questions: <a className="text-brand" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a></p>
    </article>
  );
}
