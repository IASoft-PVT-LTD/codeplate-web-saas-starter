import type { Metadata } from 'next';
import { site } from '@/config/site';

export const metadata: Metadata = { title: 'Terms of service' };

// PLACEHOLDER. Replace with terms written for your business (Paddle asks for
// terms, a privacy policy and a refund policy before approving live payments).
export default function Terms() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-6 py-20">
      <h1 className="text-3xl font-bold">Terms of service</h1>
      <p className="rounded-lg bg-warn/10 px-4 py-3 text-sm text-warn">This is placeholder text from the template. Replace it before launching.</p>
      <p>By using {site.name} you agree to use it lawfully and not to abuse the service.</p>
      <h2 className="pt-4 text-xl font-semibold">Subscriptions and refunds</h2>
      <p>Paid plans renew each period until cancelled. You can cancel from the Billing page; your plan stays active until the end of the paid period.</p>
      <h2 className="pt-4 text-xl font-semibold">Contact</h2>
      <p>Questions: <a className="text-brand" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a></p>
    </article>
  );
}
